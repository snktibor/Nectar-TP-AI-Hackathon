# GitHub Copilot Harness Instructions

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
- Enforce strict typing in backend and frontend code paths.
- Keep context focused: include only relevant files and avoid noisy prompts.
- Use defensive prompting: implementation plus inline asserts/logs for happy path and edge cases.
- Work in micro-commits and return to the latest stable state when regressions appear.
- Run linter and formatter feedback loops immediately (Ruff, ESLint, Prettier).
- Apply fail-fast behavior in development; avoid silent error swallowing.

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
