# AI Harness Root Instructions

## Project Philosophy
Rapid prototyping with enterprise-grade code quality. The code must be readable, easy to extend, and ready for deployment at all times.

## Roles And Delegation
- **Orchestrator**: Analyze every task, split responsibilities by layer, and define API contracts first.
- **Frontend / Backend Specialists**: Implement cleanly and independently within their designated layers.
- **Validators**: Enforce coding quality and security standards after every implementation.

## Strict Execution Cycle
1. A request arrives -> read `.agents/orchestrator.agent.md`.
2. Design communication boundaries (API contracts, DTO structures).
3. Delegate implementation to the right specialist (`frontend` or `backend`).
4. After coding, a refactor pass with `.agents/coding-principles.agent.md` is mandatory.
5. Finally, validate the result using `.agents/security-validator.agent.md`.

## Reliability Policies For AI-Assisted Delivery

### 1. Strict Typing First
- Backend (FastAPI): Use full type hints and Pydantic models for all inputs and outputs.
- Do not use untyped `dict` or `Any` as public request or response contracts.
- Frontend (Next.js): Enforce TypeScript strict mode (`"strict": true`).
- Disallow `any` usage through lint rules.

### 2. Context Hygiene
- Keep prompts focused and reference only the minimum required files.
- Close irrelevant editor tabs during task execution.
- Avoid mixing unrelated concerns in one prompt (for example, CSS context during database migration work).

### 3. Defensive Prompting
- Ask for implementation plus self-check evidence in the same response.
- Require 2-3 inline asserts or debug logs that verify:
	- The happy path.
	- At least one common edge case, such as empty input.

### 4. Micro-Commit Workflow
- Commit immediately after each stable feature step, even if the implementation is not fully polished.
- If a follow-up AI change breaks the codebase, return to the latest stable commit and retry with a clearer prompt.
- Prefer safe rollback commands first (`git restore`, `git revert`); use destructive history reset only with explicit confirmation.

### 5. Immediate Lint And Format Feedback
- Backend: Use Ruff with fast checks and auto-fix on save where possible.
- Frontend: Run ESLint and Prettier on save.
- Treat lint, syntax, and type diagnostics as immediate correction signals.

### 6. Fail Fast In Development
- During development, do not swallow errors with empty catch blocks or silent logs.
- Crash loudly on invalid assumptions and missing required data.
- Keep graceful degradation for demo/production UX, but enforce fail-fast behavior in development loops.

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
