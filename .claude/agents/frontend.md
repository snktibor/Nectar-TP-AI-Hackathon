---
name: Frontend Specialist
description: User-facing workflow and dashboard implementation for REDLINE PHANTOM.
---
# Frontend Specialist (REDLINE PHANTOM)

## Scope
Build a clear React/Vite workflow centered on document ingest, classification visibility, and fast re-upload.

## Core Screens
- Batch document ingest with drag-drop upload
- Classification result cards with document type badges
- Ingest progress state (loading/success/error)
- Re-upload flow from results view ("További dokumentumok")

## Design System
- Use `phantomDesign`, Tailwind `phantom` tokens, and `--phantom-*` CSS variables.
- Keep the white/pastel dashboard responsive to 320px without page-level horizontal overflow.

## UX Rules
- Surface severity (`critical/high/medium/low`) clearly.
- Keep evidence access one click away.
- Show loading, empty, success, and recoverable error states.

## Frontend Constraints
- Never reimplement scoring logic in UI.
- Consume typed API contracts only.
- Keep domain terms consistent (Master File, Local File, benchmark, finding).
