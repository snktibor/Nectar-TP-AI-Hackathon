"""Real multi-agent audit orchestrator.

Replaces the mock pipeline. Same in-memory task registry pattern so the audit
endpoints don't change. Fans out the five document-type specialist agents in
parallel via `asyncio.gather`, isolates per-agent failures, and aggregates
findings into the standard `AuditReport`.

The RAG layer is injected via the `RagService` Protocol — implementation owned
by the parallel team in `app.services.rag_service`. If that module has not yet
exposed `query_context`, individual agents will fail fast with clear telemetry
and the audit still completes (status=`completed` if ≥1 agent succeeded; the
failing agents leave error rows in `agent_runs`).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol, runtime_checkable
from uuid import UUID, uuid4

from app.agents import AGENT_CLASSES, DocumentTypeAgent, RagService
from app.core.settings import Settings, get_settings
from app.models.schemas import (
    AgentRunResult,
    AuditReport,
    AuditStatus,
    BenchmarkRisk,
    ConsistencyError,
    ErrorDetail,
    MissingElement,
    RiskSeverity,
)
from app.services.llm_client import LlmClient

logger = logging.getLogger("redline.orchestrator")


# ---------------------------------------------------------------------------
# Task state — structurally compatible with mock_agent_service._TaskState plus
# the new `agent_progress` map. The audit endpoints only read attributes, so
# this duck-typed shape is enough.
# ---------------------------------------------------------------------------


@dataclass
class _AgentTaskState:
    """Mutable per-task record stored in the orchestrator's registry."""

    audit_task_id: UUID
    session_id: UUID
    status: AuditStatus = AuditStatus.PENDING
    progress: int = 0
    stage: str = "queued"
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    error: ErrorDetail | None = None
    report: AuditReport | None = None
    agent_progress: dict[str, str] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Audit service Protocol — both this orchestrator and the mock satisfy it.
# ---------------------------------------------------------------------------


@runtime_checkable
class AuditService(Protocol):
    async def register_task(self, session_id: UUID) -> UUID: ...
    async def get_task(self, task_id: UUID) -> object | None: ...
    async def run_pipeline(self, task_id: UUID) -> None: ...


# ---------------------------------------------------------------------------
# Orchestrator.
# ---------------------------------------------------------------------------


_DISPATCH_WEIGHT = 5
_FINALIZE_WEIGHT = 5


class AgentOrchestrator:
    """Async-safe orchestrator running 5 specialists in parallel."""

    def __init__(
        self,
        llm: LlmClient | None = None,
        rag: RagService | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._llm = llm or LlmClient(self._settings)
        self._rag = rag or _resolve_rag_service()
        self._tasks: dict[UUID, _AgentTaskState] = {}
        self._lock = asyncio.Lock()

    # ---- Public API --------------------------------------------------

    async def register_task(self, session_id: UUID) -> UUID:
        task_id = uuid4()
        agent_progress = {cls.agent_id: "pending" for cls in AGENT_CLASSES}
        async with self._lock:
            self._tasks[task_id] = _AgentTaskState(
                audit_task_id=task_id,
                session_id=session_id,
                agent_progress=agent_progress,
            )
        logger.info(
            "audit task registered task_id=%s session_id=%s mode=real",
            task_id,
            session_id,
        )
        return task_id

    async def get_task(self, task_id: UUID) -> _AgentTaskState | None:
        async with self._lock:
            return self._tasks.get(task_id)

    async def run_pipeline(self, task_id: UUID) -> None:
        state = await self.get_task(task_id)
        assert state is not None, f"run_pipeline called for unknown task_id={task_id}"
        assert state.status == AuditStatus.PENDING, (
            f"run_pipeline expected PENDING, got {state.status} for task_id={task_id}"
        )

        await self._update(
            task_id,
            status=AuditStatus.IN_PROGRESS,
            stage="dispatching_agents",
            progress=_DISPATCH_WEIGHT,
        )

        per_agent_weight = (100 - _DISPATCH_WEIGHT - _FINALIZE_WEIGHT) // max(len(AGENT_CLASSES), 1)
        results: list[AgentRunResult] = []

        # Schedule all agents in parallel, each with its own timeout.
        async def _run_one(cls: type[DocumentTypeAgent]) -> AgentRunResult:
            agent = cls(llm=self._llm, rag=self._rag, settings=self._settings)
            await self._mark_agent(task_id, agent.agent_id, "running")
            try:
                result = await asyncio.wait_for(
                    agent.run(state.session_id),
                    timeout=self._settings.agent_timeout_s,
                )
            except asyncio.TimeoutError:
                logger.warning("agent timed out agent_id=%s", agent.agent_id)
                result = _synthetic_failure(
                    agent_cls=cls,
                    settings=self._settings,
                    code="AGENT_TIMEOUT",
                    message=f"Agent exceeded {self._settings.agent_timeout_s}s timeout.",
                    status="timeout",
                )
            except Exception as exc:  # noqa: BLE001 — surface as telemetry, do not crash audit
                logger.exception("agent crashed agent_id=%s", agent.agent_id)
                result = _synthetic_failure(
                    agent_cls=cls,
                    settings=self._settings,
                    code="AGENT_EXCEPTION",
                    message=f"{type(exc).__name__}: {exc}",
                    status="error",
                )
            await self._mark_agent(
                task_id,
                agent.agent_id,
                result.status,
                add_progress=per_agent_weight,
            )
            return result

        tasks = [asyncio.create_task(_run_one(cls)) for cls in AGENT_CLASSES]
        results = await asyncio.gather(*tasks)

        # Aggregate.
        report = _aggregate_report(state, results)
        successful = sum(1 for r in results if r.status == "ok")
        if successful == 0:
            await self._update(
                task_id,
                status=AuditStatus.FAILED,
                stage="all_agents_failed",
                progress=100,
                report=report,
                error=ErrorDetail(
                    code="ALL_AGENTS_FAILED",
                    message="No specialist agent produced findings.",
                ),
            )
            logger.error("audit failed task_id=%s — all agents errored or timed out", task_id)
            return

        await self._update(
            task_id,
            status=AuditStatus.COMPLETED,
            stage="done",
            progress=100,
            report=report,
        )
        logger.info(
            "audit completed task_id=%s successful_agents=%d/%d",
            task_id,
            successful,
            len(results),
        )

    # ---- Internal ----------------------------------------------------

    async def _update(self, task_id: UUID, **changes: object) -> None:
        async with self._lock:
            state = self._tasks.get(task_id)
            if state is None:
                raise KeyError(f"unknown task_id={task_id}")
            for key, value in changes.items():
                setattr(state, key, value)
            state.updated_at = datetime.now(timezone.utc)

    async def _mark_agent(
        self,
        task_id: UUID,
        agent_id: str,
        agent_status: str,
        add_progress: int = 0,
    ) -> None:
        async with self._lock:
            state = self._tasks.get(task_id)
            if state is None:
                return
            state.agent_progress[agent_id] = agent_status
            if add_progress:
                state.progress = min(100 - _FINALIZE_WEIGHT, state.progress + add_progress)
                state.stage = f"agent:{agent_id}:{agent_status}"
            state.updated_at = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Helpers.
# ---------------------------------------------------------------------------


def _synthetic_failure(
    agent_cls: type[DocumentTypeAgent],
    settings: Settings,
    code: str,
    message: str,
    status: str,
) -> AgentRunResult:
    """Build an `AgentRunResult` for an agent that crashed or timed out."""
    now = datetime.now(timezone.utc)
    return AgentRunResult(
        agent_id=agent_cls.agent_id,
        doc_type_scope=agent_cls.doc_type,
        prompt_version=agent_cls.prompt_version,
        model=settings.model_doc_agent,
        started_at=now,
        finished_at=now,
        status=status,  # type: ignore[arg-type]  # constrained Literal upstream
        error=ErrorDetail(code=code, message=message),
    )


def _aggregate_report(state: _AgentTaskState, results: list[AgentRunResult]) -> AuditReport:
    """Flatten findings from successful agent runs into the canonical report."""
    consistency: list[ConsistencyError] = []
    benchmark: list[BenchmarkRisk] = []
    missing: list[MissingElement] = []
    for r in results:
        if r.status != "ok":
            continue
        consistency.extend(r.consistency_errors)
        benchmark.extend(r.benchmark_risks)
        missing.extend(r.missing_elements)

    summary = (
        f"{sum(1 for r in results if r.status == 'ok')}/{len(results)} agents succeeded; "
        f"{len(consistency)} consistency, {len(benchmark)} benchmark, "
        f"{len(missing)} completeness findings."
    )

    return AuditReport(
        audit_task_id=state.audit_task_id,
        session_id=state.session_id,
        generated_at=datetime.now(timezone.utc),
        consistency_errors=consistency,
        benchmark_risks=benchmark,
        missing_elements=missing,
        # Final NAV-oriented risk scoring is owned by the future aggregator agent.
        # Until then, surface a deterministic placeholder so the contract holds.
        overall_risk=RiskSeverity.MEDIUM,
        summary=summary,
        agent_runs=results,
    )


def _resolve_rag_service() -> RagService:
    """Return the RagService singleton.

    Imported lazily so this module can be imported in test environments where
    chromadb is unavailable; tests inject FakeRagService directly via the
    AgentOrchestrator constructor and never call this function.
    """
    from app.services.rag_service import rag_service as _rag

    return _rag  # type: ignore[return-value]  # satisfies Protocol via query_context


# ---------------------------------------------------------------------------
# Module-level singleton + factory.
# ---------------------------------------------------------------------------


_orchestrator: AgentOrchestrator | None = None


def get_audit_service() -> AuditService:
    """Return the active audit service.

    Selection rule: `settings.use_real_agents` decides between the real
    `AgentOrchestrator` (5 specialists, parallel, real LLM) and the legacy
    `mock_agent_service` (synthetic findings, no LLM). The choice is taken
    once per process; toggling at runtime is intentionally not supported.
    """
    settings = get_settings()
    if settings.use_real_agents:
        global _orchestrator
        if _orchestrator is None:
            _orchestrator = AgentOrchestrator(settings=settings)
        return _orchestrator

    from app.services.mock_agent_service import mock_agent_service

    return mock_agent_service  # type: ignore[return-value]  # duck-typed via Protocol
