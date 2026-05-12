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
import logging
import unicodedata
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any
from uuid import UUID

from app.core.settings import Settings, get_settings
from app.models.schemas import DocumentType, EvidenceChunk
from app.services.chroma_client import (
    create_persistent_chroma_client,
    create_sentence_transformer_embedding_function,
)

logger = logging.getLogger("nectar.rag")

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
    source_id: str | None = None
    source_title: str | None = None
    source_url: str | None = None
    source_version: str | None = None
    section_id: str | None = None
    citation_label: str | None = None
    agent_scopes: tuple[str, ...] = ()
    priority_topics: tuple[str, ...] = ()


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class RagService:
    """Thin wrapper around ChromaDB providing query operations for agents."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._client = create_persistent_chroma_client(
            path=self._settings.chroma_path,
            settings=self._settings,
        )
        self._embed = create_sentence_transformer_embedding_function(model_name=EMBED_MODEL)

    # -- Query -----------------------------------------------------------------

    def query_legal_knowledge(
        self,
        query: str,
        n_results: int = 5,
        *,
        agent_scope: str | None = None,
        source_ids: set[str] | None = None,
    ) -> list[RagChunk]:
        """Retrieve the most relevant chunks from the static legal knowledge base."""
        try:
            collection = self._client.get_collection(
                LEGAL_COLLECTION, embedding_function=self._embed
            )
            collection_count = collection.count()
            if collection_count == 0:
                return []
            candidate_count = min(collection_count, max(n_results, n_results * 4))
            results = collection.query(query_texts=[query], n_results=candidate_count)
            chunks = self._parse_results(results, source_kind="legal")
            if source_ids:
                chunks = [chunk for chunk in chunks if chunk.source_id in source_ids]
            return _rerank_legal_chunks(
                chunks,
                query=query,
                agent_scope=agent_scope,
                source_ids=source_ids or set(),
            )[:n_results]
        except Exception as exc:  # noqa: BLE001 — never crash an agent on legal-RAG hiccups
            logger.warning(
                "legal rag query skipped: error=%s: %s",
                type(exc).__name__,
                exc,
            )
            return []

    def query_document(
        self, document_id: UUID, query: str, n_results: int = 5
    ) -> list[RagChunk]:
        """Retrieve chunks from a single uploaded document's RAG."""
        collection_name = f"doc_{str(document_id).replace('-', '_')}"
        try:
            collection = self._client.get_collection(
                collection_name, embedding_function=self._embed
            )
            results = collection.query(query_texts=[query], n_results=n_results)
            return self._parse_results(results)
        except Exception as exc:  # noqa: BLE001 — survive missing/broken collections
            logger.warning(
                "doc rag query skipped: collection=%s error=%s: %s",
                collection_name,
                type(exc).__name__,
                exc,
            )
            return []

    def query_session_documents(
        self, session_id: UUID, query: str, n_results_per_doc: int = 3
    ) -> list[RagChunk]:
        """Fan-out query across every per-document RAG in a session.

        Used by the cross-document consistency agent. Same robustness contract
        as ``_query_session_by_doc_type``: broken collections are logged and
        skipped, never raised.
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
                results = collection.query(query_texts=[query], n_results=n_results_per_doc)
                merged.extend(self._parse_results(results))
            except Exception as exc:  # noqa: BLE001 — chromadb raises a wide tree
                logger.warning(
                    "cross-doc rag query skipped: collection=%s session=%s error=%s: %s",
                    col_summary.name,
                    target,
                    type(exc).__name__,
                    exc,
                )
                continue
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
                agent_scope=_legal_scope_for_doc_type(doc_type),
            ),
        )
        merged = doc_chunks + legal_chunks
        merged.sort(key=lambda c: -c.score)
        return [
            EvidenceChunk(
                filename=c.source,
                page=c.page,
                chunk_index=c.chunk_index,
                quote=c.text[:250] if c.text else None,
                char_start=c.char_start,
                char_end=c.char_end,
                source_kind="legal" if c.source_kind == "legal" else "document",
                source_id=c.source_id,
                source_title=c.source_title,
                source_url=c.source_url,
                source_version=c.source_version,
                section_id=c.section_id,
                citation_label=c.citation_label,
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
                agent_scope="cross_document",
            ),
        )
        merged = doc_chunks + legal_chunks
        merged.sort(key=lambda c: -c.score)
        return [
            EvidenceChunk(
                filename=c.source,
                page=c.page,
                chunk_index=c.chunk_index,
                quote=c.text[:250] if c.text else None,
                char_start=c.char_start,
                char_end=c.char_end,
                source_kind="legal" if c.source_kind == "legal" else "document",
                source_id=c.source_id,
                source_title=c.source_title,
                source_url=c.source_url,
                source_version=c.source_version,
                section_id=c.section_id,
                citation_label=c.citation_label,
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
        """Sync: fan-out query across per-document collections matching doc_type.

        Robust against broken / partially-persisted collections: ChromaDB can
        list a collection whose HNSW segment is missing on disk (typical after
        an interrupted ingest). Querying such a collection raises
        ``InternalError: Nothing found on disk``. We log and skip — losing one
        broken collection is far better than crashing the whole agent.
        """
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
                results = collection.query(query_texts=[query], n_results=n_results)
                merged.extend(self._parse_results(results))
            except Exception as exc:  # noqa: BLE001 — chromadb raises a wide tree
                logger.warning(
                    "rag query skipped: collection=%s session=%s doc_type=%s error=%s: %s",
                    col_summary.name,
                    target_session,
                    target_type,
                    type(exc).__name__,
                    exc,
                )
                continue
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
                    source_id=_metadata_text(meta.get("source_id")),
                    source_title=_metadata_text(meta.get("source_title")),
                    source_url=_metadata_text(
                        meta.get("source_url")
                        or meta.get("official_url")
                        or meta.get("download_url")
                    ),
                    source_version=_metadata_text(meta.get("source_version")),
                    section_id=_metadata_text(meta.get("section_id")),
                    citation_label=_metadata_text(meta.get("citation_label")),
                    agent_scopes=_metadata_tuple(meta.get("agent_scopes")),
                    priority_topics=_metadata_tuple(meta.get("priority_topics")),
                )
            )
        return parsed


def _legal_scope_for_doc_type(doc_type: DocumentType) -> str:
    """Map document types to legal-source priority scopes."""
    if doc_type == DocumentType.CROSS_DOCUMENT:
        return "cross_document"
    return doc_type.value


def _rerank_legal_chunks(
    chunks: list[RagChunk],
    *,
    query: str,
    agent_scope: str | None,
    source_ids: set[str],
) -> list[RagChunk]:
    """Apply deterministic legal-source boosts after vector retrieval."""
    normalized_query = _normalize_text(query)
    ranked: list[RagChunk] = []
    for chunk in chunks:
        boosted_score = chunk.score
        if agent_scope and (
            agent_scope in chunk.agent_scopes or "all" in chunk.agent_scopes
        ):
            boosted_score += 0.07
        if source_ids and chunk.source_id in source_ids:
            boosted_score += 0.06
        topic_hits = sum(
            1
            for topic in chunk.priority_topics
            if topic and _normalize_text(topic) in normalized_query
        )
        boosted_score += min(0.06, topic_hits * 0.015)
        ranked.append(replace(chunk, score=round(min(boosted_score, 1.0), 4)))

    ranked.sort(key=lambda chunk: chunk.score, reverse=True)
    return ranked


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(without_accents.split())


def _metadata_text(value: Any) -> str | None:
    """Return non-empty metadata values as strings."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _metadata_tuple(value: Any) -> tuple[str, ...]:
    text = _metadata_text(value)
    if text is None:
        return ()
    return tuple(part.strip() for part in text.split(",") if part.strip())


# Module-level singleton — matches the pattern of mock_agent_service.
rag_service = RagService()
