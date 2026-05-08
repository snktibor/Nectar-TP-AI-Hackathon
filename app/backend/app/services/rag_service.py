"""RAG service — vector retrieval over legal knowledge and per-job documents.

Two ChromaDB collections:
- ``legal_knowledge``: static index of rulesets/ PDFs (laws, OECD guidelines).
  Built once with ``scripts/index_rulesets.py``.
- ``job_{job_id}``: per-audit index of the uploaded TP documents.
  Created by ``index_job_documents`` at the start of each pipeline run.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

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
# Chunking helper (shared with index_rulesets.py)
# ---------------------------------------------------------------------------


def chunk_text(text: str, size: int = 800, overlap: int = 150) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        chunk = text[start : start + size].strip()
        if chunk:
            chunks.append(chunk)
        start += size - overlap
    return chunks


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class RagService:
    """Thin wrapper around ChromaDB providing query and indexing operations."""

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

    def query_job_documents(
        self, job_id: str, query: str, n_results: int = 5
    ) -> list[RagChunk]:
        """Retrieve chunks from the uploaded TP documents for a specific audit job."""
        try:
            collection = self._client.get_collection(
                f"job_{job_id}", embedding_function=self._embed
            )
        except Exception:
            return []
        results = collection.query(query_texts=[query], n_results=n_results)
        return self._parse_results(results)

    # -- Indexing --------------------------------------------------------------

    def index_job_documents(
        self,
        job_id: str,
        chunks: list[tuple[str, str, int, int]],
    ) -> None:
        """Index uploaded document chunks for a given audit job.

        Args:
            job_id: Unique audit job identifier.
            chunks: List of ``(text, source_filename, page_number, chunk_index)``.
        """
        collection = self._client.get_or_create_collection(
            f"job_{job_id}", embedding_function=self._embed
        )
        ids = [f"{job_id}_{i}" for i in range(len(chunks))]
        documents = [c[0] for c in chunks]
        metadatas: list[dict[str, Any]] = [
            {"source": c[1], "page": c[2], "chunk_index": c[3]} for c in chunks
        ]
        _batch_add(collection, ids, documents, metadatas)

    def delete_job_index(self, job_id: str) -> None:
        """Remove the per-job collection after the audit is complete or failed."""
        try:
            self._client.delete_collection(f"job_{job_id}")
        except Exception:
            pass

    # -- Internal --------------------------------------------------------------

    @staticmethod
    def _parse_results(results: dict[str, Any]) -> list[RagChunk]:
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        return [
            RagChunk(
                text=doc,
                source=meta.get("source", ""),
                page=int(meta.get("page", 0)),
                chunk_index=int(meta.get("chunk_index", 0)),
                score=round(1.0 - float(dist), 4),
            )
            for doc, meta, dist in zip(docs, metas, distances)
        ]


def _batch_add(
    collection: chromadb.Collection,
    ids: list[str],
    documents: list[str],
    metadatas: list[dict[str, Any]],
    batch_size: int = 100,
) -> None:
    for i in range(0, len(ids), batch_size):
        collection.add(
            ids=ids[i : i + batch_size],
            documents=documents[i : i + batch_size],
            metadatas=metadatas[i : i + batch_size],
        )


# Module-level singleton — matches the pattern of mock_agent_service.
rag_service = RagService()
