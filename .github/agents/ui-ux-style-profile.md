---
name: UI UX Style Profile
description: UX standards for the transfer pricing analysis dashboard and evidence workflow.
tools: []
---
# UI/UX Style Profile (REDLINE PHANTOM)

## Experience Goals
- Make risk immediately understandable.
- Make evidence retrieval frictionless.
- Keep analyst flow fast for multi-document review.
- Preserve a clean white-dashboard workplace aesthetic suitable for tax analysts.
- Keep the UI stable from 320px mobile width through desktop review workstations.

## Design System Namespace
- Use the frontend `phantomDesign` namespace as the source for reusable UI class groups.
- Use Tailwind `phantom` tokens for colors, radius, shadows, motion, and semantic states.
- Use CSS custom properties prefixed with `--phantom-*` for global theme values.
- Keep design tokens centralized; do not scatter one-off color, shadow, radius, or spacing decisions through components.
- Tailwind CSS 3.4 is the active styling layer; do not assume a Tailwind v4 CSS-first migration unless explicitly scoped.

## Visual Foundation
- Base surface is white/snow with subtle warm-gray canvas backgrounds.
- Prefer soft pastel accents: coral, mint, sky, lavender, and amber.
- Avoid one-note color palettes and heavy gradient decoration.
- Cards and panels use a maximum 8px radius unless a specific component pattern requires a pill shape.
- Shadows stay soft and operational, with a light hover lift only for interactive controls.
- Typography uses an Inter-first/system sans stack with zero letter spacing.

## Spacing And Density
- Use a 4px spacing rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48.
- Mobile panels use 12-16px padding; desktop panels use 20-24px padding.
- Dashboard grid gaps use 12-16px on mobile and 20-24px on desktop.
- Keep operational dashboards dense enough for repeated analyst review; avoid marketing-style hero composition.

## Visual/Interaction Rules
- Severity color system must be consistent.
- Severity colors stay aligned to the deterministic scoring contract: critical `#D32F2F`, high `#F57C00`, medium `#FBC02D`, low `#388E3C`.
- Use pastel severity backgrounds and borders with strong readable text; never rely on color alone.
- Each finding card shows: type, severity, short rationale, source link.
- Filters: document, category, severity, transaction.
- Detail panel must show source excerpt and location metadata.
- Hover states use subtle border/background/shadow changes and optional 1px lift.
- Focus states must be keyboard-visible with a contrast-safe ring.
- Disabled states must communicate disabled behavior beyond opacity.
- Motion uses short, purposeful transitions and respects `prefers-reduced-motion`.

## Accessibility/Resilience
- Keyboard navigable finding list.
- Contrast-safe severity indicators.
- Graceful handling for partial/failed analysis stages.
- Keep touch targets near 44px on mobile controls.
- Protect all long dynamic text with `min-w-0`, truncation, `break-words`, or controlled horizontal scrolling.
- No page-level horizontal overflow is acceptable at 320px width.
- Long filenames, session IDs, source references, benchmark ranges, and finding rationales require explicit overflow handling.
- Async UI states must cover loading, empty, success, and error outcomes.
