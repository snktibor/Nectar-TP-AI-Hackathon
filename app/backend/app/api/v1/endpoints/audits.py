"""Audit resource endpoints — the asynchronous polling engine.

POST /start -> register a task, fire-and-forget background pipeline, return 202.
GET  /status/{id} -> low-cost polling endpoint for the frontend.
GET  /results/{id} -> final structured report (only available once COMPLETED).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from app.models.schemas import (
    ApiResponse,
    AuditReport,
    AuditStartRequest,
    AuditStartResponse,
    AuditStatus,
    AuditStatusResponse,
)
from app.services.mock_agent_service import mock_agent_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audits", tags=["audits"])


@router.post(
    "/start",
    response_model=ApiResponse[AuditStartResponse],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue an audit pipeline run for a session.",
)
async def start_audit(
    payload: AuditStartRequest,
    background_tasks: BackgroundTasks,
) -> ApiResponse[AuditStartResponse]:
    """Register a new task and schedule the background pipeline."""
    task_id = await mock_agent_service.register_task(payload.session_id)

    # BackgroundTasks runs after the response is sent — perfect for
    # fire-and-forget LLM pipelines. For multi-worker deployments this should be
    # replaced by a real queue (Celery, Arq, RQ).
    background_tasks.add_task(mock_agent_service.run_pipeline, task_id)

    logger.info(
        "audit accepted session_id=%s audit_task_id=%s", payload.session_id, task_id
    )
    return ApiResponse[AuditStartResponse](
        success=True,
        data=AuditStartResponse(
            audit_task_id=task_id,
            session_id=payload.session_id,
            status=AuditStatus.PENDING,
            accepted_at=datetime.now(timezone.utc),
        ),
    )


@router.get(
    "/status/{audit_task_id}",
    response_model=ApiResponse[AuditStatusResponse],
    summary="Poll the current status and progress of an audit task.",
)
async def get_audit_status(audit_task_id: UUID) -> ApiResponse[AuditStatusResponse]:
    state = await mock_agent_service.get_task(audit_task_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "AUDIT_TASK_NOT_FOUND",
                "message": f"No audit task with id={audit_task_id}.",
            },
        )

    return ApiResponse[AuditStatusResponse](
        success=True,
        data=AuditStatusResponse(
            audit_task_id=state.audit_task_id,
            session_id=state.session_id,
            status=state.status,
            progress=state.progress,
            stage=state.stage,
            started_at=state.started_at,
            updated_at=state.updated_at,
            error=state.error,
        ),
    )


@router.get(
    "/results/{audit_task_id}",
    response_model=ApiResponse[AuditReport],
    summary="Fetch the final structured audit report.",
)
async def get_audit_results(audit_task_id: UUID) -> ApiResponse[AuditReport]:
    state = await mock_agent_service.get_task(audit_task_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "AUDIT_TASK_NOT_FOUND",
                "message": f"No audit task with id={audit_task_id}.",
            },
        )

    if state.status == AuditStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "AUDIT_TASK_FAILED",
                "message": "Audit task failed; no report available.",
                "details": state.error.model_dump() if state.error else None,
            },
        )

    if state.status != AuditStatus.COMPLETED or state.report is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "AUDIT_NOT_READY",
                "message": (
                    f"Audit task is in state '{state.status.value}'. "
                    "Poll /status until it reaches 'completed'."
                ),
                "details": {"current_status": state.status.value, "progress": state.progress},
            },
        )

    return ApiResponse[AuditReport](success=True, data=state.report)
