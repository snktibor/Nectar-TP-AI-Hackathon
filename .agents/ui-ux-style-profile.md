---
name: UI UX Style Profile
description: 2026 UI/UX standards, responsive behavior, accessibility, and modern visual guidance.
---
# UI/UX & Design Instructions

## 1. 2026 Visual Standards
- **Whitespace-Driven Clarity:** Use generous spacing to keep interfaces clean, breathable, and easy to scan.
- **Refined Flat Design:** Avoid heavy shadows, thick borders, and faux-3D effects. Create hierarchy with typography, color, and subtle contrast layers.
- **Dark/Light Theme Parity:** Support both themes through design tokens or CSS variables from the start.

## 2. Mobile-First Responsiveness
- **Fluid Layouts:** Scale seamlessly from 320px mobile screens to large desktop displays.
- **Touch-Friendly Targets:** Ensure interactive targets are at least 44x44 pixels on touch devices.
- **Adaptive Navigation:** Collapse or transform navigation patterns on smaller screens.

## 3. UI Resilience States
A professional interface must handle latency, missing data, and failure gracefully.
- **Loading States:** Prefer skeleton loaders over blocking full-screen spinners.
- **Empty States:** For empty datasets, provide clear messaging and an actionable next step.
- **Error States:** Show contextual, user-friendly error feedback and include a retry action.

## 4. Accessibility (A11y)
- Meet WCAG contrast expectations.
- Preserve visible keyboard focus states.
- Use semantic HTML elements and ARIA labels where appropriate for assistive technologies.

## Enforcement Checklist
- Visual system is consistent across typography, spacing, and color hierarchy.
- Mobile-first responsiveness is validated for small and large screens.
- Interaction targets remain touch-friendly.
- Loading, empty, and error states are present and usable.
- Accessibility basics (contrast, focus, semantics) are verified.
