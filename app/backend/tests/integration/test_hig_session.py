"""Integration: MasterFileAgent → search_context → real ephemeral ChromaDB.

Marked @pytest.mark.slow because SentenceTransformerEmbeddingFunction performs
actual ML inference (or downloads the model on first run).

Run explicitly:
    pytest -m slow tests/integration/test_hig_session.py
Skip in fast CI:
    pytest -m "not slow"

Design note — why citation validation proves the RAG path works:
    record_finding rejects any evidence_chunks entry whose (filename, page,
    chunk_index) tuple was not present in the seen-set populated by the
    preceding search_context call. If real ChromaDB returns an empty result,
    seen is empty, the citation is rejected (is_error=True), the LLM receives
    an error tool_result, and the final consistency_errors list stays empty.
    The final assertion len(...) == 1 therefore fails if and only if the RAG
    path did not return the expected chunk.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from pydantic import SecretStr

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

# Skip the entire module at collection time if chromadb is not installed.
# This keeps fast unit tests (pytest -m "not slow") green in environments
# where only the lightweight dependencies are present.
chromadb = pytest.importorskip("chromadb", reason="chromadb not installed — skip integration tests")
SentenceTransformerEmbeddingFunction = pytest.importorskip(
    "chromadb.utils.embedding_functions",
    reason="chromadb.utils not available",
).SentenceTransformerEmbeddingFunction

from app.agents.master_file_agent import MasterFileAgent  # noqa: E402
from app.core.settings import Settings  # noqa: E402
from app.services.chroma_client import create_ephemeral_chroma_client  # noqa: E402
from app.services.llm_client import LlmClient  # noqa: E402
from app.services.rag_service import EMBED_MODEL, RagService  # noqa: E402
from tests.conftest import ScriptedTurn, text_block, tool_use_block, usage  # noqa: E402

# Seed constants — the scripted LLM cites these coordinates exactly.
# Must match the chunk metadata written into the ephemeral collection below.
_FILENAME = "master_file_test.pdf"
_PAGE = 1
_CHUNK_IDX = 0
_TEXT = (
    "The Group applies the arm's length principle for all intercompany "
    "transactions. Transfer pricing policy is reviewed annually by Group Tax."
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_ephemeral_rag_service() -> RagService:
    """Bypass RagService.__init__ and inject an in-memory ChromaDB client.

    RagService.__init__ creates a PersistentClient (disk I/O) and downloads
    the embedding model. We skip it via object.__new__ and set the two
    instance attributes manually so all query methods work correctly.
    """
    svc: RagService = object.__new__(RagService)
    svc._client = create_ephemeral_chroma_client()  # type: ignore[attr-defined]
    svc._embed = SentenceTransformerEmbeddingFunction(  # type: ignore[attr-defined]
        model_name=EMBED_MODEL
    )
    return svc


@pytest.fixture(scope="module")
def seeded_rag() -> tuple[RagService, UUID]:
    """(ephemeral RagService, session_id) with one pre-populated master-file chunk.

    module scope: the embedding model is loaded once for all tests in this file.
    """
    svc = _make_ephemeral_rag_service()
    session_id = uuid4()
    doc_id = uuid4()
    collection_name = f"doc_{str(doc_id).replace('-', '_')}"

    col = svc._client.create_collection(  # type: ignore[attr-defined]
        name=collection_name,
        embedding_function=svc._embed,  # type: ignore[attr-defined]
        metadata={
            "session_id": str(session_id),
            "document_id": str(doc_id),
            "filename": _FILENAME,
            "doc_type": "master_file",
        },
    )
    col.add(
        ids=["chunk_0"],
        documents=[_TEXT],
        metadatas=[
            {
                "session_id": str(session_id),
                "document_id": str(doc_id),
                "file_name": _FILENAME,           # key used by RagService._parse_results
                "chapter_or_page": str(_PAGE),    # parsed to int by _parse_results
                "chunk_index": _CHUNK_IDX,
                "char_start": 0,
                "char_end": len(_TEXT),
            }
        ],
    )
    return svc, session_id


def _test_settings() -> Settings:
    return Settings(  # type: ignore[arg-type]
        anthropic_api_key=SecretStr("test-key-not-used"),
        agent_timeout_s=60.0,
        max_tool_iterations=6,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.slow
@pytest.mark.asyncio
async def test_agent_round_trip_with_real_rag(
    seeded_rag: tuple[RagService, UUID],
    scripted_factory: Any,
) -> None:
    """Full E2E: LLM calls search_context → real ChromaDB → finding recorded.

    The only LLM mock here is ScriptedAnthropic (scripted turns). Everything
    else — embedding, vector search, citation validation — is real.
    """
    svc, session_id = seeded_rag

    turns = [
        # Turn 1: agent issues a semantic search over the seeded session.
        ScriptedTurn(
            stop_reason="tool_use",
            content=[
                tool_use_block(
                    "c1",
                    "search_context",
                    {"query": "arm's length principle transfer pricing policy"},
                )
            ],
            usage=usage(input_tokens=300, cache_creation=200),
        ),
        # Turn 2: agent records a finding citing the chunk coordinates.
        # Citation validation in base.py will reject these if search_context
        # did not actually return a chunk with matching (filename, page, chunk_index).
        ScriptedTurn(
            stop_reason="tool_use",
            content=[
                tool_use_block(
                    "c2",
                    "record_finding",
                    {
                        "kind": "consistency_error",
                        "payload": {
                            "description": "TP policy lacks specific intercompany margin range.",
                            "severity": "medium",
                            "locations": [{"filename": _FILENAME}],
                        },
                        "evidence_chunks": [
                            {
                                "filename": _FILENAME,
                                "page": _PAGE,
                                "chunk_index": _CHUNK_IDX,
                            }
                        ],
                        "confidence": 0.8,
                        "reasoning": (
                            "The cited master-file chunk states the TP policy exists, "
                            "but it does not provide the specific intercompany margin range."
                        ),
                    },
                )
            ],
            usage=usage(input_tokens=180, cache_read=250),
        ),
        ScriptedTurn(
            stop_reason="end_turn",
            content=[text_block("Analysis complete.")],
            usage=usage(input_tokens=50, cache_read=250),
        ),
    ]

    settings = _test_settings()
    client = LlmClient(settings=settings, client=scripted_factory(turns))  # type: ignore[arg-type]
    agent = MasterFileAgent(llm=client, rag=svc, settings=settings)

    result = await agent.run(session_id)

    assert result.status == "ok", f"Agent status was not 'ok': error={result.error}"
    assert result.tool_calls == 2
    assert len(result.consistency_errors) == 1, (
        "Expected exactly 1 finding. If 0: the real ChromaDB returned no chunks "
        "for the seeded query and the citation guard correctly rejected the finding. "
        "Check that the embedding model is available and the seed text is semantically "
        f"similar to the query. Seeded text: {_TEXT!r}"
    )
    finding = result.consistency_errors[0]
    assert finding.attribution is not None
    assert finding.attribution.confidence == pytest.approx(0.8)

    cited = finding.attribution.evidence_chunks[0]
    assert cited.filename == _FILENAME
    assert cited.page == _PAGE
    assert cited.chunk_index == _CHUNK_IDX
    # The adapter carries the raw text as the quote; validate the truncation contract.
    assert cited.quote is None or len(cited.quote) <= 500
