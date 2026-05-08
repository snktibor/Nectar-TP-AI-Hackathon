"""Mock multi-agent LLM pipeline.

Simulates a long-running (20-60s) audit job by progressing through staged work
units with `asyncio.sleep`. Task state is held in an in-memory registry keyed by
audit_task_id. In production this would be backed by Redis / a job queue with a
database-persisted audit record.
"""

from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.models.schemas import (
    AuditReport,
    AuditStatus,
    BenchmarkRisk,
    ConsistencyError,
    ErrorDetail,
    ErrorLocation,
    MissingElement,
    RiskSeverity,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# In-memory task registry
# ---------------------------------------------------------------------------


@dataclass
class _TaskState:
    """Mutable per-task record kept in the in-memory registry."""

    audit_task_id: UUID
    session_id: UUID
    status: AuditStatus = AuditStatus.PENDING
    progress: int = 0
    stage: str = "queued"
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    error: ErrorDetail | None = None
    report: AuditReport | None = None


class MockAgentService:
    """Async-safe mock pipeline orchestrator."""

    # Pipeline stages with relative weights summing to 100.
    _STAGES: tuple[tuple[str, int], ...] = (
        ("ingesting_documents", 10),
        ("extracting_entities", 20),
        ("cross_document_consistency_check", 25),
        ("benchmark_analysis", 25),
        ("regulatory_completeness_check", 15),
        ("compiling_report", 5),
    )

    def __init__(self) -> None:
        self._tasks: dict[UUID, _TaskState] = {}
        self._lock = asyncio.Lock()

    # -- Public API ---------------------------------------------------------

    async def register_task(self, session_id: UUID) -> UUID:
        """Allocate a new task id in PENDING state."""
        task_id = uuid4()
        async with self._lock:
            self._tasks[task_id] = _TaskState(
                audit_task_id=task_id, session_id=session_id
            )
        logger.info("audit task registered task_id=%s session_id=%s", task_id, session_id)
        return task_id

    async def get_task(self, task_id: UUID) -> _TaskState | None:
        async with self._lock:
            return self._tasks.get(task_id)

    async def run_pipeline(self, task_id: UUID) -> None:
        """Background entry point. Drives a task from PENDING to COMPLETED/FAILED."""
        state = await self.get_task(task_id)
        assert state is not None, f"run_pipeline called for unknown task_id={task_id}"
        assert state.status == AuditStatus.PENDING, (
            f"run_pipeline expected PENDING, got {state.status} for task_id={task_id}"
        )

        try:
            await self._update(task_id, status=AuditStatus.IN_PROGRESS, stage="starting", progress=0)

            cumulative = 0
            for stage_name, weight in self._STAGES:
                # Each stage takes ~3-5s, summing to ~20-30s end-to-end.
                await asyncio.sleep(random.uniform(3.0, 5.0))
                cumulative += weight
                await self._update(task_id, stage=stage_name, progress=cumulative)
                logger.debug(
                    "task=%s stage=%s progress=%d", task_id, stage_name, cumulative
                )

            report = self._build_mock_report(state.session_id, task_id)
            await self._update(
                task_id,
                status=AuditStatus.COMPLETED,
                stage="done",
                progress=100,
                report=report,
            )
            logger.info("audit task completed task_id=%s", task_id)

        except asyncio.CancelledError:
            await self._update(
                task_id,
                status=AuditStatus.FAILED,
                stage="cancelled",
                error=ErrorDetail(code="TASK_CANCELLED", message="Audit task was cancelled."),
            )
            raise
        except Exception as exc:  # noqa: BLE001 — fail-fast surface for the mock
            logger.exception("audit task crashed task_id=%s", task_id)
            await self._update(
                task_id,
                status=AuditStatus.FAILED,
                stage="error",
                error=ErrorDetail(
                    code="PIPELINE_FAILURE",
                    message="Mock agent pipeline raised an unexpected exception.",
                    details={"exception": type(exc).__name__, "args": [str(a) for a in exc.args]},
                ),
            )

    # -- Internal helpers ---------------------------------------------------

    async def _update(self, task_id: UUID, **changes: object) -> None:
        async with self._lock:
            state = self._tasks.get(task_id)
            if state is None:
                raise KeyError(f"unknown task_id={task_id}")
            for key, value in changes.items():
                setattr(state, key, value)
            state.updated_at = datetime.now(timezone.utc)

    @staticmethod
    def _build_mock_report(session_id: UUID, task_id: UUID) -> AuditReport:
        """Deterministic-looking but mocked structured findings."""
        consistency_errors = [
            ConsistencyError(
                description=(
                    "Operating margin reported in Local File (4.2%) does not match "
                    "the figure derived from the supporting financial annex (3.7%)."
                ),
                severity=RiskSeverity.HIGH,
                locations=[
                    ErrorLocation(filename="local_file.pdf", line_numbers=[12, 15]),
                    ErrorLocation(filename="financial_annex.pdf", line_numbers=[8]),
                ],
                evidence="Local File §3.2 vs. Annex II table 4",
            ),
            ConsistencyError(
                description=(
                    "Master File describes a centralized R&D function while the "
                    "intercompany services contract attributes R&D costs locally."
                ),
                severity=RiskSeverity.MEDIUM,
                locations=[
                    ErrorLocation(filename="master_file.pdf", line_numbers=[42]),
                    ErrorLocation(filename="service_agreement.pdf", line_numbers=[31, 32]),
                ],
                evidence="Master File §5 vs. Service Agreement clause 7.1",
            ),
        ]

        benchmark_risks = [
            BenchmarkRisk(
                metric="operating_margin",
                observed_value=3.7,
                benchmark_range=(4.5, 7.8),
                severity=RiskSeverity.HIGH,
                rationale=(
                    "Observed margin falls below the interquartile range of comparable "
                    "distributors in the benchmark study."
                ),
                locations=[
                    ErrorLocation(filename="intercompany_contract_2023.pdf", line_numbers=[19, 20]),
                ],
            ),
            BenchmarkRisk(
                metric="royalty_rate",
                observed_value=6.0,
                benchmark_range=(2.0, 5.0),
                severity=RiskSeverity.MEDIUM,
                rationale="Royalty rate exceeds the upper quartile of the comparable set.",
                locations=[
                    ErrorLocation(filename="license_agreement.pdf", line_numbers=[7]),
                    ErrorLocation(filename="local_file.pdf", line_numbers=[55]),
                ],
            ),
        ]

        missing_elements = [
            MissingElement(
                description="Functional analysis of low-value intra-group services is absent.",
                expected_in="local_file.pdf",
                required_by="OECD TPG 2022, Chapter VII",
                severity=RiskSeverity.MEDIUM,
            ),
            MissingElement(
                description="Country-by-Country reporting reconciliation table is not provided.",
                expected_in="master_file.pdf",
                required_by="Hungarian Act LXXXI of 1996, §31/B",
                severity=RiskSeverity.HIGH,
            ),
        ]

        return AuditReport(
            audit_task_id=task_id,
            session_id=session_id,
            generated_at=datetime.now(timezone.utc),
            consistency_errors=consistency_errors,
            benchmark_risks=benchmark_risks,
            missing_elements=missing_elements,
            overall_risk=RiskSeverity.HIGH,
            summary=(
                "Audit identified material inconsistencies between Master and Local "
                "Files and benchmark deviations on margin and royalty metrics. "
                "Two mandatory documentation elements are missing."
            ),
        )


# Module-level singleton — intentionally simple for the PoC. Wired via DI in
# main.py so endpoints depend on the abstract instance, not the global.
mock_agent_service = MockAgentService()
