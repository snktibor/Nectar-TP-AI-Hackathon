---
name: Coding Principles
description: Enforce SOLID, GoF, OOP, DRY, readability, and long-term maintainability. Run as a mandatory refactor pass after every implementation step.
---
# Coding Principles & Software Engineering

Generated code should look like it was written by a senior engineer who could hand it over to a new team tomorrow.

## 1. Clean Code And Readability
- **Human Readability:** Code is written for people first. Use clear and explicit names, such as `calculateMonthlyRevenue()` instead of `calcRev()`.
- **DRY (Don't Repeat Yourself):** If logic appears twice, extract it into a reusable helper or service.

## 2. Enforce SOLID Principles
- **SRP (Single Responsibility):** A class or component should have one reason to change. Very large files or names like Manager and Utility are warning signs.
- **OCP (Open/Closed):** Extend behavior through new classes or files instead of repeatedly modifying existing logic, especially long switch chains.
- **DIP (Dependency Inversion):** High-level modules should depend on abstractions. Wrap external systems such as APIs, databases, or LLM providers behind interfaces.

## 3. Use GoF Patterns When Valuable
Apply patterns to improve robustness:
- **Strategy Pattern:** Switch algorithms at runtime, for example pricing or processing logic.
- **Factory Pattern:** Centralize creation of complex objects or agents.
- **Adapter Pattern:** Isolate third-party integrations so external changes stay localized.

## 4. Architecture And Maintainability
- **Modularity:** Keep components and features loosely coupled. Replacing one module should not trigger chain reactions.
- **Early Return:** Avoid deep nesting. Validate early and exit fast on invalid paths.

## 5. Prompting And Delivery Discipline
- Use test-driven prompting: request implementation plus minimal inline assertions or debug evidence.
- Validate happy path and at least one common edge case while coding.
- Prefer micro-commits after each stable increment to minimize recovery cost.

## Enforcement Checklist
- Naming, modularity, and DRY standards are verified.
- SOLID violations are reviewed and corrected where practical.
- Unnecessary complexity and deep nesting are removed.
- Prompting includes minimal self-check evidence for critical flows.
- Changes remain maintainable for team handoff.
