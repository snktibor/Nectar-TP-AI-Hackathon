"""RAG query endpoints exposed for the agent layer.

Each uploaded document has its own ChromaDB collection (``doc_{document_id}``)
populated by the ingest pipeline. Agents call these endpoints to perform
retrieval against:

- a single document (per-document review agent),
- all documents in a session (cross-document consistency agent),
- the static legal knowledge base (OECD guidelines, NAV regulations).

The agent implementation lives outside this module — these endpoints are the
stable RAG surface it consumes.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from app.models.schemas import ApiResponse
from app.services.rag_service import RagChunk, rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["rag"])
_QUERY_DESCRIPTION = "Natural-language query."


# ---------------------------------------------------------------------------
# Response DTOs
# ---------------------------------------------------------------------------


class RagChunkOut(BaseModel):
    """Single retrieved chunk in the API envelope."""

    model_config = ConfigDict(extra="forbid")

    text: str
    source: str
    page: int = Field(..., ge=0)
    chunk_index: int = Field(..., ge=0)
    score: float
    char_start: int | None = Field(default=None, ge=0)
    char_end: int | None = Field(default=None, ge=0)
    source_kind: str = "document"
    source_id: str | None = None
    source_title: str | None = None
    source_url: str | None = None
    source_version: str | None = None
    section_id: str | None = None
    citation_label: str | None = None


class RagQueryResponse(BaseModel):
    """Standard response shape for any RAG query."""

    model_config = ConfigDict(extra="forbid")

    query: str
    n_results: int = Field(..., ge=0)
    chunks: list[RagChunkOut]


class SessionDocumentEntry(BaseModel):
    """One per-document RAG entry registered under a session."""

    model_config = ConfigDict(extra="forbid")

    document_id: str | None
    filename: str | None
    doc_type: str | None
    collection: str
    chunk_count: int = Field(..., ge=0)


class SessionDocumentsResponse(BaseModel):
    """Listing of every per-document RAG that belongs to a session."""

    model_config = ConfigDict(extra="forbid")

    session_id: UUID
    documents: list[SessionDocumentEntry]
    total: int = Field(..., ge=0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_out(chunks: list[RagChunk]) -> list[RagChunkOut]:
    return [
        RagChunkOut(
            text=c.text,
            source=c.source,
            page=c.page,
            chunk_index=c.chunk_index,
            score=c.score,
            char_start=c.char_start,
            char_end=c.char_end,
            source_kind=c.source_kind,
            source_id=c.source_id,
            source_title=c.source_title,
            source_url=c.source_url,
            source_version=c.source_version,
            section_id=c.section_id,
            citation_label=c.citation_label,
        )
        for c in chunks
    ]


def _validate_query(q: str) -> str:
    cleaned = q.strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_QUERY", "message": "Query string must not be empty."},
        )
    return cleaned


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get(
    "/legal/query",
    summary="Query the static legal knowledge RAG (OECD, NAV).",
)
async def query_legal(
    q: Annotated[str, Query(description=_QUERY_DESCRIPTION)],
    n_results: Annotated[int, Query(ge=1, le=25)] = 5,
    agent_scope: Annotated[
        str | None,
        Query(description="Optional agent/document scope used for source reranking."),
    ] = None,
    source_id: Annotated[
        list[str] | None,
        Query(description="Optional canonical legal source id filter. Repeat to pass multiple ids."),
    ] = None,
) -> ApiResponse[RagQueryResponse]:
    cleaned = _validate_query(q)
    source_ids = {item.strip() for item in source_id or [] if item.strip()}
    chunks = rag_service.query_legal_knowledge(
        cleaned,
        n_results=n_results,
        agent_scope=agent_scope,
        source_ids=source_ids,
    )
    payload = RagQueryResponse(query=cleaned, n_results=len(chunks), chunks=_to_out(chunks))
    return ApiResponse[RagQueryResponse](success=True, data=payload)


@router.get(
    "/documents/{document_id}/query",
    summary="Query a single document's RAG.",
)
async def query_document(
    document_id: UUID,
    q: Annotated[str, Query(description=_QUERY_DESCRIPTION)],
    n_results: Annotated[int, Query(ge=1, le=25)] = 5,
) -> ApiResponse[RagQueryResponse]:
    cleaned = _validate_query(q)
    chunks = rag_service.query_document(document_id, cleaned, n_results=n_results)
    payload = RagQueryResponse(query=cleaned, n_results=len(chunks), chunks=_to_out(chunks))
    return ApiResponse[RagQueryResponse](success=True, data=payload)


@router.get(
    "/sessions/{session_id}/query",
    summary="Fan-out query across every document RAG in a session.",
)
async def query_session(
    session_id: UUID,
    q: Annotated[str, Query(description=_QUERY_DESCRIPTION)],
    n_results_per_doc: Annotated[int, Query(ge=1, le=10)] = 3,
) -> ApiResponse[RagQueryResponse]:
    cleaned = _validate_query(q)
    chunks = rag_service.query_session_documents(
        session_id, cleaned, n_results_per_doc=n_results_per_doc
    )
    payload = RagQueryResponse(query=cleaned, n_results=len(chunks), chunks=_to_out(chunks))
    return ApiResponse[RagQueryResponse](success=True, data=payload)


@router.get(
    "/sessions/{session_id}/documents",
    summary="List every per-document RAG registered for a session.",
)
async def list_session_documents(
    session_id: UUID,
) -> ApiResponse[SessionDocumentsResponse]:
    rows: list[dict[str, Any]] = rag_service.list_session_documents(session_id)
    entries = [SessionDocumentEntry(**row) for row in rows]
    payload = SessionDocumentsResponse(
        session_id=session_id, documents=entries, total=len(entries)
    )
    return ApiResponse[SessionDocumentsResponse](success=True, data=payload)
