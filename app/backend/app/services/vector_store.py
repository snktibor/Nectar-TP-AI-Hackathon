"""ChromaDB vector storage for document chunks.

Each uploaded document gets its own ChromaDB collection (``doc_{document_id}``)
so per-document agents can query a single document's RAG without contamination
from sibling files. Collection-level metadata records ``session_id`` and the
detected ``doc_type`` so a session-scoped or cross-document query can iterate
the right collections without relying on an external index.

Embedding model is paraphrase-multilingual-MiniLM-L12-v2 — same as
``rag_service.py`` for the legal_knowledge collection — so cross-collection
similarity scores remain comparable.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING
from uuid import UUID

from app.services.chunker import TextChunk
from app.services.chroma_client import (
    create_persistent_chroma_client,
    create_sentence_transformer_embedding_function,
)

if TYPE_CHECKING:
    import chromadb

logger = logging.getLogger(__name__)

_EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

_embed = create_sentence_transformer_embedding_function(model_name=_EMBED_MODEL)


def _get_client() -> chromadb.ClientAPI:
    return create_persistent_chroma_client()


def _collection_name(document_id: UUID) -> str:
    return f"doc_{str(document_id).replace('-', '_')}"


def _normalize_session(session_id: UUID) -> str:
    return str(session_id)


def store_chunks(
    session_id: UUID,
    document_id: UUID,
    chunks: list[TextChunk],
    *,
    filename: str,
    doc_type: str,
) -> int:
    """Store text chunks in a per-document ChromaDB collection.

    The collection is named ``doc_{document_id}`` and carries
    ``session_id`` / ``document_id`` / ``filename`` / ``doc_type`` in its
    own metadata so that cross-document iterators can filter by session
    without consulting an external registry.
    """
    if not chunks:
        return 0

    client = _get_client()
    collection = client.get_or_create_collection(
        name=_collection_name(document_id),
        embedding_function=_embed,
        metadata={
            "hnsw:space": "cosine",
            "session_id": _normalize_session(session_id),
            "document_id": str(document_id),
            "filename": filename,
            "doc_type": doc_type,
        },
    )

    ids = [c.chunk_id for c in chunks]
    documents = [c.text for c in chunks]
    metadatas = [
        {
            "session_id": _normalize_session(session_id),
            "document_id": str(document_id),
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
        "Stored %d chunks in collection %s (session=%s)",
        stored,
        _collection_name(document_id),
        session_id,
    )
    return stored


def _serialize_results(results: dict, document_id: UUID | None = None) -> list[dict]:
    output: list[dict] = []
    docs = results.get("documents") or [[]]
    metas = results.get("metadatas") or [[]]
    distances = results.get("distances") or [[]]
    if not docs or not docs[0]:
        return output
    for i, doc in enumerate(docs[0]):
        meta = metas[0][i] if metas and metas[0] else {}
        if document_id is not None and "document_id" not in meta:
            meta = {**meta, "document_id": str(document_id)}
        entry: dict = {
            "text": doc,
            "metadata": meta,
            "distance": distances[0][i] if distances and distances[0] else None,
        }
        output.append(entry)
    return output


def query_document(
    document_id: UUID,
    query_text: str,
    n_results: int = 5,
) -> list[dict]:
    """Query the RAG of a single uploaded document.

    Returns ``[]`` if the document was never ingested (no collection exists).
    """
    client = _get_client()
    try:
        collection = client.get_collection(
            name=_collection_name(document_id), embedding_function=_embed
        )
    except Exception:
        return []

    results = collection.query(query_texts=[query_text], n_results=n_results)
    return _serialize_results(results, document_id=document_id)


def list_session_documents(session_id: UUID) -> list[dict]:
    """List the per-document collections that belong to ``session_id``.

    Inspects collection metadata rather than naming conventions, so a
    document_id alone is sufficient for identification downstream.
    """
    client = _get_client()
    target = _normalize_session(session_id)
    out: list[dict] = []
    for col in client.list_collections():
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


def query_session(
    session_id: UUID,
    query_text: str,
    n_results_per_doc: int = 3,
) -> list[dict]:
    """Query every document collection in a session and merge the results.

    Each per-document query returns its top ``n_results_per_doc`` chunks;
    the merged list is sorted by distance (lowest = most similar). Used by
    the cross-document consistency agent.
    """
    client = _get_client()
    target = _normalize_session(session_id)
    merged: list[dict] = []

    for col_summary in client.list_collections():
        meta = col_summary.metadata or {}
        if meta.get("session_id") != target:
            continue
        try:
            collection = client.get_collection(
                name=col_summary.name, embedding_function=_embed
            )
        except Exception:
            continue
        results = collection.query(query_texts=[query_text], n_results=n_results_per_doc)
        merged.extend(_serialize_results(results))

    merged.sort(key=lambda r: r["distance"] if r["distance"] is not None else 1e9)
    return merged


def delete_document(document_id: UUID) -> bool:
    """Remove a document's RAG collection. Returns True if it existed."""
    client = _get_client()
    name = _collection_name(document_id)
    try:
        client.delete_collection(name=name)
        return True
    except Exception:
        return False
