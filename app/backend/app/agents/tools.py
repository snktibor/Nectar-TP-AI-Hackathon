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
                "maxLength": 500,
                "pattern": "^[\\p{L}\\p{N}\\p{P}\\p{Z}\\-_.,:;!?()\\[\\]{}\"'&@#+=/<>%$\\*]+$"
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
                    "Finding body. Required fields depend on `kind`. Note: "
                    "`locations` entries take ONLY {filename, line_numbers?}. "
                    "Do NOT add page/chunk_index/source_kind there — those "
                    "belong in evidence_chunks (separate parameter).\n"
                    " - consistency_error: { description: str, "
                    "severity: low|medium|high|critical, "
                    "locations: [{filename: str, line_numbers?: [int]}], "
                    "evidence?: str }\n"
                    " - benchmark_risk: { metric: str, observed_value: number, "
                    "benchmark_range: [number, number], severity: ..., "
                    "rationale: str, locations: [{filename, line_numbers?}] }\n"
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
                    "Primary ruleset identifier (e.g. 'NGM_32_2017.section_4'). "
                    "Use when the finding maps to a known regulation."
                ),
            },
            "legal_references": {
                "type": "array",
                "items": {"type": "string"},
                "description": (
                    "Additional regulation/guideline citations beyond rule_id "
                    "(e.g. ['OECD_TPG_2022.Ch_VI', 'HU_Act_LXXXI_1996.§31_B'])."
                ),
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": (
                    "Calibrated confidence in [0,1]. ≥0.9 only when the cited "
                    "evidence directly proves the finding. 0.5–0.8 means "
                    "inferential gaps remain — RECORD ANYWAY with "
                    "requires_human_review=true so the human reviewer sees "
                    "your concern. Only skip recording when confidence is "
                    "below 0.3 (essentially no evidence of a real issue). "
                    "Failing to record a real concern is worse than recording "
                    "with a caveat — humans can dismiss; they cannot review "
                    "what you never reported."
                ),
            },
            "reasoning": {
                "type": "string",
                "minLength": 20,
                "maxLength": 2000,
                "description": (
                    "Plain-language reasoning chain: how you moved from the cited "
                    "evidence chunks to this finding. Quote the relevant phrasing, "
                    "name the contradiction, and explain why the law/standard you "
                    "cite applies. Surfaced verbatim in the UI's explainability "
                    "panel for the human reviewer."
                ),
            },
            "uncertainty_notes": {
                "type": "string",
                "maxLength": 1000,
                "description": (
                    "Explicit caveats: ambiguity in the source text, missing "
                    "context, limits of the retrieved evidence, alternative "
                    "interpretations. Use this to avoid false certainty. Leave "
                    "out only if the finding has no known caveats."
                ),
            },
            "requires_human_review": {
                "type": "boolean",
                "description": (
                    "Whether a human expert MUST validate this finding before "
                    "action. Default True. Lower to False only when confidence "
                    "is ≥0.9 AND the finding maps cleanly to a cited legal "
                    "reference AND the citation directly proves the finding."
                ),
            },
        },
        "required": [
            "kind",
            "payload",
            "evidence_chunks",
            "confidence",
            "reasoning",
        ],
    },
}


TOOL_VERIFY_TAX_NUMBER = "verify_tax_number"

VERIFY_TAX_NUMBER: ToolSchema = {
    "name": TOOL_VERIFY_TAX_NUMBER,
    "description": (
        "Validate a counterparty tax / VAT number against an official external registry. "
        "Call this tool whenever you extract a company tax ID or VAT number from an invoice, "
        "contract, or any TP document. Returns is_valid, company_name, company_address, "
        "and the registry source used."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "country_code": {
                "type": "string",
                "description": "ISO 3166-1 alpha-2 country code (e.g. 'HU', 'DE', 'AT').",
                "minLength": 2,
                "maxLength": 2,
            },
            "vat_number": {
                "type": "string",
                "description": (
                    "The numeric or alphanumeric VAT identifier WITHOUT the country-code prefix "
                    "(e.g. '123456789' not 'DE123456789')."
                ),
                "minLength": 1,
            },
        },
        "required": ["country_code", "vat_number"],
    },
}


ALL_TOOLS: list[ToolSchema] = [SEARCH_CONTEXT, RECORD_FINDING, VERIFY_TAX_NUMBER]
