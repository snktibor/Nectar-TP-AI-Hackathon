# Claude Harness Instructions

## Purpose
Use this repository harness to enforce architecture-first development and clean layer separation.

## Core Workflow
1. Start with .agents/orchestrator.agent.md.
2. Define API and DTO boundaries before writing code.
3. Implement in the correct layer using frontend or backend specialization.
4. Apply .agents/coding-principles.agent.md as a mandatory refactor pass.
5. Validate security constraints with .agents/security-validator.agent.md.
6. Align user-facing behavior with .agents/ui-ux-style-profile.md.

## Quality Gate
- Keep changes small, explicit, and maintainable.
- Never hardcode secrets.
- Keep contracts and implementation aligned.

## Operational Policies

### 1. Strict Typing First
- Backend (FastAPI): Use full type hints and Pydantic models for all inputs and outputs.
- Do not use untyped dict or Any as public request or response contracts.
- Frontend (Next.js): Enforce TypeScript strict mode (strict true).
- Disallow any usage through lint rules.

### 2. Context Hygiene
- Keep prompts focused and reference only the minimum required files.
- Close irrelevant editor tabs during task execution.
- Avoid mixing unrelated concerns in one prompt.

### 3. Defensive Prompting
- Ask for implementation plus self-check evidence in the same response.
- Require 2-3 inline asserts or debug logs that verify the happy path and at least one edge case.

### 4. Micro-Commit Workflow
- Commit after each stable feature step.
- If a follow-up AI change causes regression, return to the latest stable commit and retry with a clearer prompt.
- Prefer safe rollback commands first (restore or revert).

### 5. Immediate Lint And Format Feedback
- Backend: Use Ruff and auto-fix on save where possible.
- Frontend: Run ESLint and Prettier on save.
- Treat lint, syntax, and type diagnostics as immediate correction signals.

### 6. Fail Fast In Development
- Do not swallow errors with empty catch blocks or silent logs during development.
- Crash loudly on invalid assumptions and missing required data.
- Keep graceful degradation for demo and production UX, but fail fast in development loops.

## Mandatory Official Best Practices
- The system must follow the official best-practice baselines documented in:
	- `docs/GitHub-Principle.md`
	- `docs/Claude-Principle.md`
- These documents are normative guidance for architecture, governance, security, evaluation, and delivery quality.
- If guidance conflicts across files, apply the stricter rule.
- If a task cannot fully comply, state the gap explicitly and choose the safest compliant fallback.

## Definition Of Done
- Scope and acceptance criteria are satisfied end-to-end.
- Layer boundaries and contract-first design remain intact.
- Strict typing and lint/type/format checks pass for affected code.
- Security baseline is preserved (no secrets, validated inputs, least privilege assumptions).
- Required UX resilience states are implemented for user-facing changes.
- Relevant tests or validation steps are executed, or residual risk is explicitly documented.
- Documentation and instruction baselines remain aligned with implementation.