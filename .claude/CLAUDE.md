# Claude Harness Instructions — NECTAR TP

## Purpose

Transfer pricing documentation consistency auditor. Multi-agent AI system for PwC Hungary Hackathon 2026.

## Project Docs

- `docs/project-rag-overview.md` — short project-level RAG and workflow overview.
- `docs/run-backend-frontend.md` — concise local startup guide for backend and frontend.

## Core Workflow

1. Start with `.claude/agents/orchestrator.md`.
2. Define API and DTO boundaries before writing code.
3. Implement in the correct layer using frontend or backend specialization.
4. Apply `.claude/agents/coding-principles.md` as a mandatory refactor pass.
5. Validate security with `.claude/agents/security-validator.md`.
6. Align UX with `.claude/agents/ui-ux-style-profile.md`.
7. **Run `.claude/agents/docs-sync.md`** to keep instruction files synchronized.

## Project Scope (Domain)

- Analyze transfer pricing document packages (Master File, Local File, contracts, invoices, benchmark).
- Detect cross-document contradictions with source citations.
- Check mandatory content completeness against the active Hungarian TP decree baseline (catalog-pinned legal sources).
- Validate benchmark range positioning (IQR).
- Compute explainable NAV-oriented risk categories.
- Every finding requires source references and severity classification.

## Tech Stack

- Backend: Python FastAPI + Pydantic v2 + ChromaDB
- Frontend: React 18 + Vite + TypeScript (strict) + Tailwind CSS 3.4
- Parsing: pypdf + python-docx; LlamaParse optional later
- Embedding: paraphrase-multilingual-MiniLM-L12-v2 for uploaded-document and legal-knowledge retrieval
- Agent pipeline: mock service as safe local default; Claude-backed agents are opt-in and require configured credentials

## Agent Roster

### Infrastructure Agents

- `orchestrator.md` — pipeline coordination and API contract design
- `backend.md` — FastAPI services, parsing, ingest pipeline, agent pipeline, scoring
- `frontend.md` — React/Vite dashboard, document ingest workflow, findings UI
- `coding-principles.md` — SOLID, DRY, domain naming, composability
- `security-validator.md` — OWASP checks, document confidentiality
- `ui-ux-style-profile.md` — severity visualization, evidence access UX
- `docs-sync.md` — instruction file synchronization after changes

### TP Domain Agents

- `tp-structure-agent.md` — entity/transaction/document map extraction
- `tp-consistency-agent.md` — cross-document contradiction detection
- `tp-completeness-agent.md` — mandatory element checklist (32/2017 NGM)
- `tp-benchmark-agent.md` — IQR range validation, method coherence
- `tp-risk-scorer.md` — aggregated NAV-oriented risk report

## Ruleset-Driven Behavior

Use backend rulesets as the deterministic baseline:

- `document_classification.json` — implemented document type signals
- `tp_method_classification.json` — planned TP method identification
- `severity_scoring.json` — planned finding severity weights
- `nav_risk_categories.json` — planned audit triggers and penalties
- `official_sources.json` — pinned official legal-source catalog (metadata, hashes, aliases, section anchors)

## Current PoC Features

- React 18 + Vite + Tailwind frontend with strict 5-document ingest guardrails and `phantomDesign` tokens.
- FastAPI backend with standardized `{success, data, error, meta}` envelope.
- Batch PDF/DOCX ingest, parsing, ruleset classification with filename overrides, chunking, and ChromaDB indexing through the shared no-telemetry local client factory.
- Official legal-source catalog service (`official_sources.json`) with hash validation script (`python -m scripts.validate_sources`) and catalog-driven legal RAG indexing (`python -m scripts.index_rulesets`).
- Audit start uses mock mode by default and fails fast with a sanitized configuration error if real-agent mode is enabled without credentials.
- Document file retrieval supports inline browser viewing with byte-range responses for faster PDF rendering.
- Mobile dashboard navigation uses a full-height left drawer with locked background scroll and local menu state.
- Required ingest coverage validation for `master_file`, `local_file`, `contract`, `benchmark_study`, and `invoice` with explicit issue reporting plus targeted/bulk replacement for missing or duplicated required categories.
- Processed document state hides upload guidance and exposes `Újrakezdés` beside the category status while keeping the document summary visible.
- Frontend PDF evidence viewer prioritizes the target citation page first and applies quote highlighting as best-effort.
- Active frontend audit lifecycle wired to `/api/v1/audits/start`, `/status/{id}`, and `/results/{id}` with polling.
- Read-only legal-source endpoints exposed at `/api/v1/legal-sources`, `/api/v1/legal-sources/{source_id}`, and `/api/v1/legal-sources/{source_id}/file`.
- Backend-driven report surface with findings, agent run details, telemetry tabs, and finding group badges beside severity.
- `Riport` view generates a 20+ page enterprise PDF in the browser with `@react-pdf/renderer` and a centered confidential download CTA.

## Quality Gate

- Keep changes small, explicit, and maintainable.
- Never hardcode secrets.
- Keep contracts, rulesets, and implementation aligned.
- Do not emit unsourced findings.
- Run docs-sync after every layer change.

## Operational Policies

- Strict typing in backend (Pydantic) and frontend (TypeScript strict).
- Focused context per task — no mixing layers.
- Defensive prompting: implementation + happy path + edge case checks.
- Ruff / ESLint / Prettier feedback loops immediately.
- Fail fast in dev. Graceful degradation in production UX only.

## Mandatory Official Best Practices

- Follow `docs/GitHub-Principle.md` and `docs/Claude-Principle.md`.
- Stricter rule wins on conflict.
- State gaps explicitly if full compliance is impossible.

## Definition Of Done

- Scope and acceptance criteria satisfied end-to-end.
- Layer boundaries and contract-first design intact.
- Strict typing and lint/type/format checks pass.
- Security baseline preserved.
- Findings are source-cited, explainable, reproducible.
- Instruction files synchronized (docs-sync agent ran).
- `.claude/agents/*` and `.github/agents/*` stay semantically synchronized.
