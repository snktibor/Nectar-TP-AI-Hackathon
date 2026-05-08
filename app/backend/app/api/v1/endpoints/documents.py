"""Document resource endpoints.

Mocked storage layer: documents are kept in an in-memory dict keyed by session.
The service shape is intentionally close to what a real S3/db-backed
implementation would look like, so the routing layer does not need to change.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.models.schemas import (
    ApiResponse,
    DocumentListResponse,
    DocumentRecord,
    DocumentType,
    DocumentUploadResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


# In-memory document registry. {session_id: {document_id: DocumentRecord}}.
_DOCUMENTS: dict[UUID, dict[UUID, DocumentRecord]] = {}

_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB hard cap for the PoC.


@router.post(
    "/upload",
    response_model=ApiResponse[DocumentUploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a transfer-pricing document for a session.",
)
async def upload_document(
    session_id: UUID = Form(..., description="Session UUID this upload belongs to."),
    document_type: DocumentType = Form(..., description="Logical document category."),
    file: UploadFile = File(..., description="Binary document payload."),
) -> ApiResponse[DocumentUploadResponse]:
    """Accept a document upload, persist mock metadata, return its id."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_FILE", "message": "Uploaded file has no filename."},
        )

    payload = await file.read()
    size_bytes = len(payload)
    if size_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_FILE", "message": "Uploaded file is empty."},
        )
    if size_bytes > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": f"Maximum upload size is {_MAX_UPLOAD_BYTES} bytes.",
            },
        )

    record = DocumentRecord(
        document_id=uuid4(),
        session_id=session_id,
        document_type=document_type,
        filename=file.filename,
        size_bytes=size_bytes,
        uploaded_at=datetime.now(timezone.utc),
    )
    _DOCUMENTS.setdefault(session_id, {})[record.document_id] = record
    logger.info(
        "document uploaded session_id=%s document_id=%s type=%s size=%d",
        session_id,
        record.document_id,
        document_type.value,
        size_bytes,
    )

    return ApiResponse[DocumentUploadResponse](
        success=True,
        data=DocumentUploadResponse(
            document_id=record.document_id,
            session_id=record.session_id,
            document_type=record.document_type,
            filename=record.filename,
            size_bytes=record.size_bytes,
            uploaded_at=record.uploaded_at,
        ),
    )


@router.get(
    "/{session_id}",
    response_model=ApiResponse[DocumentListResponse],
    summary="List all documents uploaded for a session.",
)
async def list_documents(session_id: UUID) -> ApiResponse[DocumentListResponse]:
    """Return every document tied to `session_id` (empty list if none)."""
    bucket = _DOCUMENTS.get(session_id, {})
    documents = sorted(bucket.values(), key=lambda d: d.uploaded_at)
    payload = DocumentListResponse(
        session_id=session_id,
        documents=documents,
        total=len(documents),
    )
    return ApiResponse[DocumentListResponse](success=True, data=payload)
