# NECTAR TP — AI Harness Root Instructions

## Project Identity

**NECTAR TP** — Transfer Pricing Documentation Consistency Auditor.
PwC Hungary AI Hackathon 2026. Team: Kerek Barackok (Hajdú Patrik Zsolt, Sinka Tibor, Jonás Gergely).

Multi-agent AI system that analyzes multinational TP documentation packages (Master File, Local File, contracts, invoices, benchmark studies) for cross-document contradictions, missing mandatory elements, and benchmark range deviations — before NAV does.

## Project Docs

- `docs/project-rag-overview.md` — short project-level RAG and workflow overview.
- `docs/run-backend-frontend.md` — concise local startup guide for backend and frontend.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + Vite + TypeScript (strict) + Tailwind CSS 3.4 |
| Backend | Python FastAPI (async) + Pydantic v2 |
| Document parsing | pypdf + python-docx (LlamaParse optional later) |
| Vector DB | ChromaDB (local file-based) |
| Embedding | ChromaDB default embedding in PoC; HU+EN MiniLM target later |
| LLM | Mock agent service in PoC; Claude Sonnet/Opus target later |
| Orchestration | Custom sequential Python service (no LangGraph/CrewAI) |

## Architecture

```text
[Upload/Ingest] → [Parser] → [Classifier] → [Chunker] → [Vector Index] → [Agent Pipeline] → [Risk Dashboard]

Agent Pipeline (sequential with shared memory):
1. Structure Agent → entity/transaction/document map
2. Consistency Agent → cross-document contradictions
3. Completeness Agent → mandatory element checklist (32/2017 NGM)
4. Benchmark Agent → IQR range validation
5. Risk Scorer → aggregated NAV-oriented risk report
```

## Rulesets (Deterministic Baseline)

Implemented classification and planned scoring use JSON rulesets in `app/backend/rulesets/`:

- `document_classification.json` — implemented document type classification signals
- `tp_method_classification.json` — planned CUP/RPM/CPM/TNMM/PSM classification
- `severity_scoring.json` — planned critical/high/medium/low weighted scoring
- `nav_risk_categories.json` — planned audit triggers, penalties, entity categories

## Current PoC Features

- Batch PDF/DOCX ingest through `POST /api/v1/documents/ingest`.
- pypdf/python-docx parsing, ruleset classification, chunking, and ChromaDB indexing.
- React `DocumentIngestor` enforces a strict 5-document intake per run, validates required category coverage (`master_file`, `local_file`, `contract`, `benchmark_study`, `invoice`), and supports targeted/bulk replacement for missing or duplicated required categories.
- Document file retrieval supports inline browser viewing with byte-range responses for faster PDF rendering.
- Frontend PDF evidence viewer prioritizes the target citation page first and applies quote highlighting as best-effort.
- Frontend audit flow is actively wired to `/api/v1/audits/start`, `/status/{id}`, and `/results/{id}` with polling lifecycle handling.
- `AnalysisWorkspace` renders backend-driven findings, per-agent runs, and telemetry tabs.
- `phantomDesign` frontend design system with Tailwind `phantom` tokens.

## Roles And Delegation

- **Orchestrator**: Analyze every task, split responsibilities by layer, define API contracts first.
- **Frontend / Backend Specialists**: Implement cleanly within their designated layers.
- **TP Domain Agents**: Structure, Consistency, Completeness, Benchmark, Risk Scorer.
- **Validators**: Coding principles and security validation after every implementation.
- **Docs-Sync Agent**: Automatically synchronize instruction files when layer changes occur.

## Strict Execution Cycle

1. A request arrives → read `.claude/agents/orchestrator.md` (Claude) or `.github/agents/orchestrator.md` (Copilot).
2. Design communication boundaries (API contracts, DTO structures).
3. Delegate implementation to the right specialist (`frontend` or `backend`).
4. After coding, a refactor pass with `coding-principles` agent is mandatory.
5. Validate the result using `security-validator` agent.
6. **Run docs-sync agent** to update instruction files if layer code changed.

## Reliability Policies

### 1. Strict Typing First

- Backend: Full type hints + Pydantic models. No `dict` or `Any` in public APIs.
- Frontend: TypeScript strict mode. No `any`.

### 2. Context Hygiene

- Reference only minimum required files per task.
- Avoid mixing frontend and backend concerns in one prompt.

### 3. Defensive Prompting

- Implementation + 2-3 inline asserts verifying happy path and one edge case.

### 4. Micro-Commit Workflow

- Commit after each stable step. Rollback safely on regression.

### 5. Immediate Lint And Format

- Backend: Ruff. Frontend: ESLint + Prettier. Treat diagnostics as immediate signals.

### 6. Fail Fast In Development

- No empty catch blocks. Crash on invalid assumptions. Graceful degradation only in production UX.

## Domain Rules

- Every finding MUST include source references (`doc_id:page:paragraph`).
- Every finding MUST include severity level and confidence score.
- Risk scores MUST be reproducible from ruleset weights.
- Unsourced or uncited findings are invalid and must be rejected.
- Treat uploaded documents as confidential tax material.

## Mandatory Official Best Practices

- Follow `docs/GitHub-Principle.md` and `docs/Claude-Principle.md`.
- If guidance conflicts, apply the stricter rule.
- If full compliance is impossible, state the gap and choose the safest fallback.

## Definition Of Done

- Scope and acceptance criteria satisfied end-to-end.
- Layer boundaries and contract-first design intact.
- Strict typing and lint/type/format checks pass.
- Security baseline preserved (no secrets, validated inputs, least privilege).
- Findings are source-cited, explainable, and reproducible from rulesets.
- Docs-sync agent has been run — instruction files are current.
