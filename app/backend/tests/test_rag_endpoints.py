"""RAG endpoint contract tests with a fake service implementation."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import rag as rag_endpoint
from app.main import create_app
from app.services.rag_service import RagChunk


class FakeRagEndpointService:
    def __init__(self) -> None:
        self.chunk = RagChunk(
            text="Exact 32/2017 NGM documentation obligation reference.",
            source="legal.pdf",
            page=3,
            chunk_index=2,
            score=0.98,
            source_kind="legal",
            source_id="HU_NGM_DECREE_32_2017",
            citation_label="32/2017 NGM",
        )

    def query_legal_knowledge(
        self,
        query: str,
        n_results: int = 5,
        *,
        agent_scope: str | None = None,
        source_ids: set[str] | None = None,
    ) -> list[RagChunk]:
        return [self.chunk]

    def query_document(self, document_id, query: str, n_results: int = 5) -> list[RagChunk]:
        return [self.chunk]

    def query_session_documents(
        self,
        session_id,
        query: str,
        n_results_per_doc: int = 3,
    ) -> list[RagChunk]:
        return [self.chunk]

    def list_session_documents(self, session_id) -> list[dict[str, object]]:
        return [
            {
                "document_id": str(uuid4()),
                "filename": "master_file.pdf",
                "doc_type": "master_file",
                "collection": "doc_test",
                "chunk_count": 4,
            }
        ]


def _client(monkeypatch) -> TestClient:
    monkeypatch.setattr(rag_endpoint, "rag_service", FakeRagEndpointService())
    return TestClient(create_app())


def test_legal_query_endpoint_returns_standard_envelope(monkeypatch) -> None:
    client = _client(monkeypatch)

    response = client.get("/api/v1/rag/legal/query", params={"q": "32/2017 NGM"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["query"] == "32/2017 NGM"
    assert payload["data"]["n_results"] == 1
    assert payload["data"]["chunks"][0]["source_kind"] == "legal"
    assert payload["data"]["chunks"][0]["citation_label"] == "32/2017 NGM"


def test_document_query_endpoint_preserves_chunk_contract(monkeypatch) -> None:
    client = _client(monkeypatch)
    document_id = uuid4()

    response = client.get(
        f"/api/v1/rag/documents/{document_id}/query",
        params={"q": "invoice amount", "n_results": 3},
    )

    assert response.status_code == 200
    chunk = response.json()["data"]["chunks"][0]
    assert chunk["text"].startswith("Exact 32/2017")
    assert chunk["page"] == 3
    assert chunk["chunk_index"] == 2
    assert chunk["score"] == pytest.approx(0.98)


def test_session_documents_endpoint_lists_registered_collections(monkeypatch) -> None:
    client = _client(monkeypatch)
    session_id = uuid4()

    response = client.get(f"/api/v1/rag/sessions/{session_id}/documents")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["session_id"] == str(session_id)
    assert payload["total"] == 1
    assert payload["documents"][0]["doc_type"] == "master_file"


def test_session_query_endpoint_fans_out_across_documents(monkeypatch) -> None:
    client = _client(monkeypatch)
    session_id = uuid4()

    response = client.get(
        f"/api/v1/rag/sessions/{session_id}/query",
        params={"q": "controlled transaction", "n_results_per_doc": 2},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["query"] == "controlled transaction"
    assert payload["n_results"] == 1
    assert payload["chunks"][0]["source"] == "legal.pdf"


def test_empty_query_returns_standard_error_envelope(monkeypatch) -> None:
    client = _client(monkeypatch)

    response = client.get("/api/v1/rag/legal/query", params={"q": "   "})

    assert response.status_code == 400
    payload = response.json()
    assert payload["success"] is False
    assert payload["data"] is None
    assert payload["error"]["code"] == "EMPTY_QUERY"