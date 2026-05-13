"""Lightweight Knowledge Graph support for the RAG pipeline.

ChromaDB remains the durable store through serialized triples in chunk metadata.
NetworkX provides a cheap runtime expansion layer for entity relationships when
the optional dependency is available.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

try:
    import networkx as nx
except ImportError:  # pragma: no cover - minimal deployments fall back to vectors
    nx = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

_ENTITY_PATTERN = (
    r"(?-i:[A-Z][A-Za-z0-9&,'()/-]*(?:\s+[A-Z][A-Za-z0-9&,'()/-]*){0,7})"
)
_MAX_TRIPLES_PER_CHUNK = 8
_MAX_ENTITY_LENGTH = 96
_TOKEN_PATTERN = re.compile(r"\d+/\d+|[\w/-]{3,}", re.UNICODE)


@dataclass(frozen=True)
class KnowledgeTriple:
    """One subject-predicate-object relationship extracted from a chunk."""

    subject: str
    predicate: str
    object_label: str

    def as_metadata(self) -> dict[str, str]:
        return {
            "subject": self.subject,
            "predicate": self.predicate,
            "object": self.object_label,
        }


class KnowledgeTripleExtractor(Protocol):
    """Extraction strategy used by the chunker."""

    def extract(self, text: str, doc_type: str) -> tuple[KnowledgeTriple, ...]: ...


class RuleBasedKnowledgeTripleExtractor:
    """Offline-safe triple extractor used as the local default.

    A production LLM-backed extractor can be swapped in behind the same protocol
    later. The PoC default keeps ingest token-free when real-agent credentials
    are absent.
    """

    def __init__(self) -> None:
        self._patterns: tuple[tuple[re.Pattern[str], str], ...] = (
            (
                re.compile(
                    rf"(?P<subject>{_ENTITY_PATTERN})\s+"
                    rf"(?:is\s+owned\s+by|owned\s+by|belongs\s+to)\s+"
                    rf"(?P<object>{_ENTITY_PATTERN})",
                    re.IGNORECASE,
                ),
                "owned_by",
            ),
            (
                re.compile(
                    rf"(?P<object>{_ENTITY_PATTERN})\s+(?:owns|owner\s+of)\s+"
                    rf"(?P<subject>{_ENTITY_PATTERN})",
                    re.IGNORECASE,
                ),
                "owned_by",
            ),
            (
                re.compile(
                    rf"(?P<subject>{_ENTITY_PATTERN})\s+"
                    rf"(?:provides\s+services\s+to|supplies|manufactures\s+for|sells\s+to)\s+"
                    rf"(?P<object>{_ENTITY_PATTERN})",
                    re.IGNORECASE,
                ),
                "provides_to",
            ),
            (
                re.compile(
                    rf"(?P<subject>{_ENTITY_PATTERN})\s+"
                    rf"(?:pays|paid|invoices|charges)\s+(?P<object>{_ENTITY_PATTERN})",
                    re.IGNORECASE,
                ),
                "transacts_with",
            ),
            (
                re.compile(
                    rf"(?P<subject>{_ENTITY_PATTERN})\s+"
                    rf"(?:tulajdonosa|tulajdonaban\s+all|leanyvallalata)\s+"
                    rf"(?P<object>{_ENTITY_PATTERN})",
                    re.IGNORECASE,
                ),
                "owned_by",
            ),
            (
                re.compile(
                    rf"(?P<subject>{_ENTITY_PATTERN})\s+"
                    rf"(?:fizet|szamlaz|szolgaltatast\s+nyujt)\s+"
                    rf"(?P<object>{_ENTITY_PATTERN})",
                    re.IGNORECASE,
                ),
                "transacts_with",
            ),
        )

    def extract(self, text: str, doc_type: str) -> tuple[KnowledgeTriple, ...]:
        triples: list[KnowledgeTriple] = []
        seen: set[tuple[str, str, str]] = set()

        for pattern, predicate in self._patterns:
            for match in pattern.finditer(text):
                subject = _clean_entity(match.group("subject"))
                object_label = _clean_entity(match.group("object"))
                if not _is_valid_entity(subject) or not _is_valid_entity(object_label):
                    continue
                key = (subject.casefold(), predicate, object_label.casefold())
                if key in seen:
                    continue
                triples.append(
                    KnowledgeTriple(
                        subject=subject,
                        predicate=_doc_type_predicate(predicate, doc_type),
                        object_label=object_label,
                    )
                )
                seen.add(key)
                if len(triples) >= _MAX_TRIPLES_PER_CHUNK:
                    return tuple(triples)

        return tuple(triples)


class LightweightKnowledgeGraph:
    """Small NetworkX-backed graph used to expand RAG queries by entities."""

    def __init__(self) -> None:
        self._enabled = nx is not None
        self._graph = nx.MultiDiGraph() if nx is not None else None
        self._indexed_chunks: set[tuple[str, str]] = set()

    @property
    def enabled(self) -> bool:
        return self._enabled and self._graph is not None

    def add_triples(
        self,
        *,
        session_id: UUID,
        document_id: UUID,
        chunk_id: str,
        triples: tuple[KnowledgeTriple, ...],
        file_name: str,
        doc_type: str,
        chunk_index: int,
    ) -> None:
        if not self.enabled or not triples:
            return

        graph = self._graph
        if graph is None:
            return

        session_key = str(session_id)
        chunk_key = (session_key, chunk_id)
        if chunk_key in self._indexed_chunks:
            return

        for triple in triples:
            subject_key = _normalize_node_key(triple.subject)
            object_key = _normalize_node_key(triple.object_label)
            graph.add_node(subject_key, label=triple.subject)
            graph.add_node(object_key, label=triple.object_label)
            graph.add_edge(
                subject_key,
                object_key,
                predicate=triple.predicate,
                session_id=session_key,
                document_id=str(document_id),
                chunk_id=chunk_id,
                file_name=file_name,
                doc_type=doc_type,
                chunk_index=chunk_index,
            )
        self._indexed_chunks.add(chunk_key)

    def remove_document(self, document_id: UUID) -> None:
        if not self.enabled:
            return

        graph = self._graph
        if graph is None:
            return

        document_key = str(document_id)
        edges_to_remove: list[tuple[str, str, object]] = []
        removed_chunks: set[tuple[str, str]] = set()
        for source, target, edge_key, edge_data in graph.edges(keys=True, data=True):
            if edge_data.get("document_id") != document_key:
                continue
            edges_to_remove.append((str(source), str(target), edge_key))
            session_key = str(edge_data.get("session_id") or "")
            chunk_id = str(edge_data.get("chunk_id") or "")
            if session_key and chunk_id:
                removed_chunks.add((session_key, chunk_id))

        for source, target, edge_key in edges_to_remove:
            graph.remove_edge(source, target, edge_key)

        self._indexed_chunks.difference_update(removed_chunks)
        orphan_nodes = [node for node, degree in graph.degree() if degree == 0]
        graph.remove_nodes_from(orphan_nodes)

    def related_entities(
        self,
        *,
        session_id: UUID | str,
        query: str,
        limit: int = 8,
    ) -> tuple[str, ...]:
        if not self.enabled:
            return ()

        graph = self._graph
        if graph is None:
            return ()

        session_key = str(session_id)
        query_norm = _normalize_text(query)
        query_tokens = set(_TOKEN_PATTERN.findall(query_norm))
        seed_nodes = self._seed_nodes(session_key, query_norm, query_tokens)
        if not seed_nodes:
            return ()

        labels: list[str] = []
        seen: set[str] = set()
        for node in seed_nodes:
            for related_node in self._neighbors_for_session(node, session_key):
                label = str(graph.nodes[related_node].get("label") or related_node).strip()
                normalized = label.casefold()
                if label and normalized not in seen:
                    labels.append(label)
                    seen.add(normalized)
                if len(labels) >= limit:
                    return tuple(labels)

        return tuple(labels)

    def expand_query(self, *, session_id: UUID | str | None, query: str, limit: int = 6) -> str:
        if session_id is None:
            return query
        related = self.related_entities(session_id=session_id, query=query, limit=limit)
        if not related:
            return query
        return f"{query} related entities: {' '.join(related)}"[:1000]

    def _seed_nodes(
        self,
        session_key: str,
        query_norm: str,
        query_tokens: set[str],
    ) -> list[str]:
        graph = self._graph
        if graph is None:
            return []

        seeds: list[str] = []
        for node in self._session_nodes(session_key):
            label = str(graph.nodes[node].get("label") or node)
            label_norm = _normalize_text(label)
            label_tokens = set(_TOKEN_PATTERN.findall(label_norm))
            if label_norm in query_norm or query_tokens.intersection(label_tokens):
                seeds.append(node)
        return seeds

    def _session_nodes(self, session_key: str) -> set[str]:
        graph = self._graph
        if graph is None:
            return set()
        nodes: set[str] = set()
        for subject, object_label, edge_data in graph.edges(data=True):
            if edge_data.get("session_id") == session_key:
                nodes.add(str(subject))
                nodes.add(str(object_label))
        return nodes

    def _neighbors_for_session(self, node: str, session_key: str) -> tuple[str, ...]:
        graph = self._graph
        if graph is None:
            return ()

        neighbors: list[str] = []
        for successor in graph.successors(node):
            if self._has_session_edge(node, successor, session_key):
                neighbors.append(str(successor))
        for predecessor in graph.predecessors(node):
            if self._has_session_edge(predecessor, node, session_key):
                neighbors.append(str(predecessor))
        return tuple(neighbors)

    def _has_session_edge(self, source: str, target: str, session_key: str) -> bool:
        graph = self._graph
        if graph is None:
            return False
        edge_bucket = graph.get_edge_data(source, target, default={})
        return any(edge_data.get("session_id") == session_key for edge_data in edge_bucket.values())


def serialize_knowledge_triples(triples: tuple[KnowledgeTriple, ...]) -> str:
    if not triples:
        return "[]"
    return json.dumps(
        [triple.as_metadata() for triple in triples],
        ensure_ascii=False,
        separators=(",", ":"),
    )


def deserialize_knowledge_triples(value: object) -> tuple[KnowledgeTriple, ...]:
    if not isinstance(value, str) or not value.strip():
        return ()
    try:
        raw_items = json.loads(value)
    except json.JSONDecodeError:
        return ()
    if not isinstance(raw_items, list):
        return ()

    triples: list[KnowledgeTriple] = []
    for item in raw_items[:_MAX_TRIPLES_PER_CHUNK]:
        if not isinstance(item, dict):
            continue
        subject = _clean_entity(str(item.get("subject") or ""))
        predicate = str(item.get("predicate") or "related_to").strip() or "related_to"
        object_label = _clean_entity(str(item.get("object") or ""))
        if _is_valid_entity(subject) and _is_valid_entity(object_label):
            triples.append(KnowledgeTriple(subject, predicate, object_label))
    return tuple(triples)


def knowledge_entities(triples: tuple[KnowledgeTriple, ...]) -> str:
    values: list[str] = []
    seen: set[str] = set()
    for triple in triples:
        for entity in (triple.subject, triple.object_label):
            key = entity.casefold()
            if key not in seen:
                values.append(entity)
                seen.add(key)
    return ",".join(values)


def _clean_entity(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" .,:;\n\t")[:_MAX_ENTITY_LENGTH]


def _is_valid_entity(value: str) -> bool:
    if len(value) < 2 or len(value) > _MAX_ENTITY_LENGTH:
        return False
    return any(char.isalpha() for char in value)


def _doc_type_predicate(predicate: str, doc_type: str) -> str:
    if doc_type in {"invoice", "contract"} and predicate == "transacts_with":
        return "transaction_counterparty"
    return predicate


def _normalize_node_key(value: str) -> str:
    return _normalize_text(value).replace(" ", "_")


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(without_accents.split())


knowledge_graph = LightweightKnowledgeGraph()