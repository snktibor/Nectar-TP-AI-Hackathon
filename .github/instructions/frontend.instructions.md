# Frontend Instructions — REDLINE PHANTOM

## Project Context
Transfer pricing documentation consistency auditor for PwC Hungary AI Hackathon 2026.
The frontend provides the document upload workflow and risk dashboard for reviewing AI-generated findings.

## Tech Stack
- **Framework:** Next.js with TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **State:** React hooks / context (no heavy state library needed for hackathon scope)
- **API client:** Typed fetch or axios with generated/manual types matching backend DTOs

## Architecture
- `app/frontend/` is the root for all frontend code.
- Consumes backend API at `/api/v1/`.
- Never reimplements scoring, classification, or severity logic — all comes from API.
- Domain terms are consistent: Master File, Local File, benchmark study, finding, severity.

## Core Screens

### 1. Document Upload
- Drag-and-drop or file picker for 5-7 documents (PDF/DOCX).
- Show classified document type after upload (from backend classification).
- Validate: minimum required documents present (Master File + Local File).
- Show upload progress and validation errors clearly.

### 2. Analysis Progress
- Job status polling or SSE stream.
- Show pipeline stage progress (Structure → Consistency → Completeness → Benchmark → Scoring).
- Estimated time or spinner per stage.

### 3. Risk Dashboard (Main View)
- Overall risk score with color-coded level (LOW/MEDIUM/HIGH/CRITICAL).
- Summary stats: total findings by severity.
- Estimated NAV exposure in HUF.
- Quick filters: severity, finding category, document, transaction.

### 4. Findings List
- Card-based or table layout.
- Each finding shows: ID, type, severity badge, short rationale, source document link.
- Sortable by severity, category, financial impact.
- Severity color system from `severity_scoring.json`: critical=#D32F2F, high=#F57C00, medium=#FBC02D, low=#388E3C.

### 5. Finding Detail
- Full finding description with evidence.
- Source A and Source B citations with document name, page, paragraph.
- Financial impact estimate (if available).
- Remediation suggestion.
- "View in document" link highlighting the relevant excerpt.

### 6. Completeness Matrix
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
