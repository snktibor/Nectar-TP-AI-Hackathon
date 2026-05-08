"""Dump a sample AuditReport JSON from the mock pipeline.

Run this whenever the schema or the mock content changes so the static
fixtures shipped to the frontend stay in sync.

    python -m scripts.dump_mock_audit

Writes:
    tests/fixtures/audit_report_sample.json   — final report (data payload)
    tests/fixtures/audit_status_running.json  — mid-flight status payload
    tests/fixtures/audit_status_done.json     — terminal status payload
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from uuid import UUID

from app.models.schemas import (
    ApiResponse,
    AuditStatus,
    AuditStatusResponse,
    ResponseMeta,
)
from app.services.mock_agent_service import MockAgentService

FIXTURE_DIR = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
SESSION_ID = UUID("7d2a1e10-9c5e-4f55-8a02-2f1e7b3d4a91")


async def main() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    svc = MockAgentService(total_seconds=0.0)

    task_id = await svc.register_task(SESSION_ID)
    await svc.run_pipeline(task_id)
    state = await svc.get_task(task_id)
    assert state is not None and state.report is not None

    # Final report wrapped in the standard envelope.
    report_envelope = ApiResponse(
        success=True,
        data=state.report,
        error=None,
        meta=ResponseMeta(),
    )
    _write(
        FIXTURE_DIR / "audit_report_sample.json",
        report_envelope.model_dump(mode="json"),
    )

    # Synthetic mid-flight status snapshot for polling demos.
    running_status = AuditStatusResponse(
        audit_task_id=state.audit_task_id,
        session_id=state.session_id,
        status=AuditStatus.IN_PROGRESS,
        progress=47,
        stage="agent:cross_doc_consistency_agent:running",
        started_at=state.started_at,
        updated_at=state.updated_at,
        error=None,
        agent_progress={
            "master_file_agent": "ok",
            "local_file_agent": "running",
            "benchmark_agent": "running",
            "contract_agent": "pending",
            "invoice_agent": "pending",
            "cross_doc_consistency_agent": "running",
        },
    )
    _write(
        FIXTURE_DIR / "audit_status_running.json",
        ApiResponse(success=True, data=running_status, error=None, meta=ResponseMeta()).model_dump(mode="json"),
    )

    # Terminal status snapshot — mirrors what /audits/status returns post-completion.
    done_status = AuditStatusResponse(
        audit_task_id=state.audit_task_id,
        session_id=state.session_id,
        status=AuditStatus.COMPLETED,
        progress=100,
        stage="done",
        started_at=state.started_at,
        updated_at=state.updated_at,
        error=None,
        agent_progress=state.agent_progress,
    )
    _write(
        FIXTURE_DIR / "audit_status_done.json",
        ApiResponse(success=True, data=done_status, error=None, meta=ResponseMeta()).model_dump(mode="json"),
    )

    print(f"Wrote fixtures to {FIXTURE_DIR}")


def _write(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
