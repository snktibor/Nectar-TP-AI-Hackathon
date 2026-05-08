"""ChromaDB vector storage for document chunks.

Provides session-scoped collections with traceability metadata on every
chunk. Uses paraphrase-multilingual-MiniLM-L12-v2 for HU+EN support —
the same model used by the legal_knowledge collection in rag_service.py
so that cross-collection queries are embedding-consistent.
"""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import UUID

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from app.services.chunker import TextChunk

logger = logging.getLogger(__name__)

_CHROMA_DIR = Path(__file__).resolve().parents[2] / "data" / "chromadb"
_EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

_embed = SentenceTransformerEmbeddingFunction(model_name=_EMBED_MODEL)


def _get_client() -> chromadb.ClientAPI:
    _CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(_CHROMA_DIR))


def _collection_name(session_id: UUID) -> str:
    return f"session_{str(session_id).replace('-', '_')}"


def store_chunks(session_id: UUID, chunks: list[TextChunk]) -> int:
    """Store text chunks in a session-scoped ChromaDB collection.

    Returns the number of chunks stored.
    """
    if not chunks:
        return 0

    client = _get_client()
    collection = client.get_or_create_collection(
        name=_collection_name(session_id),
        embedding_function=_embed,
        metadata={"hnsw:space": "cosine"},
    )

    ids = [c.chunk_id for c in chunks]
    documents = [c.text for c in chunks]
    metadatas = [
        {
            "file_name": c.file_name,
            "doc_type": c.doc_type,
            "chapter_or_page": c.chapter_or_page,
            "chunk_index": c.chunk_index,
            "char_start": c.char_start,
            "char_end": c.char_end,
        }
        for c in chunks
    ]

    batch_size = 100
    stored = 0
    for i in range(0, len(ids), batch_size):
        end = min(i + batch_size, len(ids))
        collection.add(
            ids=ids[i:end],
            documents=documents[i:end],
            metadatas=metadatas[i:end],
        )
        stored += end - i

    logger.info(
        "Stored %d chunks in collection %s",
        stored,
        _collection_name(session_id),
    )
    return stored


def query_chunks(
    session_id: UUID,
    query_text: str,
    n_results: int = 5,
    doc_type_filter: str | None = None,
) -> list[dict]:
    """Query chunks from a session collection.

    Returns list of dicts with 'text', 'metadata', and 'distance' keys.
    """
    client = _get_client()
    collection_name = _collection_name(session_id)

    try:
        collection = client.get_collection(name=collection_name, embedding_function=_embed)
    except Exception:
        return []

    where_filter = {"doc_type": doc_type_filter} if doc_type_filter else None

    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where=where_filter,
    )

    output: list[dict] = []
    if results["documents"] and results["documents"][0]:
        for i, doc in enumerate(results["documents"][0]):
            entry: dict = {
                "text": doc,
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": results["distances"][0][i] if results["distances"] else None,
            }
            output.append(entry)

    return output
