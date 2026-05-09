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

from app.agents.tools import ALL_TOOLS, TOOL_RECORD_FINDING, TOOL_SEARCH_CONTEXT, TOOL_VERIFY_TAX_NUMBER
from app.services.tax_api_service import verify_tax_number
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
        # Cache the FULL retrieved EvidenceChunk per key so that when the agent
        # cites it, we can hydrate the recorded citation with precise location
        # data (char_start/char_end, source_kind) the agent itself never sees.
        seen_lookup: dict[ChunkKey, EvidenceChunk] = {}
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

        logger.info(
            "agent loop start agent_id=%s session_id=%s max_iter=%d",
            self.agent_id,
            session_id,
            self._settings.max_tool_iterations,
        )

        try:
            cap_hit = False
            for turn_idx in range(self._settings.max_tool_iterations):
                # Note: inter-call pacing is handled globally by LlmClient.
                # The LLM client throttles every call to respect the
                # configured min_call_interval_s, so adding a per-turn sleep
                # here would double-count the wait.
                turn = await self._llm.create(
                    model=self.model,
                    system=system_blocks,
                    messages=messages,
                    tools=ALL_TOOLS,
                    temperature=0.0,
                )
                usage = _accumulate_usage(usage, turn.usage)
                _append_assistant_turn(messages, turn)

                tool_use_blocks = [b for b in turn.content if isinstance(b, ToolUseContentBlock)]
                logger.info(
                    "agent turn agent_id=%s turn=%d/%d stop=%s tool_blocks=%d in_tok=%d out_tok=%d",
                    self.agent_id,
                    turn_idx + 1,
                    self._settings.max_tool_iterations,
                    turn.stop_reason,
                    len(tool_use_blocks),
                    turn.usage.input_tokens,
                    turn.usage.output_tokens,
                )

                # `end_turn` is a clean stop.
                if turn.stop_reason == "end_turn":
                    break
                # `max_tokens`: the response may still contain *complete*
                # tool_use blocks the model emitted before running out of
                # budget. Dispatch those so their findings are not silently
                # lost, then break.
                if turn.stop_reason == "max_tokens" and not tool_use_blocks:
                    logger.warning(
                        "agent hit max_tokens with no tool_use — output truncated agent_id=%s",
                        self.agent_id,
                    )
                    break
                if not tool_use_blocks:
                    # Defensive: stop_reason claims tool_use but no blocks present.
                    logger.warning(
                        "agent received tool_use stop with no blocks agent_id=%s",
                        self.agent_id,
                    )
                    break

                tool_results: list[ContentBlockParam] = []
                for block in tool_use_blocks:
                    tool_calls += 1
                    text, is_error = await self._dispatch_tool(
                        session_id=session_id,
                        tool_name=block.name,
                        tool_input=block.input,
                        seen=seen,
                        seen_lookup=seen_lookup,
                        findings=findings,
                    )
                    if is_error:
                        logger.warning(
                            "tool call rejected agent_id=%s tool=%s reason=%s",
                            self.agent_id,
                            block.name,
                            text[:200].replace("\n", " "),
                        )
                    else:
                        logger.info(
                            "tool call ok agent_id=%s tool=%s findings=cons:%d/bench:%d/miss:%d",
                            self.agent_id,
                            block.name,
                            len(findings.consistency),
                            len(findings.benchmark),
                            len(findings.missing),
                        )
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": text,
                            "is_error": is_error,
                        }
                    )

                # Iteration-aware nudge: low-temperature models like Haiku tend
                # to keep issuing search_context calls indefinitely instead of
                # ever committing to record_finding. We append a short text
                # block (sibling to tool_result blocks within the same user
                # turn — Anthropic permits this) once we've spent half the
                # budget without recording anything, and again with stronger
                # urgency near the cap.
                remaining = self._settings.max_tool_iterations - turn_idx - 1
                n_findings_so_far = (
                    len(findings.consistency)
                    + len(findings.benchmark)
                    + len(findings.missing)
                )
                nudge = self._iteration_nudge(
                    turn_idx=turn_idx,
                    remaining=remaining,
                    n_findings=n_findings_so_far,
                    n_searches=tool_calls - n_findings_so_far,
                )
                if nudge:
                    logger.info(
                        "iteration nudge agent_id=%s turn=%d remaining=%d findings=%d nudge=%r",
                        self.agent_id,
                        turn_idx + 1,
                        remaining,
                        n_findings_so_far,
                        nudge[:80],
                    )
                    tool_results.append({"type": "text", "text": nudge})

                messages.append({"role": "user", "content": tool_results})

                # If the model was truncated by max_tokens but managed to emit
                # complete tool_use blocks, we dispatched them above — exit
                # cleanly rather than asking for another expensive turn that
                # will likely repeat the same truncation.
                if turn.stop_reason == "max_tokens":
                    logger.warning(
                        "agent hit max_tokens with %d tool_use block(s) dispatched — exiting agent_id=%s",
                        len(tool_use_blocks),
                        self.agent_id,
                    )
                    break
            else:
                # Loop exhausted without break — iteration cap hit.
                cap_hit = True

            # Smart cap recovery: if the model never reached end_turn but did
            # successfully record findings (each one is schema-validated by
            # _handle_record_finding before being buffered), we treat the run
            # as a partial success. The audit aggregator already collects
            # findings from TOOL_ITER_CAP-coded errors, but reporting status="ok"
            # here makes the downstream "successful agents" counter meaningful.
            n_findings = (
                len(findings.consistency)
                + len(findings.benchmark)
                + len(findings.missing)
            )
            if cap_hit:
                if n_findings > 0:
                    logger.warning(
                        "agent hit iteration cap but recorded %d finding(s) — accepting agent_id=%s",
                        n_findings,
                        self.agent_id,
                    )
                else:
                    logger.warning(
                        "agent exhausted %d iterations without recording any finding agent_id=%s",
                        self._settings.max_tool_iterations,
                        self.agent_id,
                    )
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

    def _iteration_nudge(
        self,
        *,
        turn_idx: int,
        remaining: int,
        n_findings: int,
        n_searches: int,
    ) -> str:
        """Inject a deadline reminder into the next user message when needed.

        Empirically, low-temperature small models (Haiku 4.5) get stuck in
        search_context loops and never emit `record_finding`. The nudges below
        force a transition: warn at the half-budget mark if no finding has been
        recorded, then escalate to a hard deadline as the iteration cap nears.
        """
        max_iter = self._settings.max_tool_iterations
        # No nudge if the agent is already producing findings — let it work.
        if n_findings > 0 and remaining > 1:
            return ""

        # Final-2 turns: hard deadline, regardless of finding count.
        if remaining <= 1:
            if n_findings == 0:
                return (
                    f"DEADLINE: only {remaining} iteration(s) left and no finding "
                    "has been recorded yet. Stop calling search_context. Pick "
                    "the strongest evidence chunk you have already retrieved "
                    "and call record_finding now (any kind: consistency_error, "
                    "missing_element, or benchmark_risk). If after honest review "
                    "the document is genuinely clean, end your turn with a "
                    "one-sentence text reply."
                )
            return (
                f"DEADLINE: {remaining} iteration(s) left. Wrap up: record any "
                "remaining findings in this turn, then end your turn."
            )

        # Mid-budget nudge: 60%+ of iterations spent searching with nothing recorded.
        if (
            n_findings == 0
            and n_searches >= 3
            and turn_idx + 1 >= (max_iter * 6) // 10
        ):
            return (
                f"PROGRESS CHECK: you have issued {n_searches} search_context "
                f"call(s) without recording any finding, and {remaining} "
                "iteration(s) remain. The retrieved chunks are sufficient — "
                "stop searching and call record_finding for the most concrete "
                "issue you can support with an already-retrieved citation. "
                "If after this honest review the document is genuinely clean, "
                "end your turn with a brief text reply."
            )

        return ""

    # ---- internals --------------------------------------------------------

    def _prompt_text(self) -> str:
        if self._prompt_text_cache is None:
            base = self.prompt_path.read_text(encoding="utf-8")
            addendum_path = self.prompt_path.parent / "_traceability_addendum.md"
            if addendum_path.exists():
                addendum = addendum_path.read_text(encoding="utf-8")
                self._prompt_text_cache = f"{base}\n\n---\n\n{addendum}"
            else:
                self._prompt_text_cache = base
        return self._prompt_text_cache

    async def _dispatch_tool(
        self,
        session_id: UUID,
        tool_name: str,
        tool_input: dict[str, object],
        seen: set[ChunkKey],
        seen_lookup: dict[ChunkKey, EvidenceChunk],
        findings: _FindingsBuffer,
    ) -> tuple[str, bool]:
        if tool_name == TOOL_SEARCH_CONTEXT:
            return await self._handle_search_context(
                session_id, tool_input, seen, seen_lookup
            )
        if tool_name == TOOL_RECORD_FINDING:
            return self._handle_record_finding(tool_input, seen, seen_lookup, findings)
        if tool_name == TOOL_VERIFY_TAX_NUMBER:
            return await self._handle_verify_tax_number(tool_input)
        return (f"Unknown tool: {tool_name}", True)

    async def _handle_search_context(
        self,
        session_id: UUID,
        tool_input: dict[str, object],
        seen: set[ChunkKey],
        seen_lookup: dict[ChunkKey, EvidenceChunk],
    ) -> tuple[str, bool]:
        query_raw = tool_input.get("query")
        if not isinstance(query_raw, str) or not query_raw.strip():
            return ("query is required and must be a non-empty string.", True)
        n_raw = tool_input.get("n_results", self._settings.rag_n_results)
        try:
            n_results = max(1, min(10, int(n_raw)))
        except (TypeError, ValueError):
            return ("n_results must be an integer in [1,10].", True)

        logger.info(
            "search_context query agent_id=%s n_results=%d query=%r",
            self.agent_id,
            n_results,
            query_raw[:160],
        )
        chunks = await self._rag.query_context(
            session_id=session_id,
            doc_type=self.doc_type,
            query=query_raw,
            n_results=n_results,
        )
        for chunk in chunks:
            key = (chunk.filename, chunk.page, chunk.chunk_index)
            seen.add(key)
            seen_lookup[key] = chunk
        # Per-chunk summary (filename:page:idx + score-stand-in) so we can see
        # WHY the model is/isn't recording — sometimes RAG returns nothing
        # useful and the model is correct to keep searching.
        chunk_brief = ", ".join(
            f"{c.filename}:p{c.page}:c{c.chunk_index}({c.source_kind[:3]})"
            for c in chunks
        ) or "<no matches>"
        logger.info(
            "search_context returned agent_id=%s n=%d chunks=[%s]",
            self.agent_id,
            len(chunks),
            chunk_brief,
        )
        return (_format_chunks(chunks), False)

    def _handle_record_finding(
        self,
        tool_input: dict[str, object],
        seen: set[ChunkKey],
        seen_lookup: dict[ChunkKey, EvidenceChunk],
        findings: _FindingsBuffer,
    ) -> tuple[str, bool]:
        kind_raw = tool_input.get("kind")
        payload_raw = tool_input.get("payload")
        citations_raw = tool_input.get("evidence_chunks")
        confidence_raw = tool_input.get("confidence")
        rule_id_raw = tool_input.get("rule_id")
        reasoning_raw = tool_input.get("reasoning")
        uncertainty_raw = tool_input.get("uncertainty_notes")
        legal_refs_raw = tool_input.get("legal_references")
        review_raw = tool_input.get("requires_human_review")

        if kind_raw not in ("consistency_error", "benchmark_risk", "missing_element"):
            return ("kind must be one of: consistency_error, benchmark_risk, missing_element.", True)
        if not isinstance(payload_raw, dict):
            return ("payload must be an object with finding fields.", True)
        if not isinstance(citations_raw, list) or not citations_raw:
            return ("evidence_chunks must be a non-empty array.", True)

        # Validate citations and check seen-set membership. We hydrate each
        # cited chunk with the FULL EvidenceChunk we returned during retrieval
        # (carrying char_start/char_end and source_kind), so the recorded
        # finding always has the precise highlight info — even if the LLM
        # only echoed back filename/page/chunk_index/quote.
        citations: list[EvidenceChunk] = []
        for raw in citations_raw:
            if not isinstance(raw, dict):
                return ("each evidence_chunks entry must be an object.", True)
            try:
                cited = EvidenceChunk.model_validate(raw)
            except ValidationError as exc:
                return (f"evidence_chunks entry invalid: {_first_error(exc)}", True)
            key = (cited.filename, cited.page, cited.chunk_index)
            if key not in seen:
                return (
                    f"Citation {cited.filename}:p{cited.page}:c{cited.chunk_index} was not "
                    "returned by any search_context call in this run. Call search_context "
                    "first and only cite chunks you actually retrieved.",
                    True,
                )
            original = seen_lookup.get(key)
            if original is not None:
                # Prefer the agent's quote (it picked the salient phrase) but
                # use the retrieved chunk's precise location and source_kind.
                citations.append(
                    original.model_copy(
                        update={"quote": cited.quote or original.quote}
                    )
                )
            else:
                citations.append(cited)

        # Confidence.
        try:
            confidence = float(confidence_raw)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return ("confidence must be a number in [0,1].", True)
        if not 0.0 <= confidence <= 1.0:
            return ("confidence must be a number in [0,1].", True)

        rule_id = str(rule_id_raw) if rule_id_raw is not None else None

        reasoning = str(reasoning_raw).strip() if isinstance(reasoning_raw, str) else None
        if not reasoning:
            return (
                "reasoning is required: explain in plain language how the cited "
                "evidence supports this finding (≥20 chars). The UI surfaces it "
                "verbatim for human reviewers.",
                True,
            )
        uncertainty_notes = (
            str(uncertainty_raw).strip()
            if isinstance(uncertainty_raw, str) and uncertainty_raw.strip()
            else None
        )
        if isinstance(legal_refs_raw, list):
            legal_references = [str(r) for r in legal_refs_raw if isinstance(r, str) and r.strip()]
        else:
            legal_references = []
        # Default: a human MUST review unless the agent explicitly asserts it can
        # be trusted. A low-confidence finding force-flips the flag back on.
        if isinstance(review_raw, bool):
            requires_human_review = review_raw
        else:
            requires_human_review = True
        if confidence < 0.9 and not requires_human_review:
            requires_human_review = True

        attribution = FindingAttribution(
            agent_id=self.agent_id,
            doc_type_scope=self.doc_type,
            confidence=confidence,
            evidence_chunks=citations,
            reasoning=reasoning,
            uncertainty_notes=uncertainty_notes,
            requires_human_review=requires_human_review,
            rule_id=rule_id,
            legal_references=legal_references,
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

        # Detailed finding telemetry — surfaces severity, confidence, citation
        # count and the description's first ~120 chars so the run log explains
        # WHAT was actually recorded, not just that something was.
        severity = payload_raw.get("severity") if isinstance(payload_raw, dict) else None
        description = payload_raw.get("description") if isinstance(payload_raw, dict) else None
        descr_str = str(description) if description else ""
        logger.info(
            "finding recorded agent_id=%s kind=%s severity=%s confidence=%.2f "
            "citations=%d review=%s rule=%s descr=%r",
            self.agent_id,
            kind_raw,
            severity,
            confidence,
            len(citations),
            requires_human_review,
            rule_id,
            descr_str[:120],
        )

        return ("Finding recorded.", False)

    async def _handle_verify_tax_number(
        self,
        tool_input: dict[str, object],
    ) -> tuple[str, bool]:
        country_code_raw = tool_input.get("country_code")
        vat_number_raw = tool_input.get("vat_number")

        if not isinstance(country_code_raw, str) or len(country_code_raw.strip()) != 2:
            return ("country_code must be a 2-character ISO country code (e.g. 'HU', 'DE').", True)
        if not isinstance(vat_number_raw, str) or not vat_number_raw.strip():
            return ("vat_number must be a non-empty string without the country-code prefix.", True)

        result = await verify_tax_number(
            country_code=country_code_raw.strip(),
            vat_number=vat_number_raw.strip(),
        )
        return (json.dumps(result), False)

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
        tag = "LEGAL" if chunk.source_kind == "legal" else "DOC"
        meta = f"[{tag}] {chunk.filename}:p{chunk.page}:c{chunk.chunk_index}"
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
