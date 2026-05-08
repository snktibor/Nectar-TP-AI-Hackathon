"""Shared fixtures: ScriptedAnthropic fake, FakeRagService, sample chunks.

The test suite never speaks to the real Anthropic API or the real ChromaDB.
`ScriptedAnthropic` plays back a pre-built turn list; `FakeRagService` returns
canned `EvidenceChunk` lists keyed by `(doc_type, query_substring)`.
"""

from __future__ import annotations

import os
import sys
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

# Make `app.*` importable when pytest runs from the repository root.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

# Default a non-empty key so Settings() succeeds even though llm_client never
# instantiates the real SDK in tests.
os.environ.setdefault("REDLINE_ANTHROPIC_API_KEY", "test-key-not-used")
os.environ.setdefault("REDLINE_USE_REAL_AGENTS", "true")

from app.core.settings import Settings, get_settings  # noqa: E402
from app.models.schemas import DocumentType, EvidenceChunk  # noqa: E402


# ---------------------------------------------------------------------------
# Settings.
# ---------------------------------------------------------------------------


@pytest.fixture
def settings() -> Settings:
    """Reset the lru_cache so each test starts from a fresh Settings."""
    get_settings.cache_clear()
    return get_settings()


# ---------------------------------------------------------------------------
# Evidence chunk factory.
# ---------------------------------------------------------------------------


def make_chunk(
    filename: str = "doc.pdf",
    page: int = 1,
    chunk_index: int = 0,
    quote: str | None = "sample text",
) -> EvidenceChunk:
    return EvidenceChunk(filename=filename, page=page, chunk_index=chunk_index, quote=quote)


@pytest.fixture
def sample_chunks() -> list[EvidenceChunk]:
    return [
        make_chunk("master_file.pdf", 3, 0, "Group has centralised R&D function."),
        make_chunk("master_file.pdf", 5, 1, "Operating margin policy: 4-6%."),
    ]


# ---------------------------------------------------------------------------
# FakeRagService.
# ---------------------------------------------------------------------------


@dataclass
class FakeRagService:
    """In-memory RAG. Records queries; returns canned chunks per call."""

    canned: list[EvidenceChunk] = field(default_factory=list)
    queries: list[tuple[UUID, DocumentType, str, int]] = field(default_factory=list)

    async def query_context(
        self,
        session_id: UUID,
        doc_type: DocumentType,
        query: str,
        n_results: int = 5,
    ) -> list[EvidenceChunk]:
        self.queries.append((session_id, doc_type, query, n_results))
        return list(self.canned[:n_results])


@pytest.fixture
def fake_rag(sample_chunks: list[EvidenceChunk]) -> FakeRagService:
    return FakeRagService(canned=list(sample_chunks))


# ---------------------------------------------------------------------------
# ScriptedAnthropic — drop-in stand-in for `anthropic.AsyncAnthropic`.
# ---------------------------------------------------------------------------


@dataclass
class ScriptedTurn:
    """One turn the fake will return, in order."""

    stop_reason: str  # "end_turn" | "tool_use" | "max_tokens"
    content: list[Any]  # list of SimpleNamespace mimicking SDK content blocks
    usage: SimpleNamespace
    model: str = "claude-sonnet-4-6"


def text_block(text: str) -> SimpleNamespace:
    return SimpleNamespace(type="text", text=text)


def tool_use_block(tool_id: str, name: str, payload: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(type="tool_use", id=tool_id, name=name, input=payload)


def usage(
    input_tokens: int = 100,
    output_tokens: int = 50,
    cache_read: int = 0,
    cache_creation: int = 0,
) -> SimpleNamespace:
    return SimpleNamespace(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_read_input_tokens=cache_read,
        cache_creation_input_tokens=cache_creation,
    )


class ScriptedAnthropic:
    """Plays back a list of `ScriptedTurn`s in order."""

    def __init__(self, turns: Iterable[ScriptedTurn]) -> None:
        self._turns = list(turns)
        self.calls: list[dict[str, Any]] = []
        self.messages = SimpleNamespace(create=self._create)

    async def _create(self, **kwargs: Any) -> SimpleNamespace:
        if not self._turns:
            raise AssertionError("ScriptedAnthropic exhausted: no more turns scripted.")
        # Validate invariants.
        assert kwargs.get("temperature", 0.0) == 0.0, "agents must use temperature=0"
        self.calls.append(kwargs)
        turn = self._turns.pop(0)
        return SimpleNamespace(
            stop_reason=turn.stop_reason,
            content=turn.content,
            usage=turn.usage,
            model=turn.model,
        )


@pytest.fixture
def scripted_factory():
    """Helper to build a ScriptedAnthropic from a list of turns."""

    def _factory(turns: Iterable[ScriptedTurn]) -> ScriptedAnthropic:
        return ScriptedAnthropic(turns)

    return _factory
