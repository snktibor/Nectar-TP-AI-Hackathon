"""Report download endpoint.

Serves a prebuilt PDF artifact with a freshly timestamped filename when the
direct-report flag is enabled. The frontend first calls /reports/availability
to decide whether to render a direct download link or fall back to the
enterprise print-template flow.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.core.settings import get_settings
from app.models.schemas import ApiResponse, AuditStatus, EnterpriseReportPayload
from app.services.agent_orchestrator import get_audit_service
from app.services.report_builder import build_enterprise_report_payload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
_DATASETS_ROOT = _BACKEND_ROOT / "datasets"
_SOURCE_PDF = _DATASETS_ROOT / "mock_document.pdf"


def _timestamped_filename() -> str:
    """Build a NectarTP report filename pinned to the current local time."""
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    return f"NectarTP_Report_{stamp}.pdf"


@router.get(
    "/availability",
    summary="Check whether a direct report download is available.",
)
async def get_report_availability() -> ApiResponse[dict[str, bool]]:
    settings = get_settings()
    available = bool(settings.mock_report_enabled and _SOURCE_PDF.is_file())
    return ApiResponse[dict[str, bool]](success=True, data={"available": available})


@router.get(
    "/download",
    response_class=FileResponse,
    summary="Download the latest compliance report PDF.",
)
async def get_report_download() -> FileResponse:
    settings = get_settings()
    if not settings.mock_report_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "REPORT_DOWNLOAD_UNAVAILABLE",
                "message": "Direct report download is not available.",
            },
        )

    assert _SOURCE_PDF.exists(), f"Missing source PDF at {_SOURCE_PDF}"
    assert _SOURCE_PDF.is_file(), f"Source path is not a file: {_SOURCE_PDF}"

    filename = _timestamped_filename()
    return FileResponse(
        path=_SOURCE_PDF,
        media_type="application/pdf",
        filename=filename,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get(
    "/enterprise/{audit_task_id}",
    summary="Build dynamic enterprise report payload for the extended PDF template.",
)
async def get_enterprise_report_payload(
    audit_task_id: UUID,
) -> ApiResponse[EnterpriseReportPayload]:
    """Return computed report sections for the 20+ page frontend template."""
    audit_service = get_audit_service()
    state = await audit_service.get_task(audit_task_id)
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
                "message": "Audit task failed; enterprise report payload is unavailable.",
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
                "details": {
                    "current_status": state.status.value,
                    "progress": state.progress,
                },
            },
        )

    payload = build_enterprise_report_payload(state.report)
    return ApiResponse[EnterpriseReportPayload](success=True, data=payload)
