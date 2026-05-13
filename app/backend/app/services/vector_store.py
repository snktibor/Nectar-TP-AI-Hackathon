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
import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING
from uuid import UUID

from app.services.chunker import TextChunk
from app.services.chroma_client import (
    create_persistent_chroma_client,
    create_sentence_transformer_embedding_function,
)
from app.services.knowledge_graph import (
    deserialize_knowledge_triples,
    knowledge_entities,
    knowledge_graph,
    serialize_knowledge_triples,
)

try:
    from rank_bm25 import BM25Okapi
except ImportError:  # pragma: no cover - fallback path for minimal local installs
    BM25Okapi = None  # type: ignore[assignment]

if TYPE_CHECKING:
    import chromadb

logger = logging.getLogger(__name__)

_EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
_RRF_K = 60
_DENSE_WEIGHT = 0.5
_SPARSE_WEIGHT = 0.5
_TOKEN_PATTERN = re.compile(r"\d+/\d+|[\w/-]{2,}", re.UNICODE)

_embed = create_sentence_transformer_embedding_function(model_name=_EMBED_MODEL)


@dataclass(frozen=True)
class _SearchHit:
    key: str
    text: str
    metadata: dict
    distance: float | None
    score: float
    retrieval_modes: tuple[str, ...]


@dataclass(frozen=True)
class _SparseCorpus:
    documents: list[str]
    metadatas: list[dict]
    ids: list[str]
    tokenized_documents: list[list[str]]


@dataclass(frozen=True)
class _GraphHydrationContext:
    session_id: UUID
    document_id: UUID
    file_name: str
    doc_type: str


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
            "knowledge_triples": serialize_knowledge_triples(c.knowledge_triples),
            "knowledge_entities": knowledge_entities(c.knowledge_triples),
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

    knowledge_graph.remove_document(document_id)
    _add_chunks_to_graph(
        session_id=session_id,
        document_id=document_id,
        chunks=chunks,
    )

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


def query_collection_hybrid(
    collection: object,
    query_text: str,
    n_results: int = 5,
    *,
    session_id: UUID | str | None = None,
) -> list[dict]:
    """Query one Chroma collection with dense vector + BM25 sparse fusion.

    The output matches the legacy vector helper shape and adds a normalized
    ``score`` field. If sparse search or graph expansion is unavailable, dense
    Chroma retrieval remains the fallback.
    """
    count = _safe_collection_count(collection)
    if count == 0:
        return []

    candidate_count = min(count, max(n_results, n_results * 4))
    _hydrate_graph_from_collection(collection, session_id=session_id)
    expanded_query = knowledge_graph.expand_query(session_id=session_id, query=query_text)

    dense_hits = _dense_hits(collection, expanded_query, candidate_count)
    sparse_hits = _sparse_hits(collection, expanded_query, candidate_count)

    if dense_hits and sparse_hits:
        fused = _reciprocal_rank_fusion(dense_hits, sparse_hits, n_results)
    else:
        fused = (dense_hits or sparse_hits)[:n_results]

    if expanded_query != query_text:
        fused = [_with_retrieval_mode(hit, "graph_expanded") for hit in fused]

    return [_hit_to_legacy_dict(hit) for hit in fused]


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

    hybrid_results = query_collection_hybrid(
        collection,
        query_text,
        n_results=n_results,
        session_id=(collection.metadata or {}).get("session_id"),
    )
    if hybrid_results:
        return hybrid_results
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
        merged.extend(
            query_collection_hybrid(
                collection,
                query_text,
                n_results=n_results_per_doc,
                session_id=session_id,
            )
        )

    merged.sort(key=lambda r: float(r.get("score", 0.0)), reverse=True)
    return merged


def delete_document(document_id: UUID) -> bool:
    """Remove a document's RAG collection. Returns True if it existed."""
    client = _get_client()
    name = _collection_name(document_id)
    try:
        client.delete_collection(name=name)
        knowledge_graph.remove_document(document_id)
        return True
    except Exception:
        return False


def _dense_hits(collection: object, query_text: str, n_results: int) -> list[_SearchHit]:
    try:
        results = collection.query(query_texts=[query_text], n_results=n_results)
    except Exception as exc:  # noqa: BLE001 - sparse retrieval can still recover.
        logger.warning("dense vector query skipped: error=%s", type(exc).__name__)
        return []

    docs = (results.get("documents") or [[]])[0]
    metas = (results.get("metadatas") or [[]])[0]
    distances = (results.get("distances") or [[]])[0]
    ids = (results.get("ids") or [[]])[0]
    hits: list[_SearchHit] = []
    for index, doc in enumerate(docs):
        meta = _metadata_at(metas, index)
        distance = distances[index] if index < len(distances) else None
        key = str(ids[index]) if index < len(ids) else _fallback_key(doc, meta, index)
        hits.append(
            _SearchHit(
                key=key,
                text=doc,
                metadata=meta,
                distance=distance,
                score=_dense_score(distance),
                retrieval_modes=("dense",),
            )
        )
    return hits


def _sparse_hits(collection: object, query_text: str, n_results: int) -> list[_SearchHit]:
    if BM25Okapi is None:
        return []

    query_tokens = _tokenize(query_text)
    if not query_tokens:
        return []

    sparse_corpus = _load_sparse_corpus(collection)
    if sparse_corpus is None:
        return []

    scores = _bm25_scores(sparse_corpus.tokenized_documents, query_tokens)
    if scores is None:
        return []

    return _rank_sparse_hits(sparse_corpus, scores, n_results)


def _load_sparse_corpus(collection: object) -> _SparseCorpus | None:
    try:
        corpus = collection.get(include=["documents", "metadatas"])
    except Exception as exc:  # noqa: BLE001 - dense retrieval remains available.
        logger.warning("bm25 corpus load skipped: error=%s", type(exc).__name__)
        return None

    documents = [str(document) for document in corpus.get("documents") or []]
    metadatas = [item if isinstance(item, dict) else {} for item in corpus.get("metadatas") or []]
    ids = [str(item) for item in corpus.get("ids") or []]
    tokenized_documents = [_tokenize(str(document)) for document in documents]
    if not any(tokenized_documents):
        return None

    return _SparseCorpus(
        documents=documents,
        metadatas=metadatas,
        ids=ids,
        tokenized_documents=tokenized_documents,
    )


def _bm25_scores(
    tokenized_documents: list[list[str]],
    query_tokens: list[str],
) -> Sequence[float] | None:
    try:
        scores = BM25Okapi(tokenized_documents).get_scores(query_tokens)
    except Exception as exc:  # noqa: BLE001 - optional dependency must be isolated.
        logger.warning("bm25 query skipped: error=%s", type(exc).__name__)
        return None
    return scores


def _rank_sparse_hits(
    sparse_corpus: _SparseCorpus,
    scores: Sequence[float],
    n_results: int,
) -> list[_SearchHit]:
    ranked_indices = sorted(
        range(len(sparse_corpus.documents)),
        key=lambda item_index: float(scores[item_index]),
        reverse=True,
    )
    max_score = max((float(scores[item_index]) for item_index in ranked_indices), default=0.0)
    if max_score <= 0.0:
        return []

    hits: list[_SearchHit] = []
    for rank_index in ranked_indices[:n_results]:
        raw_score = float(scores[rank_index])
        if raw_score <= 0.0:
            continue
        doc = sparse_corpus.documents[rank_index]
        meta = _metadata_at(sparse_corpus.metadatas, rank_index)
        key = (
            sparse_corpus.ids[rank_index]
            if rank_index < len(sparse_corpus.ids)
            else _fallback_key(doc, meta, rank_index)
        )
        normalized_score = raw_score / max_score
        hits.append(
            _SearchHit(
                key=key,
                text=doc,
                metadata=meta,
                distance=1.0 - normalized_score,
                score=normalized_score,
                retrieval_modes=("bm25",),
            )
        )
    return hits


def _reciprocal_rank_fusion(
    dense_hits: list[_SearchHit],
    sparse_hits: list[_SearchHit],
    n_results: int,
) -> list[_SearchHit]:
    pooled: dict[str, _SearchHit] = {}
    scores: dict[str, float] = {}
    modes: dict[str, set[str]] = {}

    for rank, hit in enumerate(dense_hits, start=1):
        pooled.setdefault(hit.key, hit)
        scores[hit.key] = scores.get(hit.key, 0.0) + _DENSE_WEIGHT / (_RRF_K + rank)
        modes.setdefault(hit.key, set()).update(hit.retrieval_modes)

    for rank, hit in enumerate(sparse_hits, start=1):
        pooled.setdefault(hit.key, hit)
        scores[hit.key] = scores.get(hit.key, 0.0) + _SPARSE_WEIGHT / (_RRF_K + rank)
        modes.setdefault(hit.key, set()).update(hit.retrieval_modes)

    max_score = max(scores.values(), default=1.0)
    ranked: list[_SearchHit] = []
    for key, raw_score in scores.items():
        normalized_score = raw_score / max_score if max_score > 0 else 0.0
        ranked.append(
            replace(
                pooled[key],
                score=normalized_score,
                distance=1.0 - normalized_score,
                retrieval_modes=tuple(sorted(modes.get(key, set()))),
            )
        )
    ranked.sort(key=lambda hit: hit.score, reverse=True)
    return ranked[:n_results]


def _hit_to_legacy_dict(hit: _SearchHit) -> dict:
    metadata = {
        **hit.metadata,
        "retrieval_modes": ",".join(hit.retrieval_modes),
    }
    return {
        "text": hit.text,
        "metadata": metadata,
        "distance": hit.distance,
        "score": round(hit.score, 6),
    }


def _with_retrieval_mode(hit: _SearchHit, mode: str) -> _SearchHit:
    return replace(hit, retrieval_modes=tuple(sorted({*hit.retrieval_modes, mode})))


def _safe_collection_count(collection: object) -> int:
    try:
        return max(0, int(collection.count()))
    except Exception as exc:  # noqa: BLE001 - caller treats empty as fallback.
        logger.warning("collection count unavailable: error=%s", type(exc).__name__)
        return 0


def _dense_score(distance: object) -> float:
    if not isinstance(distance, (int, float)):
        return 0.0
    return max(0.0, min(1.0, 1.0 - float(distance)))


def _fallback_key(doc: str, metadata: dict, index: int) -> str:
    chunk_index = metadata.get("chunk_index", index)
    file_name = metadata.get("file_name") or metadata.get("source") or "unknown"
    return f"{file_name}:{chunk_index}:{hash(doc)}"


def _metadata_at(metadatas: list[object], index: int) -> dict:
    if index >= len(metadatas):
        return {}
    candidate = metadatas[index]
    return candidate if isinstance(candidate, dict) else {}


def _tokenize(value: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    return _TOKEN_PATTERN.findall(without_accents)


def _add_chunks_to_graph(
    *,
    session_id: UUID,
    document_id: UUID,
    chunks: list[TextChunk],
) -> None:
    try:
        for chunk in chunks:
            knowledge_graph.add_triples(
                session_id=session_id,
                document_id=document_id,
                chunk_id=chunk.chunk_id,
                triples=chunk.knowledge_triples,
                file_name=chunk.file_name,
                doc_type=chunk.doc_type,
                chunk_index=chunk.chunk_index,
            )
    except Exception as exc:  # noqa: BLE001 - graph enrichment is best-effort.
        logger.warning("knowledge graph indexing skipped: error=%s", type(exc).__name__)


def _hydrate_graph_from_collection(
    collection: object,
    *,
    session_id: UUID | str | None,
) -> None:
    context = _graph_hydration_context(collection, session_id)
    if context is None:
        return

    payload = _collection_metadata_payload(collection)
    if payload is None:
        return

    metadatas, ids = payload
    _add_metadata_triples_to_graph(context, metadatas, ids)


def _graph_hydration_context(
    collection: object,
    session_id: UUID | str | None,
) -> _GraphHydrationContext | None:
    session_uuid = _metadata_uuid(session_id)
    if session_uuid is None or not knowledge_graph.enabled:
        return None

    collection_metadata = getattr(collection, "metadata", None) or {}
    document_id = _metadata_uuid(collection_metadata.get("document_id"))
    if document_id is None:
        return None

    return _GraphHydrationContext(
        session_id=session_uuid,
        document_id=document_id,
        file_name=str(collection_metadata.get("filename") or ""),
        doc_type=str(collection_metadata.get("doc_type") or ""),
    )


def _collection_metadata_payload(collection: object) -> tuple[list[dict], list[str]] | None:
    try:
        raw = collection.get(include=["metadatas"])
    except Exception as exc:  # noqa: BLE001 - query must still work without graph hydration.
        logger.warning("knowledge graph hydration skipped: error=%s", type(exc).__name__)
        return None

    metadatas = [item if isinstance(item, dict) else {} for item in raw.get("metadatas") or []]
    ids = [str(item) for item in raw.get("ids") or []]
    return metadatas, ids


def _add_metadata_triples_to_graph(
    context: _GraphHydrationContext,
    metadatas: list[dict],
    ids: list[str],
) -> None:
    for index, metadata in enumerate(metadatas):
        triples = deserialize_knowledge_triples(metadata.get("knowledge_triples"))
        if not triples:
            continue
        chunk_id = (
            ids[index]
            if index < len(ids)
            else _fallback_chunk_id(context.document_id, metadata, index)
        )
        knowledge_graph.add_triples(
            session_id=context.session_id,
            document_id=context.document_id,
            chunk_id=chunk_id,
            triples=triples,
            file_name=str(metadata.get("file_name") or context.file_name),
            doc_type=str(metadata.get("doc_type") or context.doc_type),
            chunk_index=_metadata_chunk_index(metadata),
        )


def _metadata_uuid(value: object) -> UUID | None:
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def _fallback_chunk_id(document_id: UUID, metadata: dict, index: int) -> str:
    return f"{document_id}:{_metadata_chunk_index(metadata)}:{index}"
