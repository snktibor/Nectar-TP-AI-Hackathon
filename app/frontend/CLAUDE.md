# Frontend Layer — REDLINE PHANTOM

## What This Is

React + Vite + TypeScript frontend for a transfer pricing documentation consistency auditor. The active screen is an ingest-first split workspace with backend-driven audit progress and report rendering.

## Tech Stack

- React 18 with Vite
- TypeScript strict mode
- Tailwind CSS 3.4 for styling
- React hooks/context for state
- `phantomDesign` namespace for reusable frontend design tokens and component class groups
- `src/components/ui/DashboardPrimitives.tsx` for reusable dashboard primitives
- `src/lib/documentDisplay.ts` and `src/lib/backendAudit.ts` for shared display and backend contract helpers

## Key Screens

1. **Split Workspace** — bal oldali ingest panel és jobb oldali audit/riport munkaterület
2. **Dashboard Shell** — bal navigációs rail lokális kattintható menüállapotokkal, alul beállítások + profil kártya
3. **Document Ingestor** — drag-drop batch PDF/DOCX feltöltés, maximum 5 fájl, és ingest csak pontosan 5 fájl esetén
4. **Classification Validation** — kötelező kategóriák ellenőrzése (`master_file`, `local_file`, `contract`, `benchmark_study`, `invoice`) részletes hibaokokkal
5. **Ingest Progress + Results** — explicit loading/success/error/warning állapotok, per-dokumentum klasszifikációs kártyák
6. **Re-upload Flow** — kész állapotban `Fájlok újrafeltöltése` visszaállítja a feltöltési állapotot és újranyitja a file pickert
7. **Analysis Workspace** — backend audit indítás, státusz polling, majd riport betöltés (`start` → `status` → `results`)
8. **Completed Report Tabs** — megállapítások, ügynök futások, telemetria

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
- Audit contracts are actively wired in `src/App.tsx`: `POST /api/v1/audits/start`, `GET /api/v1/audits/status/{id}`, and `GET /api/v1/audits/results/{id}`.
- Sidebar menu interactions are intentionally local-state only; they must not navigate until routing specs are approved.
- Keep the 5-document ingest rule and required-category set synchronized with frontend validation and backend DTO expectations.

## Current Frontend File State (2026-05-09)

- `src/App.tsx`: root orchestration for session, ingest completion, audit lifecycle, and polling cleanup.
- `src/components/DocumentIngestor.tsx`: strict 5-file intake, classification issue diagnostics, and re-upload reset action.
- `src/components/AnalysisWorkspace.tsx`: phase-based right panel with progress view, findings tab, agent runs tab, and telemetry tab.
- `src/components/DashboardShell.tsx`: wider sidebar rail, overflow-safe labels, non-active colored layer, and profile footer.
- `src/lib/backendAudit.ts`: typed audit DTOs, stage/severity formatting, and agent label constants.
- `src/lib/documentDisplay.ts`: document-type badge mapping and file support checks.
- `src/components/Header.tsx`, `src/components/UploadPanel.tsx`, `src/components/ResultsPanel.tsx`, `src/components/SeverityBadge.tsx`: jelenleg nem az aktív render útvonal részei.

## UX Standards

- Severity is always visually dominant (color + icon + label).
- Evidence is one click from any finding.
- Keyboard navigable. WCAG AA contrast.
- Bilingual ready (HU/EN labels exist in rulesets).
- Base visual style is a clean white dashboard with soft pastel accents.
- Responsive behavior must hold down to 320px without page-level horizontal overflow.
- Long filenames, session IDs, source references, benchmark values, and finding text require explicit overflow handling.
- Motion is short and purposeful, and must respect `prefers-reduced-motion`.
- Current UI is ingest-plus-audit-report first and does not render the legacy dashboard layout.
