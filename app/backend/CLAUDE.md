# Backend Layer — REDLINE PHANTOM

## What This Is

Python FastAPI backend for a transfer pricing documentation consistency auditor. Multi-agent AI pipeline that analyzes TP document packages for contradictions, missing elements, and benchmark deviations.

## Tech Stack

- Python FastAPI (async), Pydantic v2 for DTOs
- ChromaDB for local vector storage
- Mock agent service for PoC audit reports; Claude API integration is a target next step
- pypdf / python-docx for document parsing; LlamaParse is optional later

## Key Directories

- `rulesets/` — JSON rulesets driving deterministic classification and planned scoring
- `app/services/` — parser, classifier, chunker, vector store, ingest pipeline, mock audit service
- `app/models/` — Pydantic DTOs and domain models
- `app/api/v1/endpoints/` — FastAPI route handlers (thin, delegate to services)
- `data/chromadb/` — generated local ChromaDB persistence data

## Critical Rules

- Every finding MUST have source references (`doc_id:page:paragraph`).
- Severity and risk scores MUST be computed from `rulesets/severity_scoring.json` weights.
- Document classification MUST use `rulesets/document_classification.json` signals.
- TP method identification MUST use `rulesets/tp_method_classification.json` once that ruleset is implemented.
- NAV risk categories MUST use `rulesets/nav_risk_categories.json` once that ruleset is implemented.
- Full type hints everywhere. No `Any` or bare `dict` in public APIs.
- Ruff for lint/format. Fail fast in dev mode.
- No document content in logs. Treat uploads as confidential.

## Agent Pipeline

Current PoC uses a mock async audit pipeline with staged progress. Target pipeline is sequential LLM calls with shared context (not LangGraph/CrewAI):

1. Structure Agent → entity/transaction/document map
2. Consistency Agent → cross-document contradictions
3. Completeness Agent → mandatory element checklist
4. Benchmark Agent → IQR range validation
5. Risk Scorer → aggregated NAV-oriented risk report

## API Contract

- REST under `/api/v1/`
- Envelope format: `{success, data, error, meta}`
- `POST /documents/upload`: multipart metadata upload
- `GET /documents/{session_id}`: session document listing
- `POST /documents/ingest`: batch PDF/DOCX parse, classify, chunk, and vectorize
- `POST /audits/start`: triggers mock audit pipeline and returns job ID
- `GET /audits/status/{audit_task_id}`: polling status
- `GET /audits/results/{audit_task_id}`: final report once completed
