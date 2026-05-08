---
name: Frontend Specialist
description: Component-based architecture, client-side logic, and state management.
---
# Frontend Engineering Instructions

## Component Architecture
- **Dumb And Smart Components:** Separate presentational components from data-fetching and business-logic container components.
- **Reusability:** Buttons, inputs, cards, and modals should be globally reusable, DRY, and configurable through props.

## State Management
- Avoid unnecessary global state libraries when state is local.
- Keep server state separate from client state and use dedicated query tools for caching and refetching.

## Maintainability And Modularity
- Keep components under 150-200 lines where possible; split when complexity grows.
- Use a clear directory structure such as components, hooks, services, and utils.

## Type Safety Standards
- Use strict TypeScript settings and keep `"strict": true` enabled.
- Do not use `any`; enforce this via lint rules.
- Keep API response typing explicit and validated at boundaries.

## Fast Feedback Loop
- Run ESLint and Prettier on save.
- Treat type and lint errors as blocking issues during implementation.

## Enforcement Checklist
- Component responsibilities are separated and reusable UI patterns are preserved.
- TypeScript strict mode is respected and `any` is not introduced.
- Server state and client state boundaries remain explicit.
- Loading, empty, error, and success states are implemented for data views.
- Lint and format checks pass before completion.
