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

## Core Screens

### 1. Document Ingestor
- Drag-and-drop or file picker for multiple PDF/DOCX files.
- Call `POST /api/v1/documents/ingest` and render backend classification, confidence, page count, chunk count, and file size.
- Validate file type, non-empty file, duplicate filenames, and 50 MB per-file limit in the UI before sending.
- Show upload, empty, done, and error states clearly.

### 2. Legacy Audit Upload
- Keep the current required Master File / Local File / Contract slots until ingest results are wired directly into audit start.
- Validate: minimum required documents present (Master File + Local File + Contract).
- Show upload progress and validation errors clearly.

### 3. Analysis Progress
- Job status polling or SSE stream.
- Show pipeline stage progress (Structure → Consistency → Completeness → Benchmark → Scoring).
- Estimated time or spinner per stage.

### 4. Risk Dashboard (Main View)
- Overall risk score with color-coded level (LOW/MEDIUM/HIGH/CRITICAL).
- Summary stats: total findings by severity.
- Estimated NAV exposure in HUF.
- Quick filters: severity, finding category, document, transaction.

### 5. Findings List
- Card-based or table layout.
- Each finding shows: ID, type, severity badge, short rationale, source document link.
- Sortable by severity, category, financial impact.
- Severity color system from `severity_scoring.json`: critical=#D32F2F, high=#F57C00, medium=#FBC02D, low=#388E3C.

### 6. Planned Finding Detail
- Full finding description with evidence.
- Source A and Source B citations with document name, page, paragraph.
- Financial impact estimate (if available).
- Remediation suggestion.
- "View in document" link highlighting the relevant excerpt.

### 7. Planned Completeness Matrix
- Grid view: checklist items vs. status (present/partial/missing).
- Separate matrices for Master File and Local File.
- Aggregate completeness percentage.

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
