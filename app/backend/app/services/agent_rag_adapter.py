"""Adapter: bridges the real RagService to the async Protocol used by agents.

The parallel team's RagService (app.services.rag_service) exposes synchronous
ChromaDB queries returning RagChunk dataclasses. Specialist agents depend on:

    async def query_context(session_id, doc_type, query, n_results) -> list[EvidenceChunk]

AgentRagAdapter satisfies that Protocol without touching the parallel team's code by:
  1. Running synchronous RagService calls in a thread-pool executor (never blocks the loop).
  2. Mapping RagChunk → EvidenceChunk field-by-field.

doc_type is accepted for Protocol compatibility and is available for future
per-type collection filtering. The current implementation fans out over the
full session via query_session_documents — safer than accidentally excluding
a document whose doc_type metadata differs from the agent's expected value.
"""

from __future__ import annotations

import asyncio
from uuid import UUID

from app.models.schemas import DocumentType, EvidenceChunk
from app.services.rag_service import RagChunk, RagService


def _to_evidence_chunk(chunk: RagChunk) -> EvidenceChunk:
    return EvidenceChunk(
        filename=chunk.source,
        page=chunk.page,
        chunk_index=chunk.chunk_index,
        quote=chunk.text[:500] if chunk.text else None,
    )


class AgentRagAdapter:
    """Async adapter wrapping the synchronous RagService for specialist agents.

    Instantiate once per process and reuse; the underlying ChromaDB client is
    thread-safe for concurrent reads so parallel agent calls are safe.
    """

    def __init__(self, real_rag: RagService) -> None:
        self._rag = real_rag

    async def query_context(
        self,
        session_id: UUID,
        doc_type: DocumentType,
        query: str,
        n_results: int = 5,
    ) -> list[EvidenceChunk]:
        loop = asyncio.get_running_loop()
        raw: list[RagChunk] = await loop.run_in_executor(
            None,
            lambda: self._rag.query_session_documents(
                session_id, query, n_results_per_doc=n_results
            ),
        )
        return [_to_evidence_chunk(c) for c in raw[:n_results]]
