# Backend Instructions — REDLINE PHANTOM

## Project Context
Transfer pricing documentation consistency auditor for PwC Hungary AI Hackathon 2026.
Multi-agent system analyzing Master File, Local File, contracts, invoices, and benchmark studies for contradictions, missing mandatory elements, and benchmark deviations.

## Tech Stack
- **Framework:** Python FastAPI (async)
- **Document parsing:** LlamaParse or pypdf + python-docx fallback
- **Vector DB:** ChromaDB (local file-based)
- **Embedding:** paraphrase-multilingual-MiniLM-L12-v2 (HU+EN)
- **LLM:** Claude Sonnet for agents, Claude Opus for aggregation
- **Orchestration:** Custom sequential Python (no LangGraph/CrewAI)

## Architecture
- `app/backend/` is the root for all backend code.
- Rulesets live in `app/backend/rulesets/*.json` and drive deterministic classification and scoring.
- The pipeline: Ingestion → Structure mapping → Consistency → Completeness → Benchmark → Risk scoring → API response.

## Rulesets (Deterministic Baseline)
These JSON rulesets MUST be used as the single source of truth for classification and scoring:
- `document_classification.json` — document type identification (master_file, local_file, contract, invoice, benchmark, etc.)
- `tp_method_classification.json` — TP method detection (CUP, RPM, CPM, TNMM, PSM) with keyword signals and validation fields
- `severity_scoring.json` — finding severity levels (critical/high/medium/low) with weighted scores per agent type
- `nav_risk_categories.json` — NAV audit triggers, penalty structures, entity/transaction categories

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
- Upload endpoint with multipart form data.
- Analysis trigger endpoint returning job ID.
- Polling or SSE endpoint for analysis progress.
- Results endpoint with filtering (severity, category, document).
- All responses use consistent envelope: `{ data, meta, errors }`.

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
