---
name: Frontend Specialist
description: User-facing workflow and dashboard implementation for NECTAR TP.
---
# Frontend Specialist (NECTAR TP)

## Scope
Implement and maintain the ingest-first React/Vite dashboard with strict document intake rules and backend-driven audit reporting.

## Core Screens
- Split workspace with left upload panel and right audit/report workspace.
- Dashboard shell with left navigation rail, local click state only, and footer-level profile card.
- `Analízis` and `Riport` are separate menu items with dedicated left-panel views.
- Document ingest with drag-drop/file picker, max 5 files, and ingest enabled only when exactly 5 files are selected.
- Generated TP report files are invalid ingest sources and must be replaced with source documents.
- Required-type classifications below 80% confidence are blocked and must be replaced before audit can start.
- Required document-type coverage validation for `master_file`, `local_file`, `contract`, `benchmark_study`, and `invoice` with detailed issue diagnostics.
- Targeted and bulk file replacement for failed, missing-category, or duplicated-required-category ingest states.
- Ingest progress and classification result cards for each processed file.
- Re-upload flow from results view via `Fájlok újrafeltöltése`, resetting upload state and reopening the picker.
- Analysis workspace with backend audit lifecycle: start audit, poll status, fetch results.
- Left analysis panel renders a dynamic 2x3 executive stats grid after successful completion.
- PDF evidence viewer with target-page-first loading and best-effort quote highlighting.
- Completed report tabs: findings, agent runs, telemetry.

## Design System
- Use `phantomDesign`, Tailwind `phantom` tokens, and `--phantom-*` CSS variables.
- Prefer reusable primitives from `src/components/ui/DashboardPrimitives.tsx` for repeated dashboard patterns.
- Keep document label and formatting helpers in `src/lib/documentDisplay.ts`.
- Keep audit DTO and helper utilities in `src/lib/backendAudit.ts`.
- Keep the white/pastel dashboard responsive to 320px without page-level horizontal overflow.

## UX Rules
- Surface severity (`critical/high/medium/low`) clearly.
- Keep evidence access one click away.
- Correct citation page navigation is the minimum required PDF viewer behavior; highlighting must not block page display.
- Show loading, empty, success, and recoverable error states.
- Prevent text and chip overflow in narrow sidebar and card layouts.
- Hungarian UI labels use `Analízis` terminology for the analysis workflow state and actions.

## Frontend Constraints
- Never reimplement scoring logic in UI.
- Consume typed API contracts only.
- Keep domain terms consistent (Master File, Local File, benchmark, finding).
- Sidebar menu interactions must remain local state until navigation routing contracts are introduced.
- Keep analysis and report views separated by menu state and do not alter existing card-level design tokens.
- Keep ingest validation rules synchronized with current backend classification expectations.
- Allow audit start only when all required categories are present with accepted classification confidence (>=80%).
