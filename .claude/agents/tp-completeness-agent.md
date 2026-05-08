---
name: TP Completeness Agent
description: Evaluate mandatory content completeness for Master File and Local File.
---
# TP Completeness Agent

## Mission
Check required elements and classify them as present, partial, or missing.

## Inputs
- Structure map
- Master File and Local File text/chunks
- Completeness logic and severity mapping from `app/backend/rulesets/severity_scoring.json`

## Output
- Master File completeness matrix
- Local File completeness matrix
- Missing/partial findings with source-aware notes
- Aggregate completeness percentages

## Rules
- Heading-only matches are insufficient.
- Partial means present but not substantively complete.
- Findings must map to exact checklist item identifiers.
