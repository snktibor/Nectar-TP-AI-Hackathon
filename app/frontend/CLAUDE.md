# Frontend Layer — REDLINE PHANTOM

## What This Is
Next.js + TypeScript frontend for a transfer pricing documentation consistency auditor. Provides document upload workflow and risk dashboard for reviewing AI-generated findings.

## Tech Stack
- Next.js with TypeScript strict mode
- Tailwind CSS for styling
- React hooks/context for state

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
