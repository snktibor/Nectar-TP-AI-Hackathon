"""LlmClient unit tests using ScriptedAnthropic."""

from __future__ import annotations

import pytest
from pydantic import SecretStr

from app.core.settings import Settings
from app.services.llm_client import (
    LlmClient,
    SystemBlock,
    TextContentBlock,
    ToolUseContentBlock,
)
from tests.conftest import ScriptedTurn, text_block, tool_use_block, usage


def _make_client(scripted_factory, turns) -> tuple[LlmClient, object]:
    s = Settings(anthropic_api_key=SecretStr("test-key"))  # type: ignore[arg-type]
    fake = scripted_factory(turns)
    return LlmClient(settings=s, client=fake), fake  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_create_returns_typed_turn(scripted_factory) -> None:
    turns = [
        ScriptedTurn(
            stop_reason="end_turn",
            content=[text_block("hello world")],
            usage=usage(input_tokens=42, output_tokens=11, cache_read=8, cache_creation=4),
        )
    ]
    client, _ = _make_client(scripted_factory, turns)

    sys_blocks: list[SystemBlock] = [
        {"type": "text", "text": "system", "cache_control": {"type": "ephemeral"}}
    ]
    turn = await client.create(
        model="claude-sonnet-4-6",
        system=sys_blocks,
        messages=[{"role": "user", "content": "hi"}],
        tools=[],
    )

    assert turn.stop_reason == "end_turn"
    assert turn.usage.input_tokens == 42
    assert turn.usage.cache_read_input_tokens == 8
    assert turn.usage.cache_creation_input_tokens == 4
    assert len(turn.content) == 1
    assert isinstance(turn.content[0], TextContentBlock)
    assert turn.content[0].text == "hello world"


@pytest.mark.asyncio
async def test_tool_use_block_parsing(scripted_factory) -> None:
    turns = [
        ScriptedTurn(
            stop_reason="tool_use",
            content=[
                text_block("calling tool"),
                tool_use_block("call_1", "search_context", {"query": "margin"}),
            ],
            usage=usage(),
        )
    ]
    client, _ = _make_client(scripted_factory, turns)

    turn = await client.create(
        model="claude-sonnet-4-6",
        system=[{"type": "text", "text": "s"}],
        messages=[{"role": "user", "content": "go"}],
        tools=[],
    )

    assert turn.stop_reason == "tool_use"
    tool_block = next(b for b in turn.content if isinstance(b, ToolUseContentBlock))
    assert tool_block.name == "search_context"
    assert tool_block.input == {"query": "margin"}


@pytest.mark.asyncio
async def test_temperature_must_be_zero_invariant(scripted_factory) -> None:
    """ScriptedAnthropic enforces temperature=0 as an invariant."""
    turns = [
        ScriptedTurn(stop_reason="end_turn", content=[text_block("ok")], usage=usage())
    ]
    client, _ = _make_client(scripted_factory, turns)

    with pytest.raises(AssertionError, match="temperature=0"):
        await client.create(
            model="claude-sonnet-4-6",
            system=[{"type": "text", "text": "s"}],
            messages=[{"role": "user", "content": "go"}],
            tools=[],
            temperature=0.7,
        )
