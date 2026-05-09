"""Report download endpoint.

Serves a prebuilt PDF artifact with a freshly timestamped filename when the
direct-report flag is enabled. The frontend first calls /reports/availability
to decide whether to render a direct download link or fall back to the
in-browser @react-pdf renderer.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.core.settings import get_settings
from app.models.schemas import ApiResponse

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
    response_model=ApiResponse[dict[str, bool]],
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
