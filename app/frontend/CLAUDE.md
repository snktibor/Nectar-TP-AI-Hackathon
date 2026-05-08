# Frontend Layer — REDLINE PHANTOM

## What This Is

React + Vite + TypeScript frontend for a transfer pricing documentation consistency auditor. Provides document upload workflow and risk dashboard for reviewing AI-generated findings.

## Tech Stack

- React 18 with Vite
- TypeScript strict mode
- Tailwind CSS 3.4 for styling
- React hooks/context for state
- `phantomDesign` namespace for reusable frontend design tokens and component class groups

## Key Screens

1. **Document Upload** — drag-drop, classified type display, validation
2. **Analysis Progress** — pipeline stage tracking (Structure → Consistency → Completeness → Benchmark → Scoring)
3. **Risk Dashboard** — overall score, severity summary, NAV exposure estimate
4. **Findings List** — filterable cards with severity badges and source links
5. **Finding Detail** — full evidence, source citations, remediation hint
6. **Completeness Matrix** — checklist grid for Master File and Local File

## Critical Rules

- Never reimplement scoring or classification logic — consume from API only.
- Severity colors from backend rulesets: critical=#D32F2F, high=#F57C00, medium=#FBC02D, low=#388E3C.
- Keep UI design decisions centralized in `src/design-system/phantomDesign.ts`, Tailwind `phantom` tokens, and `--phantom-*` CSS variables.
- `"strict": true` in tsconfig. No `any` type.
- Every async operation has loading, empty, success, and error states.
- Domain terms are consistent: Master File, Local File, benchmark study, finding, severity.
- API response types must match backend Pydantic DTOs.
- ESLint + Prettier on save.

## UX Standards

- Severity is always visually dominant (color + icon + label).
- Evidence is one click from any finding.
- Keyboard navigable. WCAG AA contrast.
- Bilingual ready (HU/EN labels exist in rulesets).
- Base visual style is a clean white dashboard with soft pastel accents.
- Responsive behavior must hold down to 320px without page-level horizontal overflow.
- Long filenames, session IDs, source references, benchmark values, and finding text require explicit overflow handling.
- Motion is short and purposeful, and must respect `prefers-reduced-motion`.
