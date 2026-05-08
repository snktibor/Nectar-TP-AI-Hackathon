"""RAG service — vector retrieval over legal knowledge and per-job documents.

Two ChromaDB collections:
- ``legal_knowledge``: static index of rulesets/ PDFs (laws, OECD guidelines).
  Built once with ``scripts/index_rulesets.py``.
- ``session_{session_id}``: per-session index of uploaded TP documents.
  Written by ``vector_store.store_chunks``; queried here by the agent pipeline.

Both collections use paraphrase-multilingual-MiniLM-L12-v2 so embeddings
are consistent across legal and document queries.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

CHROMA_PATH = Path(__file__).parent.parent.parent / "data" / "chromadb"
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
LEGAL_COLLECTION = "legal_knowledge"


@dataclass(frozen=True)
class RagChunk:
    """A single retrieved text chunk with full provenance."""

    text: str
    source: str
    page: int
    chunk_index: int
    score: float


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
        return self._parse_results(results)

    def query_session_documents(
        self, session_id: UUID, query: str, n_results: int = 5
    ) -> list[RagChunk]:
        """Retrieve chunks from uploaded TP documents for a specific session."""
        collection_name = f"session_{str(session_id).replace('-', '_')}"
        try:
            collection = self._client.get_collection(
                collection_name, embedding_function=self._embed
            )
        except Exception:
            return []
        results = collection.query(query_texts=[query], n_results=n_results)
        return self._parse_results(results)

    # -- Internal --------------------------------------------------------------

    @staticmethod
    def _parse_results(results: dict[str, Any]) -> list[RagChunk]:
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        return [
            RagChunk(
                text=doc,
                source=meta.get("file_name") or meta.get("source", ""),
                page=int(meta.get("chapter_or_page", "page_0").replace("page_", "") or meta.get("page", 0)),
                chunk_index=int(meta.get("chunk_index", 0)),
                score=round(1.0 - float(dist), 4),
            )
            for doc, meta, dist in zip(docs, metas, distances)
        ]


# Module-level singleton — matches the pattern of mock_agent_service.
rag_service = RagService()
