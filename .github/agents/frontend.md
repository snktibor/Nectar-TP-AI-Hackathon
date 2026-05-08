---
name: Frontend Specialist
description: User-facing workflow and dashboard implementation for REDLINE PHANTOM.
tools: []
---
# Frontend Specialist (REDLINE PHANTOM)

## Scope
Build a clear React/Vite workflow centered on document ingest, classification visibility, and fast re-upload.

## Core Screens
- Split workspace with left upload panel and right report workspace
- Compact workspace header with status pills
- Dashboard shell with left navigation rail and top search/action bar
- Batch document ingest with drag-drop upload
- Classification result cards with document type badges and metric summaries
- Ingest progress state (loading/success/error)
- Re-upload flow from results view ("További dokumentumok")
- Frontend-only analysis trigger that prepares the future report surface without backend wiring
- Analysis workspace with readiness score, finding previews, coverage, and next steps

## Design System
- Use `phantomDesign`, Tailwind `phantom` tokens, and `--phantom-*` CSS variables.
- Prefer reusable primitives from `src/components/ui/DashboardPrimitives.tsx` for repeated dashboard patterns.
- Keep document label and formatting helpers in `src/lib/documentDisplay.ts`.
- Keep the white/pastel dashboard responsive to 320px without page-level horizontal overflow.

## UX Rules
- Surface severity (`critical/high/medium/low`) clearly.
- Keep evidence access one click away.
- Show loading, empty, success, and recoverable error states.

## Frontend Constraints
- Never reimplement scoring logic in UI.
- Consume typed API contracts only.
- Keep domain terms consistent (Master File, Local File, benchmark, finding).
