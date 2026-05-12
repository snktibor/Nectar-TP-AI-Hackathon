---
description: 'Backend standards for NECTAR TP FastAPI, ingest, rulesets, and audit pipeline work.'
applyTo: 'app/backend/**/*.py, app/backend/**/*.json, app/backend/requirements.txt'
---

# Backend Instructions — NECTAR TP

## Project Context
Transfer pricing documentation consistency auditor for PwC Hungary AI Hackathon 2026.
Multi-agent system analyzing Master File, Local File, contracts, invoices, and benchmark studies for contradictions, missing mandatory elements, and benchmark deviations.

## Tech Stack
- **Framework:** Python FastAPI (async)
- **Document parsing:** pypdf + python-docx; LlamaParse optional later
- **Vector DB:** ChromaDB (local file-based) through the shared Chroma client factory
- **Embedding:** `paraphrase-multilingual-MiniLM-L12-v2` for uploaded-document and legal-knowledge retrieval
- **LLM:** Mock audit service is the safe local default; Claude-backed agents are opt-in with `NECTAR_USE_REAL_AGENTS=true` and a non-empty Anthropic key
- **Orchestration:** Custom sequential Python service (no LangGraph/CrewAI)

## Architecture
- `app/backend/` is the root for all backend code.
- Rulesets live in `app/backend/rulesets/*.json` and drive deterministic classification/planned scoring; `app/backend/rulesets/official_sources.json` is the pinned legal-source catalog for legal RAG indexing.
- The current ingest pipeline: Upload → Parse → Classify → Chunk → ChromaDB index → API response.
- Audit pipeline modes: mock staged reports by default; explicit real-agent mode runs Ingestion → Structure mapping → Consistency → Completeness → Benchmark → Risk scoring → API response.

## Rulesets (Deterministic Baseline)
These JSON rulesets MUST be used as the single source of truth for classification and scoring:
- `document_classification.json` — implemented document type identification (master_file, local_file, contract, invoice, benchmark, etc.), including strict confidence thresholding (low-confidence fallback to `other`) and filename overrides for generated/system reports
- `tp_method_classification.json` — planned TP method detection (CUP, RPM, CPM, TNMM, PSM)
- `severity_scoring.json` — planned finding severity levels (critical/high/medium/low)
- `nav_risk_categories.json` — planned NAV audit triggers and penalty categories- `official_sources.json` — implemented pinned official legal-source catalog (metadata, hashes, aliases, section anchors)
## Engineering Rules
- Full type hints on all public interfaces. Pydantic models for all request/response DTOs.
- No `dict` or `Any` in public API contracts.
- Business logic in services, not route handlers.
- Classification confidence gating must be deterministic and strict; low-confidence required-type guesses must not pass readiness.
- Every finding MUST include a source reference (`doc_id:page:paragraph`).
- Every finding MUST include a severity level and confidence score.

### Security & Reliability Rules
- **CORS:** Explicit origin allowlist from settings; wildcard origins disallowed.
- **Error responses:** 500 errors must never expose internal exception class names or stack traces in API responses.
- **Rate limiting:** Protect upload (5/minute), ingest (3/minute), and audit-start (2/minute) endpoints against request flooding via slowapi.
- **Session TTL:** In-memory sessions expire after 24 hours. Cleanup runs opportunistically on document list/download operations.
- **Path traversal:** `_load_from_datasets()` validates all candidate file paths are under `datasets/` root before serving bytes.
- **Prompt injection:** Tool schema for `search_context` enforces 500-char max length and Unicode pattern validation on query input.
- **SSRF hardening:** `verify_tax_number()` validates country_code strictly against ISO 3166-1 alpha-2 format (`^[A-Z]{2}$`).
- **Audit runtime preconditions:** Real-agent mode must fail fast before background task scheduling when provider credentials are missing or blank.
- **Chroma telemetry:** Product telemetry is disabled by default for confidential local document processing.
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
- CORS must use an explicit origin allowlist; wildcard origins are not acceptable outside local development.
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
- `POST /api/v1/audits/start` — start the configured audit job; mock by default, real agents only when explicitly enabled, with sanitized 503 configuration failures.
- `GET /api/v1/audits/status/{audit_task_id}` — poll mock job status.
- `GET /api/v1/audits/results/{audit_task_id}` — fetch final mock report.
- `GET /api/v1/legal-sources` — list pinned official legal source metadata.
- `GET /api/v1/legal-sources/{source_id}` — fetch one legal source metadata record.
- `GET /api/v1/legal-sources/{source_id}/file` — stream cached legal source PDF with byte-range support.

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
