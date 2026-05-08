# Backend Layer — REDLINE PHANTOM

## What This Is
Python FastAPI backend for a transfer pricing documentation consistency auditor. Multi-agent AI pipeline that analyzes TP document packages for contradictions, missing elements, and benchmark deviations.

## Tech Stack
- Python FastAPI (async), Pydantic v2 for DTOs
- ChromaDB for vector storage, sentence-transformers for embeddings
- Claude API (Sonnet for agents, Opus for aggregation)
- pypdf / python-docx / LlamaParse for document parsing

## Key Directories
- `rulesets/` — JSON rulesets driving deterministic classification and scoring (DO NOT hardcode these values)
- `services/` — business logic (parsing, agents, scoring)
- `models/` — Pydantic DTOs and domain models
- `routers/` — FastAPI route handlers (thin, delegate to services)

## Critical Rules
- Every finding MUST have source references (`doc_id:page:paragraph`).
- Severity and risk scores MUST be computed from `rulesets/severity_scoring.json` weights.
- Document classification MUST use `rulesets/document_classification.json` signals.
- TP method identification MUST use `rulesets/tp_method_classification.json`.
- NAV risk categories MUST use `rulesets/nav_risk_categories.json`.
- Full type hints everywhere. No `Any` or bare `dict` in public APIs.
- Ruff for lint/format. Fail fast in dev mode.
- No document content in logs. Treat uploads as confidential.

## Agent Pipeline
Sequential LLM calls with shared context (not LangGraph/CrewAI):
1. Structure Agent → entity/transaction/document map
2. Consistency Agent → cross-document contradictions
3. Completeness Agent → mandatory element checklist
4. Benchmark Agent → IQR range validation
5. Risk Scorer → aggregated NAV-oriented risk report

## API Contract
- REST under `/api/v1/`
- Envelope format: `{ data, meta, errors }`
- Upload: multipart, returns classified document list
- Analyze: triggers pipeline, returns job ID
- Results: findings with filtering (severity, category, document)
