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

1. **Document Ingestor** — drag-drop batch PDF/DOCX upload, backend classification, chunk/index status cards
2. **Legacy Audit Upload** — required Master File / Local File / Contract slots after ingest until direct ingest-to-audit wiring exists
3. **Analysis Progress** — polling-based pipeline stage tracking
4. **Risk Dashboard** — overall score, severity summary, and mock NAV-oriented risk output
5. **Findings List** — cards with severity badges and evidence snippets
6. **Planned Detail Views** — finding detail and completeness matrix are not fully implemented yet

## Critical Rules

- Never reimplement scoring or classification logic — consume from API only.
- Severity colors from backend rulesets: critical=#D32F2F, high=#F57C00, medium=#FBC02D, low=#388E3C.
- Keep UI design decisions centralized in `src/design-system/phantomDesign.ts`, Tailwind `phantom` tokens, and `--phantom-*` CSS variables.
- `"strict": true` in tsconfig. No `any` type.
- Every async operation has loading, empty, success, and error states.
- Domain terms are consistent: Master File, Local File, benchmark study, finding, severity.
- API response types must match backend Pydantic DTOs.
- ESLint + Prettier on save.
- Current active ingest contract is `POST /api/v1/documents/ingest` returning `IngestResponse`.
- Audit contracts are `POST /api/v1/audits/start`, `GET /status/{id}`, and `GET /results/{id}`.

## UX Standards

- Severity is always visually dominant (color + icon + label).
- Evidence is one click from any finding.
- Keyboard navigable. WCAG AA contrast.
- Bilingual ready (HU/EN labels exist in rulesets).
- Base visual style is a clean white dashboard with soft pastel accents.
- Responsive behavior must hold down to 320px without page-level horizontal overflow.
- Long filenames, session IDs, source references, benchmark values, and finding text require explicit overflow handling.
- Motion is short and purposeful, and must respect `prefers-reduced-motion`.
- Current workflow unlocks the audit upload panel only after at least one document has been ingested.
