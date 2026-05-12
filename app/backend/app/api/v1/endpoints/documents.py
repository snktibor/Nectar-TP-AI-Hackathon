"""Document resource endpoints.

Mocked storage layer: documents are kept in an in-memory dict keyed by session.
The service shape is intentionally close to what a real S3/db-backed
implementation would look like, so the routing layer does not need to change.

Session TTL: documents and file bytes for a session are retained for 24 hours.
Cleanup occurs opportunistically on list_documents and download_document calls.
"""

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.responses import Response

from app.core.rate_limiter import limiter
from app.models.schemas import (
    ApiResponse,
    DocumentListResponse,
    DocumentRecord,
    DocumentType,
    DocumentUploadResponse,
    IngestResponse,
)
from app.services.dataset_files import load_from_datasets
from app.services.file_response import build_file_response
from app.services.ingest_pipeline import ingest_batch

# Root of the backend package — used for the datasets fallback.
_BACKEND_ROOT = Path(__file__).resolve().parents[4]
_DATASETS_ROOT = _BACKEND_ROOT / "datasets"

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


# In-memory document registry. {session_id: {document_id: DocumentRecord}}.
_DOCUMENTS: dict[UUID, dict[UUID, DocumentRecord]] = {}

# Raw file bytes keyed by (session_id, filename). Max 5 × 50 MB = 250 MB/session — acceptable for PoC.
_FILE_BYTES: dict[tuple[UUID, str], bytes] = {}

# Session creation timestamps for TTL enforcement. {session_id: created_at}.
_SESSION_CREATED_AT: dict[UUID, datetime] = {}

_SESSION_TTL_HOURS = 24
_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB hard cap for the PoC.


def _cleanup_expired_sessions() -> None:
    """Remove sessions and files that exceed TTL. Called opportunistically."""
    now = datetime.now(timezone.utc)
    ttl_delta = timedelta(hours=_SESSION_TTL_HOURS)
    expired_sessions = [
        sid for sid, created_at in _SESSION_CREATED_AT.items()
        if now - created_at > ttl_delta
    ]
    for sid in expired_sessions:
        _DOCUMENTS.pop(sid, None)
        _SESSION_CREATED_AT.pop(sid, None)
        # Clean up file bytes for this session
        keys_to_delete = [k for k in _FILE_BYTES.keys() if k[0] == sid]
        for k in keys_to_delete:
            _FILE_BYTES.pop(k, None)
        logger.info("cleanup expired_session_id=%s ttl_hours=%d", sid, _SESSION_TTL_HOURS)


@router.post(
    "/upload",
    response_model=ApiResponse[DocumentUploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a transfer-pricing document for a session.",
)
@limiter.limit("5/minute")
async def upload_document(
    request: Request,
    session_id: UUID = Form(..., description="Session UUID this upload belongs to."),
    document_type: DocumentType = Form(..., description="Logical document category."),
    file: UploadFile = File(..., description="Binary document payload."),
) -> ApiResponse[DocumentUploadResponse]:
    """Accept a document upload, persist mock metadata, return its id."""
    # Track session creation time on first upload.
    if session_id not in _SESSION_CREATED_AT:
        _SESSION_CREATED_AT[session_id] = datetime.now(timezone.utc)

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

    _FILE_BYTES[(session_id, file.filename)] = payload

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
    # Opportunistically clean up expired sessions.
    _cleanup_expired_sessions()

    # Track session if first interaction.
    if session_id not in _SESSION_CREATED_AT:
        _SESSION_CREATED_AT[session_id] = datetime.now(timezone.utc)

    bucket = _DOCUMENTS.get(session_id, {})
    documents = sorted(bucket.values(), key=lambda d: d.uploaded_at)
    payload = DocumentListResponse(
        session_id=session_id,
        documents=documents,
        total=len(documents),
    )
    return ApiResponse[DocumentListResponse](success=True, data=payload)


_ACCEPTED_EXTENSIONS = {".pdf", ".docx"}
_MAX_INGEST_BYTES = 50 * 1024 * 1024


@router.post(
    "/ingest",
    response_model=ApiResponse[IngestResponse],
    status_code=status.HTTP_200_OK,
    summary="Batch ingest documents: parse, classify, chunk, and vectorize.",
)
@limiter.limit("3/minute")
async def ingest_documents(
    request: Request,
    session_id: Annotated[UUID, Form(description="Session UUID for this ingest batch.")],
    files: list[UploadFile] = File(..., description="PDF or DOCX files to ingest."),
) -> ApiResponse[IngestResponse]:
    """Accept multiple files, run the full ingest pipeline, return classification results."""
    # Track session creation time on first ingest.
    if session_id not in _SESSION_CREATED_AT:
        _SESSION_CREATED_AT[session_id] = datetime.now(timezone.utc)

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_FILES", "message": "At least one file is required."},
        )

    file_payloads: list[tuple[str, bytes]] = []
    for f in files:
        if not f.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_FILE", "message": "A file has no filename."},
            )

        ext = "." + f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
        if ext not in _ACCEPTED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "UNSUPPORTED_FILE_TYPE",
                    "message": f"File '{f.filename}' has unsupported type '{ext}'. Accepted: {', '.join(_ACCEPTED_EXTENSIONS)}.",
                },
            )

        payload = await f.read()
        if len(payload) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "EMPTY_FILE", "message": f"File '{f.filename}' is empty."},
            )
        if len(payload) > _MAX_INGEST_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "code": "FILE_TOO_LARGE",
                    "message": f"File '{f.filename}' exceeds {_MAX_INGEST_BYTES} byte limit.",
                },
            )

        file_payloads.append((f.filename, payload))
        _FILE_BYTES[(session_id, f.filename)] = payload

    results = await ingest_batch(session_id, file_payloads)

    processed = sum(1 for r in results if r.status == "success")
    failed = sum(1 for r in results if r.status == "failed")

    for doc in results:
        if doc.status == "success":
            record = DocumentRecord(
                document_id=doc.document_id,
                session_id=session_id,
                document_type=_map_doc_type(doc.detected_type),
                filename=doc.filename,
                size_bytes=doc.size_bytes,
                uploaded_at=datetime.now(timezone.utc),
            )
            _DOCUMENTS.setdefault(session_id, {})[record.document_id] = record

    response = IngestResponse(
        session_id=session_id,
        total_files=len(file_payloads),
        processed=processed,
        failed=failed,
        documents=results,
    )

    logger.info(
        "Ingest complete session_id=%s total=%d processed=%d failed=%d",
        session_id,
        len(file_payloads),
        processed,
        failed,
    )

    return ApiResponse[IngestResponse](success=True, data=response)


@router.get(
    "/{session_id}/file/{filename:path}",
    summary="Stream the original uploaded file bytes for in-browser viewing.",
)
async def download_document(
    session_id: UUID,
    filename: str,
    range_header: Annotated[str | None, Header(alias="Range")] = None,
) -> Response:
    """Return the raw bytes of a previously ingested file so the UI can render it.

    Falls back to the on-disk datasets/ folder so evidence chunks from the mock
    pipeline resolve even when the file was never explicitly uploaded in this session.
    """
    # Opportunistically clean up expired sessions.
    _cleanup_expired_sessions()

    payload = _FILE_BYTES.get((session_id, filename))

    if payload is None:
        payload = _load_from_datasets(filename)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FILE_NOT_FOUND", "message": f"No stored bytes for '{filename}' in session {session_id}."},
        )

    media_type = (
        "application/pdf"
        if filename.lower().endswith(".pdf")
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    return build_file_response(payload, filename, media_type, range_header)


def _load_from_datasets(filename: str) -> bytes | None:
    """Search datasets/ subdirectories for a file matching `filename` by name only.

    Returns the raw bytes if found, None otherwise. Prevents path traversal:
    only searches direct children of _DATASETS_ROOT, never traverses outside.
    """
    return load_from_datasets(_DATASETS_ROOT, filename)


def _map_doc_type(detected: str) -> DocumentType:
    """Map classifier output string to DocumentType enum."""
    mapping: dict[str, DocumentType] = {
        "master_file": DocumentType.MASTER_FILE,
        "local_file": DocumentType.LOCAL_FILE,
        "contract": DocumentType.CONTRACT,
        "benchmark_study": DocumentType.BENCHMARK_STUDY,
        "invoice": DocumentType.OTHER,
        "financial_statement": DocumentType.OTHER,
        "regulatory_document": DocumentType.OTHER,
        "other": DocumentType.OTHER,
    }
    return mapping.get(detected, DocumentType.OTHER)
