"""Advanced RAG behaviour tests: GraphRAG metadata and hybrid retrieval."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.models.schemas import DocumentType
from app.services import vector_store
from app.services.chunker import chunk_document
from app.services.knowledge_graph import KnowledgeTriple, LightweightKnowledgeGraph
from app.services.rag_service import RagChunk, RagService, SemanticRouter


def test_chunker_extracts_knowledge_triples() -> None:
    chunks = chunk_document(
        pages=[
            (
                1,
                "HIG Manufacturing is owned by ParentCo. "
                "HIG Manufacturing provides services to LocalCo.",
            )
        ],
        file_name="master_file.pdf",
        doc_type="master_file",
    )

    assert chunks
    triples = chunks[0].knowledge_triples
    assert KnowledgeTriple("HIG Manufacturing", "owned_by", "ParentCo") in triples
    assert KnowledgeTriple("HIG Manufacturing", "provides_to", "LocalCo") in triples


def test_lightweight_graph_expands_related_entities() -> None:
    graph = LightweightKnowledgeGraph()
    if not graph.enabled:
        pytest.skip("NetworkX is not installed in this environment.")

    session_id = uuid4()
    graph.add_triples(
        session_id=session_id,
        document_id=uuid4(),
        chunk_id="chunk-1",
        triples=(KnowledgeTriple("HIG Manufacturing", "owned_by", "ParentCo"),),
        file_name="master_file.pdf",
        doc_type="master_file",
        chunk_index=0,
    )

    expanded = graph.expand_query(
        session_id=session_id,
        query="HIG Manufacturing functions",
    )

    assert "ParentCo" in expanded


def test_hybrid_query_promotes_exact_bm25_match(monkeypatch) -> None:
    class FakeBm25:
        def __init__(self, tokenized_documents: list[list[str]]) -> None:
            self._tokenized_documents = tokenized_documents

        def get_scores(self, query_tokens: list[str]) -> list[float]:
            return [0.0, 0.0, 10.0]

    class FakeCollection:
        metadata = {"session_id": str(uuid4())}

        def __init__(self) -> None:
            self._documents = [
                "General transfer pricing policy overview.",
                "Intercompany services are described here.",
                "Exact reference to 32/2017 NGM decree documentation obligation.",
            ]
            self._metadatas = [
                {"file_name": "policy.pdf", "chapter_or_page": "page_1", "chunk_index": 0},
                {"file_name": "services.pdf", "chapter_or_page": "page_2", "chunk_index": 1},
                {"file_name": "legal.pdf", "chapter_or_page": "page_3", "chunk_index": 2},
            ]
            self._ids = ["policy", "services", "legal"]

        def count(self) -> int:
            return len(self._documents)

        def query(self, query_texts: list[str], n_results: int) -> dict[str, list[list[object]]]:
            return {
                "ids": [self._ids[:n_results]],
                "documents": [self._documents[:n_results]],
                "metadatas": [self._metadatas[:n_results]],
                "distances": [[0.05, 0.2, 0.35][:n_results]],
            }

        def get(self, include: list[str]) -> dict[str, list[object]]:
            return {
                "ids": self._ids,
                "documents": self._documents,
                "metadatas": self._metadatas,
            }

    monkeypatch.setattr(vector_store, "BM25Okapi", FakeBm25)

    results = vector_store.query_collection_hybrid(
        FakeCollection(),
        "32/2017 NGM",
        n_results=2,
    )

    assert results[0]["metadata"]["file_name"] == "legal.pdf"
    assert results[0]["score"] >= results[1]["score"]


def test_semantic_router_keeps_requested_benchmark_scope() -> None:
    route = SemanticRouter().route(
        "iqr benchmark range",
        requested_doc_type=DocumentType.BENCHMARK_STUDY,
    )

    assert route.doc_types == (DocumentType.BENCHMARK_STUDY,)
    assert route.include_legal is True


@pytest.mark.asyncio
async def test_cross_doc_context_keeps_document_fanout_for_legal_queries(monkeypatch) -> None:
    service = object.__new__(RagService)
    service._router = SemanticRouter()

    def fake_session_documents(session_id, query: str, n_results_per_doc: int = 3) -> list[RagChunk]:
        return [
            RagChunk(
                text="Master file mentions the controlled transaction.",
                source="master_file.pdf",
                page=1,
                chunk_index=0,
                score=0.8,
            )
        ]

    def fake_legal_knowledge(
        query: str,
        n_results: int = 5,
        *,
        agent_scope: str | None = None,
    ) -> list[RagChunk]:
        return [
            RagChunk(
                text="32/2017 NGM documentation obligation.",
                source="legal.pdf",
                page=3,
                chunk_index=2,
                score=0.9,
                source_kind="legal",
            )
        ]

    monkeypatch.setattr(service, "query_session_documents", fake_session_documents)
    monkeypatch.setattr(service, "query_legal_knowledge", fake_legal_knowledge)

    chunks = await service.query_cross_doc_context(uuid4(), "32/2017 NGM decree", n_results=4)

    assert {chunk.source_kind for chunk in chunks} == {"document", "legal"}