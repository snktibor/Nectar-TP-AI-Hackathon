"""Thin async wrapper around the Anthropic Messages API.

Responsibilities:
  * Forward a single tool-use turn to Claude with prompt caching enabled on
    static system blocks.
  * Retry transient failures (HTTP 429/5xx, connection/read timeouts) with
    exponential backoff.
  * Convert the raw SDK response into a strongly-typed `LlmTurn` so the agent
    loop never deals with `Any`.

The agent base owns the multi-turn tool-use loop. This module owns *one*
network call.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Literal, TypedDict, Union, cast

import anthropic
import httpx
from anthropic import AsyncAnthropic
from pydantic import BaseModel, ConfigDict, Field
from tenacity import (
    AsyncRetrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)
from typing_extensions import NotRequired

from app.core.settings import Settings, get_settings


# ---------------------------------------------------------------------------
# Typed inputs — minimal mirrors of Anthropic SDK shapes we depend on.
# Defined locally to avoid coupling to SDK internal type modules across pins.
# ---------------------------------------------------------------------------


class CacheControl(TypedDict):
    type: Literal["ephemeral"]


class SystemBlock(TypedDict):
    type: Literal["text"]
    text: str
    cache_control: NotRequired[CacheControl]


class ToolSchema(TypedDict):
    name: str
    description: str
    input_schema: dict[str, object]


class TextBlockParam(TypedDict):
    type: Literal["text"]
    text: str


class ToolUseBlockParam(TypedDict):
    type: Literal["tool_use"]
    id: str
    name: str
    input: dict[str, object]


class ToolResultBlockParam(TypedDict):
    type: Literal["tool_result"]
    tool_use_id: str
    content: str
    is_error: NotRequired[bool]


ContentBlockParam = Union[TextBlockParam, ToolUseBlockParam, ToolResultBlockParam]


class MessageParam(TypedDict):
    role: Literal["user", "assistant"]
    content: Union[str, list[ContentBlockParam]]


# ---------------------------------------------------------------------------
# Typed outputs.
# ---------------------------------------------------------------------------


class LlmUsage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    cache_read_input_tokens: int = Field(default=0, ge=0)
    cache_creation_input_tokens: int = Field(default=0, ge=0)


class TextContentBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["text"] = "text"
    text: str


class ToolUseContentBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["tool_use"] = "tool_use"
    id: str
    name: str
    input: dict[str, object]


ContentBlock = Union[TextContentBlock, ToolUseContentBlock]
StopReason = Literal["end_turn", "tool_use", "max_tokens"]


class LlmTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stop_reason: StopReason
    content: list[ContentBlock]
    usage: LlmUsage
    model: str


# ---------------------------------------------------------------------------
# Retry policy.
# ---------------------------------------------------------------------------


# 429 is intentionally excluded: the Anthropic SDK handles rate-limit retries
# itself, honouring the Retry-After header (which can be 40+ seconds).  Adding
# a second tenacity layer on top of 429 produces competing backoffs and obscures
# which retry is waiting.  Tenacity only covers transient connection/server faults
# that the SDK does not automatically retry.
_TENACITY_RETRY_STATUSES = frozenset({408, 500, 502, 503, 504})


def _is_retryable(exc: BaseException) -> bool:
    """Return True for transient faults that tenacity should retry.

    429 / RateLimitError is excluded — the SDK handles those internally via
    Retry-After and its own max_retries counter.
    """
    if isinstance(exc, httpx.TimeoutException):
        return True
    if isinstance(exc, anthropic.APIConnectionError):
        return True
    if isinstance(exc, anthropic.APIStatusError):
        return exc.status_code in _TENACITY_RETRY_STATUSES
    return False


# ---------------------------------------------------------------------------
# Client wrapper.
# ---------------------------------------------------------------------------


class LlmClient:
    """Async, retrying, prompt-cache-aware wrapper around AsyncAnthropic.

    Includes a process-wide call throttle so that, regardless of how many agents
    invoke the client concurrently, consecutive calls are spaced at least
    `settings.min_call_interval_s` apart.  This is essential on low-tier API
    keys where OTPM (output tokens per minute) is the binding limit and naive
    parallelism causes cascading 429s that the SDK's Retry-After backoff alone
    cannot recover from within an agent's wall-clock budget.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        client: AsyncAnthropic | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._client: AsyncAnthropic | None = client
        self._logger = logging.getLogger("redline.llm")
        # Throttle state — `time.monotonic()` units so wall-clock changes
        # cannot break the spacing.  `_last_call_started_at = 0` means "no
        # call yet" and the first invocation skips the wait.
        self._last_call_started_at: float = 0.0
        self._throttle_lock = asyncio.Lock()

    def _ensure_client(self) -> AsyncAnthropic:
        """Build the SDK client on first use; raise a clear error if the key is missing."""
        if self._client is None:
            if self._settings.anthropic_api_key is None:
                raise RuntimeError(
                    "Anthropic API key is not configured. Set REDLINE_ANTHROPIC_API_KEY "
                    "(or ANTHROPIC_API_KEY) before invoking LLM agents, or run with "
                    "REDLINE_USE_REAL_AGENTS=false to fall back to the mock pipeline."
                )
            self._client = AsyncAnthropic(
                api_key=self._settings.anthropic_api_key.get_secret_value(),
                # The SDK handles 429 with Retry-After-aware backoff. We hand the
                # retry count setting here so it matches our settings, and tenacity
                # does NOT duplicate this for 429 (see _is_retryable).
                max_retries=self._settings.llm_max_retries,
            )
        return self._client

    async def create(
        self,
        *,
        model: str,
        system: list[SystemBlock],
        messages: list[MessageParam],
        tools: list[ToolSchema],
        max_tokens: int | None = None,
        temperature: float = 0.0,
    ) -> LlmTurn:
        """Issue exactly one Claude turn, with retry on transient errors.

        The caller owns multi-turn orchestration. We only:
          * forward `system` blocks (cache_control attached upstream),
          * forward tool definitions and prior `messages`,
          * convert the raw response into a typed `LlmTurn`.
        """
        max_tokens_eff = max_tokens if max_tokens is not None else self._settings.llm_max_tokens
        assert max_tokens_eff > 0, "max_tokens must be positive"
        assert 0.0 <= temperature <= 1.0, "temperature must be in [0,1]"

        # Tenacity covers connection faults and 5xx — not 429 (SDK handles those).
        # max=60 gives two connection-error retries breathing room without
        # interfering with the SDK's own Retry-After timing.
        retrying = AsyncRetrying(
            stop=stop_after_attempt(2),
            wait=wait_exponential(multiplier=1.0, min=1.0, max=60.0),
            retry=retry_if_exception(_is_retryable),
            reraise=True,
        )

        client = self._ensure_client()

        await self._throttle_before_call()

        async for attempt in retrying:
            with attempt:
                raw = await client.messages.create(
                    model=model,
                    system=cast(object, system),  # SDK accepts list[dict] at runtime
                    messages=cast(object, messages),
                    tools=cast(object, tools),
                    max_tokens=max_tokens_eff,
                    temperature=temperature,
                )
                turn = _to_llm_turn(raw)
                self._logger.info(
                    "llm call ok model=%s stop=%s in=%d out=%d cache_r=%d cache_c=%d "
                    "blocks=%d max_tokens_cap=%d",
                    turn.model,
                    turn.stop_reason,
                    turn.usage.input_tokens,
                    turn.usage.output_tokens,
                    turn.usage.cache_read_input_tokens,
                    turn.usage.cache_creation_input_tokens,
                    len(turn.content),
                    max_tokens_eff,
                )
                return turn

        # Defensive: tenacity's reraise=True ensures we never reach this line.
        raise RuntimeError("LlmClient.create exhausted retries without surfacing an error")

    async def _throttle_before_call(self) -> None:
        """Block until at least `min_call_interval_s` has passed since the last call started.

        Serializes the *start* of API calls — actual in-flight calls remain
        concurrent.  The lock is held only during the (possibly empty) sleep,
        not during the API roundtrip, so a slow API call never delays the next
        agent's throttle decision more than the configured interval.
        """
        interval = self._settings.min_call_interval_s
        if interval <= 0:
            return
        async with self._throttle_lock:
            now = time.monotonic()
            if self._last_call_started_at > 0:
                elapsed = now - self._last_call_started_at
                wait = interval - elapsed
                if wait > 0:
                    self._logger.info(
                        "llm throttle waiting %.2fs (last call %.2fs ago, interval %.1fs)",
                        wait,
                        elapsed,
                        interval,
                    )
                    await asyncio.sleep(wait)
            self._last_call_started_at = time.monotonic()


def _to_llm_turn(raw: object) -> LlmTurn:
    """Defensive conversion from the SDK Message object to our typed view.

    Uses duck typing rather than importing `anthropic.types.Message` so the
    wrapper survives non-breaking SDK upgrades.
    """
    content_blocks: list[ContentBlock] = []
    for block in getattr(raw, "content", []) or []:
        block_type = getattr(block, "type", None)
        if block_type == "text":
            content_blocks.append(TextContentBlock(text=str(getattr(block, "text", ""))))
        elif block_type == "tool_use":
            content_blocks.append(
                ToolUseContentBlock(
                    id=str(getattr(block, "id", "")),
                    name=str(getattr(block, "name", "")),
                    input=dict(getattr(block, "input", {}) or {}),
                )
            )
        # Unknown block types are intentionally dropped — the agent loop only
        # acts on text + tool_use today.

    usage_obj = getattr(raw, "usage", None)
    usage = LlmUsage(
        input_tokens=int(getattr(usage_obj, "input_tokens", 0) or 0),
        output_tokens=int(getattr(usage_obj, "output_tokens", 0) or 0),
        cache_read_input_tokens=int(getattr(usage_obj, "cache_read_input_tokens", 0) or 0),
        cache_creation_input_tokens=int(getattr(usage_obj, "cache_creation_input_tokens", 0) or 0),
    )

    raw_stop = getattr(raw, "stop_reason", "end_turn") or "end_turn"
    if raw_stop not in ("end_turn", "tool_use", "max_tokens"):
        # Coerce unknown stop reasons (e.g. "stop_sequence") to "end_turn" so
        # the agent loop terminates cleanly.
        raw_stop = "end_turn"

    return LlmTurn(
        stop_reason=cast(StopReason, raw_stop),
        content=content_blocks,
        usage=usage,
        model=str(getattr(raw, "model", "")),
    )
