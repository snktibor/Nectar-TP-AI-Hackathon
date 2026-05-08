"""Orchestrator fan-out behaviour: parallelism, isolation, aggregation."""

from __future__ import annotations

import asyncio
from uuid import uuid4

import pytest
from pydantic import SecretStr

from app.agents.base import DocumentTypeAgent
from app.core.settings import Settings
from app.models.schemas import (
    AuditStatus,
    ConsistencyError,
    DocumentType,
    EvidenceChunk,
    FindingAttribution,
    RiskSeverity,
)
from app.services import agent_orchestrator
from app.services.agent_orchestrator import AgentOrchestrator
from tests.conftest import FakeRagService


def _attribution(agent_id: str, doc_type: DocumentType) -> FindingAttribution:
    return FindingAttribution(
        agent_id=agent_id,
        doc_type_scope=doc_type,
        confidence=0.9,
        evidence_chunks=[EvidenceChunk(filename="x.pdf", page=1, chunk_index=0)],
        prompt_version=f"{agent_id}_v1",
    )


def _settings() -> Settings:
    return Settings(  # type: ignore[arg-type]
        anthropic_api_key=SecretStr("test-key"),
        agent_timeout_s=2.0,
        max_tool_iterations=3,
    )


def _patch_agent_run(monkeypatch, agent_cls: type[DocumentTypeAgent], behaviour) -> None:
    """Replace `agent_cls.run` with `behaviour(self, session_id)`."""
    monkeypatch.setattr(agent_cls, "run", behaviour, raising=True)


@pytest.mark.asyncio
async def test_all_agents_succeed(monkeypatch, fake_rag: FakeRagService) -> None:
    from app.agents import AGENT_CLASSES
    from app.models.schemas import AgentRunResult
    from datetime import datetime, timezone

    async def _success(self, session_id):
        return AgentRunResult(
            agent_id=self.agent_id,
            doc_type_scope=self.doc_type,
            prompt_version=self.prompt_version,
            model="claude-sonnet-4-6",
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            tool_calls=1,
            input_tokens=10,
            output_tokens=5,
            cache_read_tokens=5,
            cache_creation_tokens=0,
            consistency_errors=[
                ConsistencyError(
                    description=f"finding from {self.agent_id}",
                    severity=RiskSeverity.MEDIUM,
                    attribution=_attribution(self.agent_id, self.doc_type),
                )
            ],
            status="ok",
        )

    for cls in AGENT_CLASSES:
        _patch_agent_run(monkeypatch, cls, _success)

    orch = AgentOrchestrator(rag=fake_rag, settings=_settings())  # type: ignore[arg-type]
    task_id = await orch.register_task(uuid4())
    await orch.run_pipeline(task_id)
    state = await orch.get_task(task_id)

    assert state is not None
    assert state.status == AuditStatus.COMPLETED
    assert state.report is not None
    assert len(state.report.agent_runs) == 5
    assert all(r.status == "ok" for r in state.report.agent_runs)
    assert len(state.report.consistency_errors) == 5
    # agent_progress reflects every agent's terminal state.
    assert all(v == "ok" for v in state.agent_progress.values())


@pytest.mark.asyncio
async def test_one_agent_times_out(monkeypatch, fake_rag: FakeRagService) -> None:
    from app.agents import AGENT_CLASSES, MasterFileAgent
    from app.models.schemas import AgentRunResult
    from datetime import datetime, timezone

    async def _success(self, session_id):
        return AgentRunResult(
            agent_id=self.agent_id,
            doc_type_scope=self.doc_type,
            prompt_version=self.prompt_version,
            model="claude-sonnet-4-6",
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            status="ok",
        )

    async def _slow(self, session_id):
        await asyncio.sleep(10)
        return None  # never reached

    for cls in AGENT_CLASSES:
        if cls is MasterFileAgent:
            _patch_agent_run(monkeypatch, cls, _slow)
        else:
            _patch_agent_run(monkeypatch, cls, _success)

    orch = AgentOrchestrator(rag=fake_rag, settings=_settings())  # type: ignore[arg-type]
    task_id = await orch.register_task(uuid4())
    await orch.run_pipeline(task_id)
    state = await orch.get_task(task_id)

    assert state is not None
    assert state.status == AuditStatus.COMPLETED  # 4 succeeded → audit OK
    assert state.report is not None
    statuses = {r.agent_id: r.status for r in state.report.agent_runs}
    assert statuses["master_file_agent"] == "timeout"
    assert sum(1 for s in statuses.values() if s == "ok") == 4
    assert state.agent_progress["master_file_agent"] == "timeout"


@pytest.mark.asyncio
async def test_all_agents_fail_yields_failed_audit(
    monkeypatch, fake_rag: FakeRagService
) -> None:
    from app.agents import AGENT_CLASSES

    async def _crash(self, session_id):
        raise RuntimeError("boom")

    for cls in AGENT_CLASSES:
        _patch_agent_run(monkeypatch, cls, _crash)

    orch = AgentOrchestrator(rag=fake_rag, settings=_settings())  # type: ignore[arg-type]
    task_id = await orch.register_task(uuid4())
    await orch.run_pipeline(task_id)
    state = await orch.get_task(task_id)

    assert state is not None
    assert state.status == AuditStatus.FAILED
    assert state.error is not None
    assert state.error.code == "ALL_AGENTS_FAILED"
    assert state.report is not None
    assert all(r.status == "error" for r in state.report.agent_runs)


@pytest.mark.asyncio
async def test_factory_returns_real_orchestrator_when_flag_on(
    monkeypatch, fake_rag: FakeRagService
) -> None:
    monkeypatch.setenv("REDLINE_USE_REAL_AGENTS", "true")
    monkeypatch.setenv("REDLINE_ANTHROPIC_API_KEY", "k")

    # Avoid importing the real RAG module (it depends on chromadb).
    monkeypatch.setattr(agent_orchestrator, "_resolve_rag_service", lambda: fake_rag)

    from app.core.settings import get_settings

    get_settings.cache_clear()
    # Reset the orchestrator singleton for isolation.
    agent_orchestrator._orchestrator = None

    svc = agent_orchestrator.get_audit_service()
    assert isinstance(svc, AgentOrchestrator)


@pytest.mark.asyncio
async def test_factory_returns_mock_when_flag_off(monkeypatch) -> None:
    monkeypatch.setenv("REDLINE_USE_REAL_AGENTS", "false")

    from app.core.settings import get_settings
    from app.services.mock_agent_service import mock_agent_service

    get_settings.cache_clear()
    agent_orchestrator._orchestrator = None

    svc = agent_orchestrator.get_audit_service()
    assert svc is mock_agent_service
