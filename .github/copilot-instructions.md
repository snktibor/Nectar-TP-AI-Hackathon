# GitHub Copilot Harness Instructions — NECTAR TP

## Purpose

Transfer pricing documentation consistency auditor for PwC Hungary AI Hackathon 2026.
Multi-agent AI system analyzing TP document packages for contradictions, missing elements, and benchmark deviations.

## Project Docs

- `docs/project-rag-overview.md` — short project-level RAG and workflow overview.
- `docs/run-backend-frontend.md` — concise local startup guide for backend and frontend.

## Core Workflow

1. Start with `.github/agents/orchestrator.md`.
2. Define API and DTO boundaries before coding.
3. Implement in the correct layer (`app/backend` or `app/frontend`).
4. Apply `.github/agents/coding-principles.md` as mandatory refactor pass.
5. Validate security with `.github/agents/security-validator.md`.
6. Align UX with `.github/agents/ui-ux-style-profile.md`.
7. **Run `.github/agents/docs-sync.md`** to synchronize instruction files after changes.

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

## Ruleset-Driven Behavior

Use backend rulesets as the deterministic baseline:

- `app/backend/rulesets/document_classification.json` — implemented document type classification
- `app/backend/rulesets/tp_method_classification.json` — planned CUP/RPM/CPM/TNMM/PSM classification
- `app/backend/rulesets/severity_scoring.json` — planned weighted severity scoring
- `app/backend/rulesets/nav_risk_categories.json` — planned audit triggers and penalties
- `app/backend/rulesets/official_sources.json` — pinned official legal-source catalog (metadata, hashes, aliases, section anchors)

## Current PoC Features

- Batch PDF/DOCX ingest through `POST /api/v1/documents/ingest`.
- FastAPI backend with standardized `{success, data, error, meta}` envelope.
- Parser, classifier with ruleset filename overrides, chunker, and ChromaDB vector store services through the shared no-telemetry local client factory.
- Official legal-source catalog service (`official_sources.json`) with hash validation script (`python -m scripts.validate_sources`) and catalog-driven legal RAG indexing (`python -m scripts.index_rulesets`).
- Audit start uses mock mode by default and fails fast with a sanitized configuration error if real-agent mode is enabled without credentials.
- Document file retrieval supports inline browser viewing with byte-range responses for faster PDF rendering.
- Mobile dashboard navigation uses a full-height left drawer with locked background scroll and local menu state.
- React `DocumentIngestor` with strict 5-document intake, required-category validation, detailed classification issue reporting, and targeted/bulk replacement for missing or duplicated required categories.
- Processed document state hides upload guidance and exposes `Újrakezdés` beside the category status while keeping the document summary visible.
- Frontend PDF evidence viewer prioritizes the target citation page first and applies quote highlighting as best-effort.
- Active frontend audit flow wired to `POST /api/v1/audits/start`, polling `GET /status/{id}`, and loading `GET /results/{id}`.
- Read-only legal-source endpoints exposed at `/api/v1/legal-sources`, `/api/v1/legal-sources/{source_id}`, and `/api/v1/legal-sources/{source_id}/file`.
- Backend-driven report UI with findings, per-agent run breakdown, telemetry tabs, and finding group badges beside severity.
- `Riport` view generates a 20+ page enterprise PDF in the browser with `@react-pdf/renderer` and a centered confidential download CTA.
- `phantomDesign` frontend design system with Tailwind `phantom` tokens.

## Agent Roster

### Infrastructure

- orchestrator, backend, frontend, coding-principles, security-validator, ui-ux-style-profile, docs-sync

### TP Domain

- tp-structure-agent, tp-consistency-agent, tp-completeness-agent, tp-benchmark-agent, tp-risk-scorer

## Quality Gate

- Keep changes small, explicit, and maintainable.
- Never hardcode secrets.
- Keep contracts, rulesets, and implementation aligned.
- Do not emit unsourced findings.
- Run docs-sync after layer changes.

## Operational Policies

- Enforce strict typing in backend and frontend.
- Keep prompts focused to relevant files.
- Defensive prompting: implementation + happy path + edge case checks.
- Ruff / ESLint / Prettier feedback loops immediately.
- Fail fast in development on invalid assumptions.

## Mandatory Official Best Practices

- Follow `docs/GitHub-Principle.md` and `docs/Claude-Principle.md`.
- If guidance conflicts, apply the stricter rule.
- If full compliance is not possible, state the gap and safest fallback.

## Definition Of Done

- Scope and acceptance criteria satisfied end-to-end.
- Layer boundaries and contract-first design intact.
- Strict typing and lint/type/format checks pass.
- Security baseline preserved.
- Findings are source-cited, explainable, reproducible from rulesets.
- `.github/agents/*` and `.claude/agents/*` stay semantically synchronized.
- Docs-sync agent has verified instruction file currency.
