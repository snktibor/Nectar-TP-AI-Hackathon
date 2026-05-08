"""Abstract base for the five document-type specialist agents.

Owns the multi-turn tool-use loop, the citation-validation dispatcher, and
the assembly of `AgentRunResult`. Subclasses only declare class-level
constants (agent_id, doc_type, prompt_path, prompt_version) and override
`initial_user_message` if they want a non-default first turn.

The RAG layer is treated as a black box reachable through a single
`Protocol` method: `RagService.query_context`. The parallel team owns its
implementation.
"""

from __future__ import annotations

import json
import logging
from abc import ABC
from datetime import datetime, timezone
from pathlib import Path
from typing import ClassVar, Protocol, runtime_checkable
from uuid import UUID

from pydantic import ValidationError

from app.agents.tools import ALL_TOOLS, TOOL_RECORD_FINDING, TOOL_SEARCH_CONTEXT
from app.core.settings import Settings, get_settings
from app.models.schemas import (
    AgentRunResult,
    BenchmarkRisk,
    ConsistencyError,
    DocumentType,
    ErrorDetail,
    EvidenceChunk,
    FindingAttribution,
    MissingElement,
)
from app.services.llm_client import (
    LlmClient,
    LlmTurn,
    LlmUsage,
    MessageParam,
    SystemBlock,
    TextContentBlock,
    ToolUseContentBlock,
    ContentBlockParam,
)


logger = logging.getLogger("redline.agents")


# ---------------------------------------------------------------------------
# RAG contract — black-box interface owned by the parallel team.
# ---------------------------------------------------------------------------


@runtime_checkable
class RagService(Protocol):
    """The single RAG entry point this layer depends on."""

    async def query_context(
        self,
        session_id: UUID,
        doc_type: DocumentType,
        query: str,
        n_results: int = 5,
    ) -> list[EvidenceChunk]: ...


# ---------------------------------------------------------------------------
# Internal state.
# ---------------------------------------------------------------------------


ChunkKey = tuple[str, int, int]


class _FindingsBuffer:
    """Per-run buffer of validated findings."""

    def __init__(self) -> None:
        self.consistency: list[ConsistencyError] = []
        self.benchmark: list[BenchmarkRisk] = []
        self.missing: list[MissingElement] = []


# ---------------------------------------------------------------------------
# Agent base.
# ---------------------------------------------------------------------------


class DocumentTypeAgent(ABC):
    """Abstract specialist agent. Subclasses bind to one DocumentType."""

    agent_id: ClassVar[str]
    doc_type: ClassVar[DocumentType]
    prompt_path: ClassVar[Path]
    prompt_version: ClassVar[str]

    def __init__(
        self,
        llm: LlmClient,
        rag: RagService,
        settings: Settings | None = None,
    ) -> None:
        self._llm = llm
        self._rag = rag
        self._settings = settings or get_settings()
        self._prompt_text_cache: str | None = None

    # ---- public surface ---------------------------------------------------

    @property
    def model(self) -> str:
        return self._settings.model_doc_agent

    async def run(self, session_id: UUID) -> AgentRunResult:
        """Execute one complete tool-use loop. Always returns an AgentRunResult."""
        started_at = datetime.now(timezone.utc)
        seen: set[ChunkKey] = set()
        findings = _FindingsBuffer()
        usage = LlmUsage()
        tool_calls = 0

        system_blocks: list[SystemBlock] = [
            {
                "type": "text",
                "text": self._prompt_text(),
                "cache_control": {"type": "ephemeral"},
            }
        ]
        messages: list[MessageParam] = [
            {"role": "user", "content": self.initial_user_message(session_id)}
        ]

        try:
            for _ in range(self._settings.max_tool_iterations):
                turn = await self._llm.create(
                    model=self.model,
                    system=system_blocks,
                    messages=messages,
                    tools=ALL_TOOLS,
                    temperature=0.0,
                )
                usage = _accumulate_usage(usage, turn.usage)
                _append_assistant_turn(messages, turn)

                if turn.stop_reason in ("end_turn", "max_tokens"):
                    break

                # stop_reason == "tool_use": dispatch every tool block.
                tool_use_blocks = [b for b in turn.content if isinstance(b, ToolUseContentBlock)]
                if not tool_use_blocks:
                    # Defensive: stop_reason claims tool_use but no blocks present.
                    break

                tool_results: list[ContentBlockParam] = []
                for block in tool_use_blocks:
                    tool_calls += 1
                    text, is_error = await self._dispatch_tool(
                        session_id=session_id,
                        tool_name=block.name,
                        tool_input=block.input,
                        seen=seen,
                        findings=findings,
                    )
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": text,
                            "is_error": is_error,
                        }
                    )
                messages.append({"role": "user", "content": tool_results})
            else:
                # Loop exhausted without break — iteration cap hit.
                return self._error_result(
                    started_at=started_at,
                    code="TOOL_ITER_CAP",
                    message=f"Agent exceeded max_tool_iterations ({self._settings.max_tool_iterations}).",
                    usage=usage,
                    tool_calls=tool_calls,
                    findings=findings,
                )

            finished_at = datetime.now(timezone.utc)
            return AgentRunResult(
                agent_id=self.agent_id,
                doc_type_scope=self.doc_type,
                prompt_version=self.prompt_version,
                model=self.model,
                started_at=started_at,
                finished_at=finished_at,
                tool_calls=tool_calls,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                cache_read_tokens=usage.cache_read_input_tokens,
                cache_creation_tokens=usage.cache_creation_input_tokens,
                consistency_errors=findings.consistency,
                benchmark_risks=findings.benchmark,
                missing_elements=findings.missing,
                status="ok",
            )
        except Exception as exc:  # noqa: BLE001 — convert any unexpected error into telemetry
            logger.exception("agent crashed agent_id=%s", self.agent_id)
            return self._error_result(
                started_at=started_at,
                code="AGENT_EXCEPTION",
                message=f"{type(exc).__name__}: {exc}",
                usage=usage,
                tool_calls=tool_calls,
                findings=findings,
            )

    # ---- subclass hooks ---------------------------------------------------

    def initial_user_message(self, session_id: UUID) -> str:
        """Default first user turn. Override to bias retrieval focus."""
        return (
            f"You are reviewing the {self.doc_type.value} documents uploaded in "
            f"session {session_id}. Begin by issuing search_context queries to "
            "retrieve the most relevant evidence, then record findings. Cite every "
            "finding with chunks you actually retrieved."
        )

    # ---- internals --------------------------------------------------------

    def _prompt_text(self) -> str:
        if self._prompt_text_cache is None:
            self._prompt_text_cache = self.prompt_path.read_text(encoding="utf-8")
        return self._prompt_text_cache

    async def _dispatch_tool(
        self,
        session_id: UUID,
        tool_name: str,
        tool_input: dict[str, object],
        seen: set[ChunkKey],
        findings: _FindingsBuffer,
    ) -> tuple[str, bool]:
        if tool_name == TOOL_SEARCH_CONTEXT:
            return await self._handle_search_context(session_id, tool_input, seen)
        if tool_name == TOOL_RECORD_FINDING:
            return self._handle_record_finding(tool_input, seen, findings)
        return (f"Unknown tool: {tool_name}", True)

    async def _handle_search_context(
        self,
        session_id: UUID,
        tool_input: dict[str, object],
        seen: set[ChunkKey],
    ) -> tuple[str, bool]:
        query_raw = tool_input.get("query")
        if not isinstance(query_raw, str) or not query_raw.strip():
            return ("query is required and must be a non-empty string.", True)
        n_raw = tool_input.get("n_results", 5)
        try:
            n_results = max(1, min(20, int(n_raw)))
        except (TypeError, ValueError):
            return ("n_results must be an integer in [1,20].", True)

        chunks = await self._rag.query_context(
            session_id=session_id,
            doc_type=self.doc_type,
            query=query_raw,
            n_results=n_results,
        )
        for chunk in chunks:
            seen.add((chunk.filename, chunk.page, chunk.chunk_index))
        return (_format_chunks(chunks), False)

    def _handle_record_finding(
        self,
        tool_input: dict[str, object],
        seen: set[ChunkKey],
        findings: _FindingsBuffer,
    ) -> tuple[str, bool]:
        kind_raw = tool_input.get("kind")
        payload_raw = tool_input.get("payload")
        citations_raw = tool_input.get("evidence_chunks")
        confidence_raw = tool_input.get("confidence")
        rule_id_raw = tool_input.get("rule_id")

        if kind_raw not in ("consistency_error", "benchmark_risk", "missing_element"):
            return ("kind must be one of: consistency_error, benchmark_risk, missing_element.", True)
        if not isinstance(payload_raw, dict):
            return ("payload must be an object with finding fields.", True)
        if not isinstance(citations_raw, list) or not citations_raw:
            return ("evidence_chunks must be a non-empty array.", True)

        # Validate citations and check seen-set membership.
        citations: list[EvidenceChunk] = []
        for raw in citations_raw:
            if not isinstance(raw, dict):
                return ("each evidence_chunks entry must be an object.", True)
            try:
                chunk = EvidenceChunk.model_validate(raw)
            except ValidationError as exc:
                return (f"evidence_chunks entry invalid: {_first_error(exc)}", True)
            key = (chunk.filename, chunk.page, chunk.chunk_index)
            if key not in seen:
                return (
                    f"Citation {chunk.filename}:p{chunk.page}:c{chunk.chunk_index} was not "
                    "returned by any search_context call in this run. Call search_context "
                    "first and only cite chunks you actually retrieved.",
                    True,
                )
            citations.append(chunk)

        # Confidence.
        try:
            confidence = float(confidence_raw)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return ("confidence must be a number in [0,1].", True)
        if not 0.0 <= confidence <= 1.0:
            return ("confidence must be a number in [0,1].", True)

        rule_id = str(rule_id_raw) if rule_id_raw is not None else None

        attribution = FindingAttribution(
            agent_id=self.agent_id,
            doc_type_scope=self.doc_type,
            confidence=confidence,
            evidence_chunks=citations,
            rule_id=rule_id,
            prompt_version=self.prompt_version,
        )

        # Validate the kind-specific payload via Pydantic; reject on schema violation.
        try:
            finding_data: dict[str, object] = {
                **payload_raw,
                "attribution": attribution.model_dump(mode="json"),
            }
            if kind_raw == "consistency_error":
                findings.consistency.append(ConsistencyError.model_validate(finding_data))
            elif kind_raw == "benchmark_risk":
                findings.benchmark.append(BenchmarkRisk.model_validate(finding_data))
            else:  # missing_element
                findings.missing.append(MissingElement.model_validate(finding_data))
        except ValidationError as exc:
            return (f"payload schema invalid for kind={kind_raw}: {_first_error(exc)}", True)

        return ("Finding recorded.", False)

    def _error_result(
        self,
        started_at: datetime,
        code: str,
        message: str,
        usage: LlmUsage,
        tool_calls: int,
        findings: _FindingsBuffer,
    ) -> AgentRunResult:
        return AgentRunResult(
            agent_id=self.agent_id,
            doc_type_scope=self.doc_type,
            prompt_version=self.prompt_version,
            model=self.model,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            tool_calls=tool_calls,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cache_read_tokens=usage.cache_read_input_tokens,
            cache_creation_tokens=usage.cache_creation_input_tokens,
            consistency_errors=findings.consistency,
            benchmark_risks=findings.benchmark,
            missing_elements=findings.missing,
            status="error",
            error=ErrorDetail(code=code, message=message),
        )


# ---------------------------------------------------------------------------
# Module helpers.
# ---------------------------------------------------------------------------


def _format_chunks(chunks: list[EvidenceChunk]) -> str:
    """Compact, model-friendly rendering of retrieved chunks."""
    if not chunks:
        return "No matching chunks found."
    lines = [f"Retrieved {len(chunks)} chunk(s):"]
    for i, chunk in enumerate(chunks, start=1):
        meta = f"{chunk.filename}:p{chunk.page}:c{chunk.chunk_index}"
        body = chunk.quote or ""
        lines.append(f"[{i}] {meta}\n{body}".rstrip())
    return "\n\n".join(lines)


def _accumulate_usage(acc: LlmUsage, turn: LlmUsage) -> LlmUsage:
    return LlmUsage(
        input_tokens=acc.input_tokens + turn.input_tokens,
        output_tokens=acc.output_tokens + turn.output_tokens,
        cache_read_input_tokens=acc.cache_read_input_tokens + turn.cache_read_input_tokens,
        cache_creation_input_tokens=(
            acc.cache_creation_input_tokens + turn.cache_creation_input_tokens
        ),
    )


def _append_assistant_turn(messages: list[MessageParam], turn: LlmTurn) -> None:
    """Echo the assistant turn back into the conversation history."""
    blocks: list[ContentBlockParam] = []
    for content in turn.content:
        if isinstance(content, TextContentBlock):
            blocks.append({"type": "text", "text": content.text})
        elif isinstance(content, ToolUseContentBlock):
            blocks.append(
                {
                    "type": "tool_use",
                    "id": content.id,
                    "name": content.name,
                    "input": content.input,
                }
            )
    if blocks:
        messages.append({"role": "assistant", "content": blocks})


def _first_error(exc: ValidationError) -> str:
    """Compact human-readable summary of the first Pydantic validation error."""
    errors = exc.errors()
    if not errors:
        return str(exc)
    first = errors[0]
    loc = ".".join(str(p) for p in first.get("loc", ()))
    msg = first.get("msg", "invalid")
    return json.dumps({"loc": loc, "msg": msg})
