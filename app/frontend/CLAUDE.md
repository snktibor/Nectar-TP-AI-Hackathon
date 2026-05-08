# Frontend Layer — REDLINE PHANTOM

## What This Is

React + Vite + TypeScript frontend for a transfer pricing documentation consistency auditor. Provides document upload workflow and risk dashboard for reviewing AI-generated findings.

## Tech Stack

- React 18 with Vite
- TypeScript strict mode
- Tailwind CSS 3.4 for styling
- React hooks/context for state
- `phantomDesign` namespace for reusable frontend design tokens and component class groups
- `src/components/ui/DashboardPrimitives.tsx` for reusable dashboard primitives
- `src/lib/documentDisplay.ts` and `src/lib/frontendAnalysis.ts` for shared display and frontend analysis helpers

## Key Screens

1. **Split Workspace** — bal oldali ingest panel és jobb oldali riport/előkészítő munkaterület
2. **Workspace Header** — compact status pills for upload/report state, without restoring the removed session/subtitle header UI
3. **Dashboard Shell** — bal oldali navigáció + felső action/search bar, card-alapú, light-gray control dashboard stílusban
4. **Document Ingestor** — drag-drop batch PDF/DOCX upload, workflow timeline, backend classification, chunk/index metric cards
5. **Ingest Progress** — explicit loading, success, and error states during parsing/indexing
6. **Classification Results** — per-document cards with type badge, page/chunk metadata, confidence, and status
7. **Analysis Workspace** — üresből induló jobb oldali panel, amely sikeres klasszifikáció után elemzési előnézetet, readiness score-t, finding-preview kártyákat és lefedettséget mutat
8. **Re-upload Flow** — results view action to add additional files without full UI reset

## Critical Rules

- Never reimplement scoring or classification logic — consume from API only.
- Severity colors from backend rulesets: critical=#D32F2F, high=#F57C00, medium=#FBC02D, low=#388E3C.
- Keep UI design decisions centralized in `src/design-system/phantomDesign.ts`, Tailwind `phantom` tokens, and `--phantom-*` CSS variables.
- Reuse `DashboardPrimitives` for section headers, metric cards, status pills, empty states, and workflow timelines before creating local one-off UI.
- Keep document label/formatting logic in `src/lib/documentDisplay.ts`, not duplicated in components.
- `"strict": true` in tsconfig. No `any` type.
- Every async operation has loading, empty, success, and error states.
- Domain terms are consistent: Master File, Local File, benchmark study, finding, severity.
- API response types must match backend Pydantic DTOs.
- ESLint + Prettier on save.
- Current active ingest contract is `POST /api/v1/documents/ingest` returning `IngestResponse`.
- Audit contracts (`POST /api/v1/audits/start`, `GET /status/{id}`, `GET /results/{id}`) exist in backend but are not currently wired into the active frontend screen.
- The active analyze action in the UI is currently frontend-only scaffolding and does not call backend yet.

## UX Standards

- Severity is always visually dominant (color + icon + label).
- Evidence is one click from any finding.
- Keyboard navigable. WCAG AA contrast.
- Bilingual ready (HU/EN labels exist in rulesets).
- Base visual style is a clean white dashboard with soft pastel accents.
- Responsive behavior must hold down to 320px without page-level horizontal overflow.
- Long filenames, session IDs, source references, benchmark values, and finding text require explicit overflow handling.
- Motion is short and purposeful, and must respect `prefers-reduced-motion`.
- Current UI is intentionally ingest-first and does not render the legacy multi-panel audit dashboard.
