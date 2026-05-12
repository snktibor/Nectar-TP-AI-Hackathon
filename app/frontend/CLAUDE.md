# Frontend Layer — NECTAR TP

## What This Is

React + Vite + TypeScript frontend for a transfer pricing documentation consistency auditor. The active screen is an ingest-first split workspace with backend-driven audit progress, finding review, and client-side enterprise PDF export.

## Tech Stack

- React 18 with Vite
- TypeScript strict mode
- Tailwind CSS 3.4 for styling
- React hooks/context for state
- `@react-pdf/renderer` for browser-side enterprise report PDF generation
- `phantomDesign` namespace for reusable frontend design tokens and component class groups
- `src/components/ui/DashboardPrimitives.tsx` for reusable dashboard primitives
- `src/lib/documentDisplay.ts`, `src/lib/backendAudit.ts`, `src/lib/citations.ts`, and `src/lib/findingFilters.ts` for shared display, backend contract, citation routing, and document-finding relation helpers

## Key Screens

1. **Split Workspace** — bal oldali ingest panel és jobb oldali audit/riport munkaterület
2. **Dashboard Shell** — bal navigációs rail lokális kattintható menüállapotokkal, profilblokk nélkül
	- Az `Analízis` és `Riport` külön menüpontok: az analízis összefoglaló és a riport készítés elkülönített bal panel nézetben jelenik meg.
	- Mobil nézetben a navigáció teljes magasságú bal oldali drawer; háttér-scroll zárolt, bezárás X-szel, backdrop/Escape művelettel vagy menüpont választással történik.
3. **Document Ingestor** — drag-drop batch PDF/DOCX feltöltés, maximum 5 fájl, ingest csak pontosan 5 fájl esetén, plusz automatikus pótlás/csere hiányzó vagy duplikált kötelező kategóriákhoz
	- Generált TP-riport fájlok (`*TP_Report*`, `*Megfelelosegi_Jelentes*`) nem tekinthetők forrásdokumentumnak, mindig cserélni kell őket.
	- A kötelező kategóriába sorolt, de 80% alatti klasszifikációs bizalmú dokumentumok blokkoltak: kötelező a fájlcsere, és ilyen készlettel az audit nem indítható.
4. **Classification Validation** — kötelező kategóriák ellenőrzése (`master_file`, `local_file`, `contract`, `benchmark_study`, `invoice`) részletes hibaokokkal és cserélhető fájlok állapotkezelésével
5. **Ingest Progress + Results** — explicit loading/success/error/warning állapotok, per-dokumentum klasszifikációs kártyák; kész állapotban a feltöltési útmutató és formátum badge eltűnik, csak a feldolgozási összegzés és dokumentumlista marad.
6. **Re-upload Flow** — kész állapotban az `Újrakezdés` művelet a kategória státusz mellett visszaállítja a feltöltési állapotot és újranyitja a file pickert
7. **Analysis Workspace** — backend audit indítás, státusz polling, majd riport betöltés (`start` → `status` → `results`)
8. **Completed Report Tabs** — megállapítások, ügynök futások, telemetria
9. **Finding Cards** — severity mellett finding-csoport badge jelenik meg (`Konzisztencia hibák`, `Benchmark kockázatok`, `Hiányzó elemek`), működő forráshivatkozással és evidence művelettel.
10. **Enterprise PDF Report** — a `Riport` nézet kliensoldali, 20+ oldalas `@react-pdf/renderer` PDF-et generál középre igazított `PDF letöltés` CTA-val és kötelező bizalmassági szöveggel.
11. **Executive Summary Grid** — a bal oldali Analízis panel a kész futás után dinamikus 2x3 statisztika-gridet jelenít meg valós report adatokból (becsült NAV-kitettség, összes finding, benchmark túllépés, kritikus findingok, sikeres ágensfutások, dokumentum lefedettség)
12. **Document Evidence Viewer** — PDF hivatkozások céloldal-first renderrel, gyors oldalbetöltéssel és best-effort quote highlighttal

## Critical Rules

- Never reimplement scoring or classification logic — consume from API only.
- Severity colors from backend rulesets: critical=#D32F2F, high=#F57C00, medium=#FBC02D, low=#388E3C.
- Keep UI design decisions centralized in `src/design-system/phantomDesign.ts`, Tailwind `phantom` tokens, and `--phantom-*` CSS variables.
- **Shadow usage restriction:** Only `buttonPrimary` component uses shadows (`shadow-phantom-button` normal, `hover:shadow-phantom-lift` hover). All other components use border and opacity for elevation. Do not add new shadow usages to other components.
- Reuse `DashboardPrimitives` for section headers, metric cards, status pills, empty states, and workflow timelines before creating local one-off UI.
- Keep document label/formatting logic in `src/lib/documentDisplay.ts`, not duplicated in components.
- Backend evidence chunk pages are source-facing page labels; always convert them through `src/lib/citations.ts` before opening `DocumentViewer`, whose `CitationTarget.page` is a zero-based PDF viewer index.
- Document-specific finding lists and badges must use `src/lib/findingFilters.ts`, matching explicit filenames, locations, evidence chunks, and only then scope fallback.
- `"strict": true` in tsconfig. No `any` type.
- Every async operation has loading, empty, success, and error states.
- Domain terms are consistent: Master File, Local File, benchmark study, finding, severity.
- API response types must match backend Pydantic DTOs.
- ESLint + Prettier on save.
- Current active ingest contract is `POST /api/v1/documents/ingest` returning `IngestResponse`.
- Audit contracts are actively wired in `src/App.tsx`: `POST /api/v1/audits/start`, `GET /api/v1/audits/status/{id}`, and `GET /api/v1/audits/results/{id}`.
- Sidebar menu interactions are intentionally local-state only; they must not navigate until routing specs are approved.
- Keep `Analízis` and `Riport` as separate menu states while preserving existing internal card design tokens in both views.
- Keep the 5-document ingest rule and required-category set synchronized with frontend validation and backend DTO expectations.
- Audit indítás csak teljes kötelező lefedettség + minimum 80% klasszifikációs bizalom mellett engedélyezett.
- Keep technical SEO baseline wired in `index.html` and `public/` assets (`robots.txt`, `sitemap.xml`, `manifest.webmanifest`).

## Current Frontend File State (2026-05-12)

- `src/App.tsx`: root orchestration for session, ingest completion, audit lifecycle, and polling cleanup.
- `src/components/DocumentIngestor.tsx`: strict 5-file intake, classification issue diagnostics, targeted/bulk replacement, processed-state summary, and `Újrakezdés` reset action.
- `src/components/AnalysisWorkspace.tsx`: phase-based right panel with progress view, findings tab, agent runs tab, and telemetry tab.
- `src/components/ResultsPanel.tsx`: active document/evidence viewer host for selected documents and clicked citations.
- `src/components/DocumentViewer.tsx`: target-page-first PDF rendering, legal/document citation display, and best-effort text highlighting.
- `src/components/DashboardShell.tsx`: wider sidebar rail, full-height mobile drawer with scroll lock, overflow-safe labels, non-active colored layer, and no profile footer.
- `src/components/FindingCard.tsx`: severity-first finding cards with type-group badges and shared citation/evidence affordances.
- `src/components/FilteredFindingsPanel.tsx`: selected-document findings resolved through shared filename/location/evidence filtering.
- `src/components/report/ReportGeneratorModal.tsx`: staged enterprise report preparation and client-side PDF download trigger.
- `src/components/report/EnterpriseReportPdfDocument.tsx`: printable React-PDF report document with executive, risk, finding, remediation, legal, and disclaimer sections.
- `src/lib/backendAudit.ts`: typed audit DTOs, stage/severity formatting, and agent label constants.
- `src/lib/citations.ts`: backend evidence page label formatting and conversion to PDF viewer page indexes.
- `src/lib/findingFilters.ts`: shared document-to-finding relation logic for counts and selected-document panels.
- `src/lib/documentDisplay.ts`: document-type badge mapping and file support checks.
- `src/lib/enterpriseReport.ts`: frontend enterprise report payload normalization, financial estimate, remediation, and printable finding helpers.
- `public/robots.txt`, `public/sitemap.xml`, `public/manifest.webmanifest`: SEO discoverability and web app metadata baseline.

## UX Standards

- Severity is always visually dominant (color + icon + label).
- Evidence is one click from any finding and must open the correct selected PDF page.
- Keyboard navigable. WCAG AA contrast.
- Hungarian UI labels use `Analízis` wording consistently in workflow states and actions.
- Bilingual ready (HU/EN labels exist in rulesets).
- Base visual style is a clean white dashboard with soft pastel accents.
- Responsive behavior must hold down to 320px without page-level horizontal overflow.
- Long filenames, session IDs, source references, benchmark values, and finding text require explicit overflow handling.
- Motion is short and purposeful, and must respect `prefers-reduced-motion`.
- Current UI is ingest-plus-audit-report first and does not render the legacy dashboard layout.
