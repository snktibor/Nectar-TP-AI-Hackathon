"""RAG service — vector retrieval over legal knowledge and per-document RAGs.

ChromaDB collections:
- ``legal_knowledge``: static index of rulesets/ PDFs (laws, OECD guidelines).
  Built once with ``scripts/index_rulesets.py``.
- ``doc_{document_id}``: one collection per uploaded document, written by
  ``vector_store.store_chunks``. Each per-document agent queries exactly one
  of these; the cross-document consistency agent fans out across all
  collections that share the same ``session_id`` in their metadata.

All collections share paraphrase-multilingual-MiniLM-L12-v2 so similarity
scores remain comparable across legal and uploaded-document queries.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from app.models.schemas import DocumentType, EvidenceChunk

CHROMA_PATH = Path(__file__).parent.parent.parent / "data" / "chromadb"
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
LEGAL_COLLECTION = "legal_knowledge"


@dataclass(frozen=True)
class RagChunk:
    """A single retrieved text chunk with full provenance.

    `char_start` / `char_end` are pulled from ChromaDB metadata when present
    (the ingest pipeline writes them via `ChunkMetadata`). They let the UI
    highlight the precise span when the user clicks a finding.
    `source_kind` distinguishes legal-corpus chunks from uploaded-document
    chunks so the frontend routes the click-through to the right viewer.
    """

    text: str
    source: str
    page: int
    chunk_index: int
    score: float
    char_start: int | None = None
    char_end: int | None = None
    source_kind: str = "document"


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class RagService:
    """Thin wrapper around ChromaDB providing query operations for agents."""

    def __init__(self) -> None:
        CHROMA_PATH.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=str(CHROMA_PATH))
        self._embed = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)

    # -- Query -----------------------------------------------------------------

    def query_legal_knowledge(self, query: str, n_results: int = 5) -> list[RagChunk]:
        """Retrieve the most relevant chunks from the static legal knowledge base."""
        try:
            collection = self._client.get_collection(
                LEGAL_COLLECTION, embedding_function=self._embed
            )
        except Exception:
            return []
        results = collection.query(query_texts=[query], n_results=n_results)
        return self._parse_results(results, source_kind="legal")

    def query_document(
        self, document_id: UUID, query: str, n_results: int = 5
    ) -> list[RagChunk]:
        """Retrieve chunks from a single uploaded document's RAG."""
        collection_name = f"doc_{str(document_id).replace('-', '_')}"
        try:
            collection = self._client.get_collection(
                collection_name, embedding_function=self._embed
            )
        except Exception:
            return []
        results = collection.query(query_texts=[query], n_results=n_results)
        return self._parse_results(results)

    def query_session_documents(
        self, session_id: UUID, query: str, n_results_per_doc: int = 3
    ) -> list[RagChunk]:
        """Fan-out query across every per-document RAG in a session.

        Used by the cross-document consistency agent.
        """
        merged: list[RagChunk] = []
        target = str(session_id)
        for col_summary in self._client.list_collections():
            meta = col_summary.metadata or {}
            if meta.get("session_id") != target:
                continue
            try:
                collection = self._client.get_collection(
                    col_summary.name, embedding_function=self._embed
                )
            except Exception:
                continue
            results = collection.query(query_texts=[query], n_results=n_results_per_doc)
            merged.extend(self._parse_results(results))
        merged.sort(key=lambda c: -c.score)
        return merged

    # -- Agent-facing combined query -------------------------------------------

    async def query_context(
        self,
        session_id: UUID,
        doc_type: DocumentType,
        query: str,
        n_results: int = 5,
    ) -> list[EvidenceChunk]:
        """Combined retrieval: per-doc RAG (filtered by doc_type) + legal knowledge.

        Called by every specialist agent in ``base.py``. ChromaDB is sync so we
        run both queries in a thread pool and merge the results before returning.
        """
        doc_chunks, legal_chunks = await asyncio.gather(
            asyncio.to_thread(
                self._query_session_by_doc_type,
                session_id,
                doc_type,
                query,
                n_results,
            ),
            asyncio.to_thread(
                self.query_legal_knowledge,
                query,
                max(2, n_results // 2),
            ),
        )
        merged = doc_chunks + legal_chunks
        merged.sort(key=lambda c: -c.score)
        return [
            EvidenceChunk(
                filename=c.source,
                page=c.page,
                chunk_index=c.chunk_index,
                quote=c.text[:500] if c.text else None,
                char_start=c.char_start,
                char_end=c.char_end,
                source_kind="legal" if c.source_kind == "legal" else "document",
            )
            for c in merged[:n_results]
        ]

    async def query_cross_doc_context(
        self,
        session_id: UUID,
        query: str,
        n_results: int = 8,
    ) -> list[EvidenceChunk]:
        """Cross-document retrieval for the consistency agent.

        Fans out across EVERY per-document collection in the session (no
        doc_type filter) and merges with the static legal knowledge base.
        Used by the cross-document consistency agent so it can spot
        contradictions between e.g. Master File claims and Local File facts,
        with the relevant legal context attached.
        """
        legal_n = max(2, n_results // 3)
        doc_chunks, legal_chunks = await asyncio.gather(
            asyncio.to_thread(
                self.query_session_documents,
                session_id,
                query,
                max(2, n_results // 2),
            ),
            asyncio.to_thread(
                self.query_legal_knowledge,
                query,
                legal_n,
            ),
        )
        merged = doc_chunks + legal_chunks
        merged.sort(key=lambda c: -c.score)
        return [
            EvidenceChunk(
                filename=c.source,
                page=c.page,
                chunk_index=c.chunk_index,
                quote=c.text[:500] if c.text else None,
                char_start=c.char_start,
                char_end=c.char_end,
                source_kind="legal" if c.source_kind == "legal" else "document",
            )
            for c in merged[:n_results]
        ]

    def _query_session_by_doc_type(
        self,
        session_id: UUID,
        doc_type: DocumentType,
        query: str,
        n_results: int,
    ) -> list[RagChunk]:
        """Sync: fan-out query across per-document collections matching doc_type."""
        target_session = str(session_id)
        target_type = doc_type.value
        merged: list[RagChunk] = []
        for col_summary in self._client.list_collections():
            meta = col_summary.metadata or {}
            if meta.get("session_id") != target_session:
                continue
            if meta.get("doc_type") != target_type:
                continue
            try:
                collection = self._client.get_collection(
                    col_summary.name, embedding_function=self._embed
                )
            except Exception:
                continue
            results = collection.query(query_texts=[query], n_results=n_results)
            merged.extend(self._parse_results(results))
        merged.sort(key=lambda c: -c.score)
        return merged

    def list_session_documents(self, session_id: UUID) -> list[dict[str, Any]]:
        """Enumerate the per-document collections registered for ``session_id``."""
        target = str(session_id)
        out: list[dict[str, Any]] = []
        for col in self._client.list_collections():
            meta = col.metadata or {}
            if meta.get("session_id") != target:
                continue
            out.append(
                {
                    "document_id": meta.get("document_id"),
                    "filename": meta.get("filename"),
                    "doc_type": meta.get("doc_type"),
                    "collection": col.name,
                    "chunk_count": col.count(),
                }
            )
        return out

    # -- Internal --------------------------------------------------------------

    @staticmethod
    def _parse_results(
        results: dict[str, Any], *, source_kind: str = "document"
    ) -> list[RagChunk]:
        docs = (results.get("documents") or [[]])[0]
        metas = (results.get("metadatas") or [[]])[0]
        distances = (results.get("distances") or [[]])[0]
        parsed: list[RagChunk] = []
        for doc, meta, dist in zip(docs, metas, distances):
            page_raw = str(meta.get("chapter_or_page") or meta.get("page") or "0")
            page_num = int("".join(ch for ch in page_raw if ch.isdigit()) or 0)

            cs_raw = meta.get("char_start")
            ce_raw = meta.get("char_end")
            char_start = int(cs_raw) if isinstance(cs_raw, (int, float)) else None
            char_end = int(ce_raw) if isinstance(ce_raw, (int, float)) else None

            parsed.append(
                RagChunk(
                    text=doc,
                    source=meta.get("file_name") or meta.get("source") or meta.get("filename", ""),
                    page=page_num,
                    chunk_index=int(meta.get("chunk_index", 0)),
                    score=round(1.0 - float(dist), 4),
                    char_start=char_start,
                    char_end=char_end,
                    source_kind=source_kind,
                )
            )
        return parsed


# Module-level singleton — matches the pattern of mock_agent_service.
rag_service = RagService()
