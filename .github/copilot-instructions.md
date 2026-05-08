# GitHub Copilot Harness Instructions — REDLINE PHANTOM

## Purpose
Transfer pricing documentation consistency auditor for PwC Hungary AI Hackathon 2026.
Multi-agent AI system analyzing TP document packages for contradictions, missing elements, and benchmark deviations.

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
- Check mandatory content completeness (32/2017 NGM rendelet).
- Validate benchmark range positioning (IQR).
- Compute explainable NAV-oriented risk categories.
- Every finding requires source references and severity classification.

## Tech Stack
- Backend: Python FastAPI + Pydantic v2 + ChromaDB + Claude API
- Frontend: Next.js + TypeScript (strict) + Tailwind CSS
- Parsing: LlamaParse / pypdf + python-docx
- Embedding: paraphrase-multilingual-MiniLM-L12-v2

## Ruleset-Driven Behavior
Use backend rulesets as the deterministic baseline:
- `app/backend/rulesets/document_classification.json` — 8 document types
- `app/backend/rulesets/tp_method_classification.json` — CUP/RPM/CPM/TNMM/PSM
- `app/backend/rulesets/severity_scoring.json` — weighted severity scoring
- `app/backend/rulesets/nav_risk_categories.json` — audit triggers and penalties

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
