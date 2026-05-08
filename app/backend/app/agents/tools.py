"""Anthropic tool schemas exposed to every specialist agent.

The dispatcher lives in `agents/base.py` because it needs per-run state
(seen citations, findings buffer, the bound RAG service). This module is
strictly declarative — schemas only.
"""

from __future__ import annotations

from app.services.llm_client import ToolSchema

TOOL_SEARCH_CONTEXT = "search_context"
TOOL_RECORD_FINDING = "record_finding"

SEARCH_CONTEXT: ToolSchema = {
    "name": TOOL_SEARCH_CONTEXT,
    "description": (
        "Retrieve evidence chunks for your assigned document type from the current "
        "session corpus and your dedicated knowledge base. Always call this tool "
        "BEFORE recording any finding — every finding must cite chunks returned by "
        "this tool. Returns a numbered list of chunks with filename, page, "
        "chunk_index, and quoted text."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Natural-language query, in English or Hungarian.",
                "minLength": 1,
            },
            "n_results": {
                "type": "integer",
                "description": "How many chunks to return (1-20, default 5).",
                "minimum": 1,
                "maximum": 20,
                "default": 5,
            },
        },
        "required": ["query"],
    },
}


RECORD_FINDING: ToolSchema = {
    "name": TOOL_RECORD_FINDING,
    "description": (
        "Emit a structured finding. MUST cite at least one evidence_chunks entry "
        "that was actually returned by a previous search_context call this run. "
        "Hallucinated citations are rejected and you will be asked to retry."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "kind": {
                "type": "string",
                "enum": ["consistency_error", "benchmark_risk", "missing_element"],
                "description": (
                    "consistency_error: contradiction within or about your doc type. "
                    "benchmark_risk: pricing metric outside an interquartile range. "
                    "missing_element: mandatory section/data absent from the document."
                ),
            },
            "payload": {
                "type": "object",
                "description": (
                    "Finding body. Required fields depend on `kind`:\n"
                    " - consistency_error: { description: str, severity: low|medium|high|critical, "
                    "locations: [{filename: str, line_numbers?: [int]}], evidence?: str }\n"
                    " - benchmark_risk: { metric: str, observed_value: number, "
                    "benchmark_range: [number, number], severity: ..., rationale: str, "
                    "locations: [{filename, line_numbers?}] }\n"
                    " - missing_element: { description: str, expected_in: str, "
                    "required_by: str, severity: ... }"
                ),
            },
            "evidence_chunks": {
                "type": "array",
                "minItems": 1,
                "description": (
                    "Citations. Each entry MUST match a chunk returned by "
                    "search_context this run."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "filename": {"type": "string"},
                        "page": {"type": "integer", "minimum": 0},
                        "chunk_index": {"type": "integer", "minimum": 0},
                        "quote": {
                            "type": "string",
                            "maxLength": 500,
                            "description": "Optional short verbatim excerpt.",
                        },
                    },
                    "required": ["filename", "page", "chunk_index"],
                },
            },
            "rule_id": {
                "type": "string",
                "description": (
                    "Optional ruleset identifier (e.g. 'NGM_32_2017.section_4'). "
                    "Use when the finding maps to a known regulation."
                ),
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Calibrated confidence in the finding (0..1).",
            },
        },
        "required": ["kind", "payload", "evidence_chunks", "confidence"],
    },
}


ALL_TOOLS: list[ToolSchema] = [SEARCH_CONTEXT, RECORD_FINDING]
