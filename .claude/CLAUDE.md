# Claude Harness Instructions — REDLINE PHANTOM

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

## Rulesets

Implemented classification and planned scoring use `app/backend/rulesets/*.json`:

- `document_classification.json` — implemented document type signals
- `tp_method_classification.json` — planned TP method identification
- `severity_scoring.json` — planned finding severity weights
- `nav_risk_categories.json` — planned audit triggers and penalties

## Current PoC Features

- React 18 + Vite + Tailwind frontend with `DocumentIngestor` and `phantomDesign` tokens.
- FastAPI backend with standardized `{success, data, error, meta}` envelope.
- Batch PDF/DOCX ingest, parsing, ruleset classification, chunking, and ChromaDB indexing.
- Mock audit pipeline with polling endpoints and demo risk report output.

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
