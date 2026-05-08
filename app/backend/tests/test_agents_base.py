"""Agent base behavioural tests: tool loop, citation validation, error paths."""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar
from uuid import uuid4

import pytest
from pydantic import SecretStr

from app.agents.base import DocumentTypeAgent
from app.core.settings import Settings
from app.models.schemas import DocumentType, RiskSeverity
from app.services.llm_client import LlmClient
from tests.conftest import (
    FakeRagService,
    ScriptedTurn,
    make_chunk,
    text_block,
    tool_use_block,
    usage,
)


# ---------------------------------------------------------------------------
# Test agent: bound to MASTER_FILE so we can run it without prompt files
# being required for other types. Uses an inline prompt path.
# ---------------------------------------------------------------------------


_PROMPT = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "agents"
    / "prompts"
    / "master_file_v1.md"
)


class _TestMasterFileAgent(DocumentTypeAgent):
    agent_id: ClassVar[str] = "master_file_agent"
    doc_type: ClassVar[DocumentType] = DocumentType.MASTER_FILE
    prompt_path: ClassVar[Path] = _PROMPT
    prompt_version: ClassVar[str] = "master_file_v1"


def _settings(timeout: float = 30.0, max_iters: int = 6) -> Settings:
    return Settings(  # type: ignore[arg-type]
        anthropic_api_key=SecretStr("test-key"),
        agent_timeout_s=timeout,
        max_tool_iterations=max_iters,
    )


@pytest.mark.asyncio
async def test_happy_path_records_finding(scripted_factory) -> None:
    """Search returns chunk; agent cites it; finding is recorded with attribution."""
    chunk = make_chunk("master_file.pdf", page=3, chunk_index=0, quote="centralized R&D")
    rag = FakeRagService(canned=[chunk])

    turns = [
        # Turn 1: model calls search_context.
        ScriptedTurn(
            stop_reason="tool_use",
            content=[tool_use_block("c1", "search_context", {"query": "R&D centralization"})],
            usage=usage(input_tokens=200, cache_creation=150),
        ),
        # Turn 2: model records a consistency_error citing the retrieved chunk.
        ScriptedTurn(
            stop_reason="tool_use",
            content=[
                tool_use_block(
                    "c2",
                    "record_finding",
                    {
                        "kind": "consistency_error",
                        "payload": {
                            "description": "R&D centralization claim contradicts local function description.",
                            "severity": "high",
                            "locations": [{"filename": "master_file.pdf", "line_numbers": [42]}],
                        },
                        "evidence_chunks": [
                            {
                                "filename": "master_file.pdf",
                                "page": 3,
                                "chunk_index": 0,
                                "quote": "centralized R&D",
                            }
                        ],
                        "confidence": 0.85,
                        "reasoning": (
                            "Master File claims R&D is centralized, while the local "
                            "function description shows local R&D activity — direct "
                            "internal contradiction."
                        ),
                    },
                )
            ],
            usage=usage(input_tokens=120, cache_read=120),
        ),
        # Turn 3: model ends.
        ScriptedTurn(
            stop_reason="end_turn",
            content=[text_block("Done.")],
            usage=usage(input_tokens=30, cache_read=120),
        ),
    ]

    settings = _settings()
    client = LlmClient(settings=settings, client=scripted_factory(turns))  # type: ignore[arg-type]
    agent = _TestMasterFileAgent(llm=client, rag=rag, settings=settings)

    result = await agent.run(uuid4())

    assert result.status == "ok"
    assert result.tool_calls == 2
    assert len(result.consistency_errors) == 1
    finding = result.consistency_errors[0]
    assert finding.attribution is not None
    assert finding.attribution.agent_id == "master_file_agent"
    assert finding.attribution.confidence == pytest.approx(0.85)
    assert finding.attribution.prompt_version == "master_file_v1"
    assert len(finding.attribution.evidence_chunks) == 1
    assert finding.severity == RiskSeverity.HIGH
    # Cache hit observed on the second turn.
    assert result.cache_read_tokens >= 120


@pytest.mark.asyncio
async def test_hallucinated_citation_is_rejected(scripted_factory) -> None:
    """Citing a chunk that was never retrieved must produce an is_error tool_result."""
    chunk = make_chunk("master_file.pdf", page=1, chunk_index=0, quote="real chunk")
    rag = FakeRagService(canned=[chunk])

    turns = [
        # Turn 1: search.
        ScriptedTurn(
            stop_reason="tool_use",
            content=[tool_use_block("c1", "search_context", {"query": "anything"})],
            usage=usage(),
        ),
        # Turn 2: cite a NEVER-RETURNED chunk.
        ScriptedTurn(
            stop_reason="tool_use",
            content=[
                tool_use_block(
                    "c2",
                    "record_finding",
                    {
                        "kind": "missing_element",
                        "payload": {
                            "description": "made up",
                            "expected_in": "master_file.pdf",
                            "required_by": "OECD TPG",
                            "severity": "low",
                        },
                        "evidence_chunks": [
                            {"filename": "fake.pdf", "page": 99, "chunk_index": 99}
                        ],
                        "confidence": 0.5,
                        "reasoning": "made up to test rejection",
                    },
                )
            ],
            usage=usage(),
        ),
        # Turn 3: model retries with a real citation.
        ScriptedTurn(
            stop_reason="tool_use",
            content=[
                tool_use_block(
                    "c3",
                    "record_finding",
                    {
                        "kind": "missing_element",
                        "payload": {
                            "description": "Functional analysis missing.",
                            "expected_in": "master_file.pdf",
                            "required_by": "OECD TPG Ch.V",
                            "severity": "high",
                        },
                        "evidence_chunks": [
                            {"filename": "master_file.pdf", "page": 1, "chunk_index": 0}
                        ],
                        "confidence": 0.7,
                        "reasoning": "Functional analysis is mandatory under OECD TPG Ch.V; absent in the retrieved evidence.",
                    },
                )
            ],
            usage=usage(),
        ),
        ScriptedTurn(stop_reason="end_turn", content=[text_block("ok")], usage=usage()),
    ]

    settings = _settings()
    client = LlmClient(settings=settings, client=scripted_factory(turns))  # type: ignore[arg-type]
    agent = _TestMasterFileAgent(llm=client, rag=rag, settings=settings)

    result = await agent.run(uuid4())

    assert result.status == "ok"
    # Hallucinated finding must NOT appear; only the second, valid one.
    assert len(result.missing_elements) == 1
    assert "Functional analysis missing." in result.missing_elements[0].description


@pytest.mark.asyncio
async def test_iteration_cap_records_error(scripted_factory) -> None:
    """Hit max_tool_iterations → AgentRunResult.status='error' with TOOL_ITER_CAP."""
    chunk = make_chunk()
    rag = FakeRagService(canned=[chunk])

    # Two-iteration cap: we will return tool_use forever to trip it.
    looping_turns = [
        ScriptedTurn(
            stop_reason="tool_use",
            content=[tool_use_block(f"c{i}", "search_context", {"query": "q"})],
            usage=usage(),
        )
        for i in range(8)
    ]

    settings = _settings(max_iters=2)
    client = LlmClient(settings=settings, client=scripted_factory(looping_turns))  # type: ignore[arg-type]
    agent = _TestMasterFileAgent(llm=client, rag=rag, settings=settings)

    result = await agent.run(uuid4())

    assert result.status == "error"
    assert result.error is not None
    assert result.error.code == "TOOL_ITER_CAP"


@pytest.mark.asyncio
async def test_invalid_payload_schema_rejected(scripted_factory) -> None:
    """Severity='banana' is not a RiskSeverity → reject and the agent moves on."""
    chunk = make_chunk()
    rag = FakeRagService(canned=[chunk])

    turns = [
        ScriptedTurn(
            stop_reason="tool_use",
            content=[tool_use_block("c1", "search_context", {"query": "q"})],
            usage=usage(),
        ),
        ScriptedTurn(
            stop_reason="tool_use",
            content=[
                tool_use_block(
                    "c2",
                    "record_finding",
                    {
                        "kind": "consistency_error",
                        "payload": {
                            "description": "...",
                            "severity": "banana",  # invalid
                        },
                        "evidence_chunks": [
                            {"filename": chunk.filename, "page": chunk.page, "chunk_index": chunk.chunk_index}
                        ],
                        "confidence": 0.5,
                        "reasoning": "invalid severity test",
                    },
                )
            ],
            usage=usage(),
        ),
        ScriptedTurn(stop_reason="end_turn", content=[text_block("done")], usage=usage()),
    ]

    settings = _settings()
    client = LlmClient(settings=settings, client=scripted_factory(turns))  # type: ignore[arg-type]
    agent = _TestMasterFileAgent(llm=client, rag=rag, settings=settings)

    result = await agent.run(uuid4())

    assert result.status == "ok"
    assert len(result.consistency_errors) == 0  # malformed finding was rejected


@pytest.mark.asyncio
async def test_system_prompt_carries_cache_control(scripted_factory) -> None:
    """The agent loop must attach cache_control:ephemeral to its system block."""
    chunk = make_chunk()
    rag = FakeRagService(canned=[chunk])
    fake = scripted_factory(
        [ScriptedTurn(stop_reason="end_turn", content=[text_block("ok")], usage=usage())]
    )
    settings = _settings()
    client = LlmClient(settings=settings, client=fake)  # type: ignore[arg-type]
    agent = _TestMasterFileAgent(llm=client, rag=rag, settings=settings)

    await agent.run(uuid4())

    assert fake.calls, "expected at least one Anthropic call"
    sys_blocks = fake.calls[0]["system"]
    assert isinstance(sys_blocks, list) and len(sys_blocks) == 1
    assert sys_blocks[0].get("cache_control") == {"type": "ephemeral"}
