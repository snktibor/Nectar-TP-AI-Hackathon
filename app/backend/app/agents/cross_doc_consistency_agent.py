"""Cross-document consistency specialist.

Unlike the per-document agents, this one queries every per-document RAG in
the session AND the legal knowledge collection in a single fan-out, so it
can detect contradictions BETWEEN documents and between a document and the
cited law.

The dispatcher in `base.py` is reused; only the search-context handler is
overridden so the RAG call does not filter by `doc_type`.
"""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar, Protocol, runtime_checkable
from uuid import UUID

from app.agents.base import ChunkKey, DocumentTypeAgent, _format_chunks
from app.models.schemas import DocumentType, EvidenceChunk


@runtime_checkable
class CrossDocRagService(Protocol):
    """Expanded RAG contract: cross-doc fan-out + legal knowledge merge."""

    async def query_cross_doc_context(
        self,
        session_id: UUID,
        query: str,
        n_results: int = 8,
    ) -> list[EvidenceChunk]: ...


class CrossDocConsistencyAgent(DocumentTypeAgent):
    """Compares claims across the entire session corpus + legal RAG."""

    agent_id: ClassVar[str] = "cross_doc_consistency_agent"
    doc_type: ClassVar[DocumentType] = DocumentType.CROSS_DOCUMENT
    prompt_path: ClassVar[Path] = (
        Path(__file__).parent / "prompts" / "cross_doc_consistency_v1.md"
    )
    prompt_version: ClassVar[str] = "cross_doc_consistency_v1"

    def initial_user_message(self, session_id: UUID) -> str:
        return (
            f"You are reviewing the full transfer-pricing package uploaded in "
            f"session {session_id}. Your goal is cross-document consistency: "
            "compare entity roles, transaction values, declared TP methods, "
            "intangible ownership, dates, and policy statements across the "
            "Master File, Local File, contracts, invoices, and benchmark study, "
            "and weigh them against the legal corpus (32/2017 NGM, OECD TPG, "
            "HU Act LXXXI). Issue several search_context queries — one per "
            "topic — before recording findings. Every consistency_error must "
            "cite at least two evidence chunks from different sources."
        )

    async def _handle_search_context(
        self,
        session_id: UUID,
        tool_input: dict[str, object],
        seen: set[ChunkKey],
        seen_lookup: dict[ChunkKey, "EvidenceChunk"],
    ) -> tuple[str, bool]:
        query_raw = tool_input.get("query")
        if not isinstance(query_raw, str) or not query_raw.strip():
            return ("query is required and must be a non-empty string.", True)
        n_raw = tool_input.get("n_results", 8)
        try:
            n_results = max(1, min(20, int(n_raw)))
        except (TypeError, ValueError):
            return ("n_results must be an integer in [1,20].", True)

        rag = self._rag
        if not hasattr(rag, "query_cross_doc_context"):
            return (
                "Configured RAG service does not support cross-document "
                "retrieval (missing query_cross_doc_context).",
                True,
            )
        chunks = await rag.query_cross_doc_context(  # type: ignore[attr-defined]
            session_id=session_id,
            query=query_raw,
            n_results=n_results,
        )
        for chunk in chunks:
            key = (chunk.filename, chunk.page, chunk.chunk_index)
            seen.add(key)
            seen_lookup[key] = chunk
        return (_format_chunks(chunks), False)
