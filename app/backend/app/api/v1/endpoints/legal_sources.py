"""Read-only endpoints for official legal source metadata and PDFs."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, status
from fastapi.responses import Response

from app.models.schemas import ApiResponse, LegalSource, LegalSourceCatalogResponse
from app.services.file_response import build_file_response
from app.services.legal_source_catalog import load_legal_source_catalog

router = APIRouter(prefix="/legal-sources", tags=["legal-sources"])


@router.get(
    "",
    summary="List the pinned official legal source catalog.",
)
async def list_legal_sources(
    include_disabled: Annotated[
        bool,
        Query(description="Include catalog entries that are not indexed into legal RAG."),
    ] = True,
) -> ApiResponse[LegalSourceCatalogResponse]:
    catalog = load_legal_source_catalog()
    return ApiResponse[LegalSourceCatalogResponse](
        success=True,
        data=catalog.to_response(include_disabled=include_disabled),
    )


@router.get(
    "/{source_id}",
    summary="Return metadata for one official legal source.",
)
async def get_legal_source(source_id: str) -> ApiResponse[LegalSource]:
    catalog = load_legal_source_catalog()
    source = catalog.get_source(source_id)
    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "LEGAL_SOURCE_NOT_FOUND", "message": "Legal source not found."},
        )

    public_catalog = catalog.to_response(include_disabled=True)
    public_source = next(
        item for item in public_catalog.sources if item.source_id == source.source_id
    )
    return ApiResponse[LegalSource](success=True, data=public_source)


@router.get(
    "/{source_id}/file",
    summary="Stream a pinned official legal source PDF for in-browser viewing.",
)
async def download_legal_source_file(
    source_id: str,
    range_header: Annotated[str | None, Header(alias="Range")] = None,
) -> Response:
    catalog = load_legal_source_catalog()
    source = catalog.get_source(source_id)
    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "LEGAL_SOURCE_NOT_FOUND", "message": "Legal source not found."},
        )

    if source.local_path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "LEGAL_SOURCE_FILE_UNAVAILABLE", "message": "Legal source file is unavailable."},
        )

    try:
        file_path = catalog.resolve_local_path(source)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "LEGAL_SOURCE_CATALOG_INVALID", "message": "Legal source catalog path is invalid."},
        ) from exc

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "LEGAL_SOURCE_FILE_UNAVAILABLE", "message": "Legal source file is unavailable."},
        )

    return build_file_response(
        payload=file_path.read_bytes(),
        filename=Path(source.local_path).name,
        media_type="application/pdf",
        range_header=range_header,
    )