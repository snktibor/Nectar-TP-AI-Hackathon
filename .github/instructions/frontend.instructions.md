---
description: 'Frontend standards for REDLINE PHANTOM React, Vite, TypeScript, and Tailwind UI work.'
applyTo: 'app/frontend/**/*.{ts,tsx,css,js,json}, app/frontend/tailwind.config.js, app/frontend/postcss.config.js'
---

# Frontend Instructions — REDLINE PHANTOM

## Project Context
Transfer pricing documentation consistency auditor for PwC Hungary AI Hackathon 2026.
The frontend provides the document upload workflow and risk dashboard for reviewing AI-generated findings.

## Tech Stack
- **Framework:** React 18 with Vite and TypeScript (strict mode)
- **Styling:** Tailwind CSS 3.4
- **State:** React hooks / context (no heavy state library needed for hackathon scope)
- **API client:** Typed fetch or axios with generated/manual types matching backend DTOs
- **Design system:** `phantomDesign` namespace, Tailwind `phantom` tokens, and `--phantom-*` CSS variables

## Architecture
- `app/frontend/` is the root for all frontend code.
- Consumes backend API at `/api/v1/`.
- Never reimplements scoring, classification, or severity logic — all comes from API.
- Domain terms are consistent: Master File, Local File, benchmark study, finding, severity.
- Keep reusable design decisions centralized in `src/design-system/phantomDesign.ts`, `tailwind.config.js`, and `src/index.css`.
- Do not scatter one-off color, spacing, shadow, radius, or animation values through components.
- Use `src/components/ui/DashboardPrimitives.tsx` for repeated dashboard UI patterns such as section headers, status pills, metric cards, empty panels, and workflow timelines.
- Keep shared document display helpers in `src/lib/documentDisplay.ts` and backend audit DTO/helpers in `src/lib/backendAudit.ts`.
- Active render path is `src/App.tsx` → `src/components/DashboardShell.tsx` → `src/components/DocumentIngestor.tsx` + `src/components/AnalysisWorkspace.tsx`.
- Sidebar menu in `DashboardShell` is intentionally local-state only and must not navigate until a routing contract is approved.
- Legacy components that are not on the active render path must not be treated as UI source of truth.

## Core Screens

### 1. Document Ingestor
- Drag-and-drop or file picker for PDF/DOCX files.
- Enforce max 5 selected files and allow ingest only when exactly 5 files are present.
- Validate file type, duplicate filenames, and 50 MB per-file limit in the UI before sending.
- Call `POST /api/v1/documents/ingest` and render backend classification, confidence, page count, chunk count, and file size.
- Require coverage of `master_file`, `local_file`, `contract`, `benchmark_study`, and `invoice` in the processed result set.
- If coverage is incomplete, show failed files with reasons and list missing required categories.
- Provide done-state recovery action `Fájlok újrafeltöltése` that resets upload state and reopens the file picker.

### 2. Analysis Workspace
- Right-side workspace starts empty until at least one document is successfully classified.
- Analyze CTA calls `POST /api/v1/audits/start` with the active session.
- Poll `GET /api/v1/audits/status/{audit_task_id}` until terminal state.
- On completed status, fetch `GET /api/v1/audits/results/{audit_task_id}` and render report data.
- Keep state transitions explicit via `empty`, `ready`, `starting`, `polling`, `completed`, and `failed` phases.

### 3. Analysis Progress
- While audit runs, show stage label, bounded progress bar, and per-agent status strip.
- Polling interval and timers must be cleaned up on terminal states and unmount.
- Start/poll/result failures must surface as recoverable error UI.

### 4. Completed Report Surface
- Findings tab: grouped-by-agent findings plus severity-filtered flat list.
- Agent runs tab: model, prompt, runtime, status, and per-agent finding counts.
- Telemetry tab: token/tool-call totals and per-agent token breakdown table.

### 5. Dashboard Shell
- Left sidebar rail must protect long labels with truncation and `min-w-0` overflow-safe layout.
- Non-active menu items keep subtle colored layer styling and hover feedback.
- Settings and profile remain in the lower sidebar block.

### 6. Severity and Findings
- Findings must carry severity labels and retain backend attribution details where available.
- Severity color system from `severity_scoring.json`: critical=#D32F2F, high=#F57C00, medium=#FBC02D, low=#388E3C.

## UX Rules
- Severity is visually dominant — color, icon, and label together.
- Evidence is always one click away from any finding.
- Loading, empty, success, and error states for every async operation.
- Keyboard navigable finding list.
- Contrast-safe severity indicators (WCAG AA minimum).
- Bilingual support ready (HU/EN labels exist in rulesets).
- Base visual language is a clean white dashboard with soft pastel accents suitable for tax analyst workflows.
- Use a 4px spacing rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Use Inter-first/system sans typography with zero letter spacing and no viewport-width font scaling.
- Cards and panels use 8px maximum radius unless the component is an intentional pill.
- Hover states use subtle border/background/shadow changes; focus states must be keyboard-visible.
- Motion must be short and purposeful, and must respect `prefers-reduced-motion`.
- Responsive behavior must be stable to 320px width without page-level horizontal overflow.
- Protect long filenames, session IDs, source references, benchmark values, and finding text with truncation, `break-words`, `min-w-0`, or controlled horizontal scrolling.

## TypeScript Rules
- `"strict": true` in tsconfig.
- No `any` — use proper types or `unknown` with type guards.
- API response types must match backend Pydantic models.
- Explicit typing at all integration points.

## Quality Gates
- ESLint + Prettier on save.
- No TypeScript errors before commit.
- All async operations have loading and error states.
- Severity colors match `severity_scoring.json` exactly.
- Run `npm run lint` and `npm run build` in `app/frontend` after frontend changes.
- Check 320px, 375px, 768px, 1024px, and desktop widths for overflow-sensitive dashboard changes.
- When frontend behavior contracts change, sync `app/frontend/CLAUDE.md`, `.github/agents/frontend.md`, `.claude/agents/frontend.md`, and this file in the same change set.
