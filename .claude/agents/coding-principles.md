---
name: Coding Principles
description: SOLID, DRY, maintainability, and explainability guardrails for NECTAR TP.
---
# Coding Principles (NECTAR TP)

## Design Priorities
1. Explainable outputs over opaque heuristics.
2. Deterministic classification for ruleset-driven steps.
3. Small, composable services.
4. Stable finding schema across agents.

## Required Practices
- Keep parsing, retrieval, agent logic, and scoring separated.
- Isolate external provider integrations behind adapters.
- Use clear naming aligned to transfer pricing domain.
- Prefer pure functions for scoring and categorization logic.

## Anti-Patterns To Avoid
- Monolithic orchestration functions.
- Duplicated severity logic in multiple layers.
- Findings without source references.
- Hidden fallback behavior that changes risk silently.

## Design System Exception Rules
- **Shadow usage (frontend):** Only `buttonPrimary` component uses shadows (`shadow-phantom-button` on normal state, `hover:shadow-phantom-lift` on hover). All other component shadows have been removed to enforce elevation via border and opacity instead.
- **Rate limiting (backend):** Protect upload (`5/minute`), ingest (`3/minute`), and audit-start (`2/minute`) endpoints against request flooding.
- **Session TTL (backend):** In-memory sessions expire after 24 hours. Cleanup runs opportunistically on document list/download operations.
