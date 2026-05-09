---
description: 'Backend standards for REDLINE PHANTOM FastAPI, ingest, rulesets, and audit pipeline work.'
applyTo: 'app/backend/**/*.py, app/backend/**/*.json, app/backend/requirements.txt'
---

# Backend Instructions — REDLINE PHANTOM

## Project Context
Transfer pricing documentation consistency auditor for PwC Hungary AI Hackathon 2026.
Multi-agent system analyzing Master File, Local File, contracts, invoices, and benchmark studies for contradictions, missing mandatory elements, and benchmark deviations.

## Tech Stack
- **Framework:** Python FastAPI (async)
- **Document parsing:** pypdf + python-docx; LlamaParse optional later
- **Vector DB:** ChromaDB (local file-based)
- **Embedding:** ChromaDB default embedding in PoC; paraphrase-multilingual-MiniLM-L12-v2 target later
- **LLM:** Mock audit service in PoC; Claude Sonnet/Opus target later
- **Orchestration:** Custom sequential Python service (no LangGraph/CrewAI)

## Architecture
- `app/backend/` is the root for all backend code.
- Rulesets live in `app/backend/rulesets/*.json` and drive deterministic classification and planned scoring.
- The current ingest pipeline: Upload → Parse → Classify → Chunk → ChromaDB index → API response.
- The target audit pipeline: Ingestion → Structure mapping → Consistency → Completeness → Benchmark → Risk scoring → API response.

## Rulesets (Deterministic Baseline)
These JSON rulesets MUST be used as the single source of truth for classification and scoring:
- `document_classification.json` — implemented document type identification (master_file, local_file, contract, invoice, benchmark, etc.), including filename overrides for generated/system reports
- `tp_method_classification.json` — planned TP method detection (CUP, RPM, CPM, TNMM, PSM)
- `severity_scoring.json` — planned finding severity levels (critical/high/medium/low)
- `nav_risk_categories.json` — planned NAV audit triggers and penalty categories

## Engineering Rules
- Full type hints on all public interfaces. Pydantic models for all request/response DTOs.
- No `dict` or `Any` in public API contracts.
- Business logic in services, not route handlers.
- Every finding MUST include a source reference (`doc_id:page:paragraph`).
- Every finding MUST include a severity level and confidence score.
- Ruff for linting and formatting. Auto-fix on save.
- Fail fast in development: no empty catch blocks, no silent error swallowing.

## Domain Model (Core DTOs)
- **Document** — uploaded file with classified type, page count, chunk list
- **Entity** — extracted organization with role, country, relationship
- **Transaction** — intercompany transaction with parties, type, period, amounts
- **Finding** — analysis result with ID, type, severity, source citations, financial impact
- **RiskReport** — aggregated score, risk level, ranked drivers, remediation list

## Chunk Model
Every text segment must carry: `doc_id`, `page`, `paragraph`, `section_heading`, `text`, `embedding_id`.
Source references are non-negotiable — unsourced findings are invalid.

## Security
- Treat all uploaded documents as confidential tax material.
- No document content in logs.
- Validate file type, size, and count on upload.
- Sanitized error responses only.
- No credentials or tokens in code or logs.
- Explicit retention policy for uploaded documents.

## API Design
- RESTful endpoints under `/api/v1/`.
- Upload and ingest endpoints with multipart form data.
- Analysis trigger endpoint returning job ID.
- Polling or SSE endpoint for analysis progress.
- Results endpoint for completed audit reports.
- All responses use consistent envelope: `{success, data, error, meta}`.

## Current API Endpoints
- `GET /health` — health probe.
- `POST /api/v1/documents/upload` — simple document metadata upload.
- `GET /api/v1/documents/{session_id}` — session document listing.
- `GET /api/v1/documents/{session_id}/file/{filename}` — inline original file retrieval for browser/PDF viewing with byte-range response support.
- `POST /api/v1/documents/ingest` — batch parse, classify, chunk, and vectorize PDF/DOCX files.
- `POST /api/v1/audits/start` — start mock audit job.
- `GET /api/v1/audits/status/{audit_task_id}` — poll mock job status.
- `GET /api/v1/audits/results/{audit_task_id}` — fetch final mock report.

## Agent Pipeline Implementation
The "multi-agent" system is 3+ sequential LLM calls with shared working memory:
1. Structure Agent: extract entities, transactions, document map
2. Consistency Agent: cross-document contradiction detection
3. Completeness Agent: mandatory element checklist evaluation
4. Benchmark Agent: IQR range validation against actual pricing
5. Risk Scorer: aggregate findings into NAV-oriented risk report

Each agent reads from shared context and appends structured findings.

## Quality Gates
- Lint (Ruff) must pass before commit.
- Type checking must pass.
- Every finding is traceable to a ruleset rule or source document.
- Risk scores are reproducible from `severity_scoring.json` weights.
