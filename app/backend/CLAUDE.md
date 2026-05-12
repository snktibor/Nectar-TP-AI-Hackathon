# Backend Layer — NECTAR TP

## What This Is

Python FastAPI backend for a transfer pricing documentation consistency auditor. Multi-agent AI pipeline that analyzes TP document packages for contradictions, missing elements, and benchmark deviations.

## Tech Stack

- Python FastAPI (async), Pydantic v2 for DTOs
- ChromaDB for local vector storage via the shared client factory
- Mock agent service is the local default; Claude-backed real agents are opt-in with `NECTAR_USE_REAL_AGENTS=true` and a configured API key
- pypdf / python-docx for document parsing; LlamaParse is optional later

## Key Directories

- `rulesets/` — JSON rulesets driving deterministic classification/planned scoring plus pinned official legal-source catalog metadata
- `app/services/` — parser, classifier, chunker, vector store, Chroma client factory, ingest pipeline, mock audit service, real-agent orchestrator, LLM adapter
- `app/models/` — Pydantic DTOs and domain models
- `app/api/v1/endpoints/` — FastAPI route handlers (thin, delegate to services)
- `data/chromadb/` — generated local ChromaDB persistence data

## Critical Rules

- Every finding MUST have source references (`doc_id:page:paragraph`).
- Severity and risk scores MUST be computed from `rulesets/severity_scoring.json` weights.
- Legal-corpus indexing MUST be driven by `rulesets/official_sources.json` and validated with `python -m scripts.validate_sources` before rebuild.
- Document classification MUST use `rulesets/document_classification.json` signals, including filename override rules for generated/system reports.
- Classification confidence is strict: low-confidence matches must fall back to `other` and must not be treated as required-category-ready.
- Generated/compliance report filename overrides must force `other` with low confidence to avoid false-ready ingest states.
- TP method identification MUST use `rulesets/tp_method_classification.json` once that ruleset is implemented.
- NAV risk categories MUST use `rulesets/nav_risk_categories.json` once that ruleset is implemented.
- Full type hints everywhere. No `Any` or bare `dict` in public APIs.
- Ruff for lint/format. Fail fast in dev mode.
- No document content in logs. Treat uploads as confidential.
- CORS must use explicit origin allowlist from settings; wildcard origins are disallowed.
- 500 responses must not expose internal exception class names or stack details in API payloads.
- Real-agent audit mode must fail fast before background task scheduling when provider credentials are missing.
- Chroma product telemetry is disabled by default for confidential local document processing.

### Security & Reliability Rules

- **Rate limiting:** Protect upload (5/minute), ingest (3/minute), and audit-start (2/minute) endpoints against request flooding via slowapi.
- **Session TTL:** In-memory sessions expire after 24 hours. Cleanup runs opportunistically on document list/download operations. Session creation is tracked on first upload or ingest.
- **Path traversal:** `_load_from_datasets()` validates all candidate file paths are under `datasets/` root before serving bytes (strict parent check via `relative_to()`).
- **Prompt injection:** Tool schema for `search_context` enforces 500-char max length and Unicode/printable-character pattern validation on query input.
- **SSRF hardening:** `verify_tax_number()` validates country_code strictly against ISO 3166-1 alpha-2 format (`^[A-Z]{2}$`) before constructing VIES API URLs.

## Agent Pipeline

Current local default uses a mock async audit pipeline with staged progress. Real Claude-backed agents are available as an explicit opt-in and run as sequential LLM calls with shared context (not LangGraph/CrewAI):

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
- `GET /documents/{session_id}/file/{filename}`: inline original file retrieval for browser/PDF viewing, including byte-range responses for PDF.js
- `POST /documents/ingest`: batch PDF/DOCX parse, classify, chunk, and vectorize
- `POST /audits/start`: triggers the configured audit pipeline, returns a job ID, and returns a sanitized configuration error if real-agent mode lacks credentials
- `GET /legal-sources`: list pinned official legal sources
- `GET /legal-sources/{source_id}`: return metadata for one pinned official legal source
- `GET /legal-sources/{source_id}/file`: stream cached official legal source PDF with byte-range support
- `GET /audits/status/{audit_task_id}`: polling status
- `GET /audits/results/{audit_task_id}`: final report once completed
