# Change: Refactor admin-ui + landing-page into one cohesive UI system

## Why
The current UI layer is visually inconsistent and costly to evolve. `packages/admin-ui/src/styles.css` (2,508 lines) contains multiple overlapping token blocks and late-stage overrides, while landing styles define a separate token file and style language. This makes accessibility hard to enforce consistently and increases regression risk for routine UI updates.

## What Changes
- Define a single cross-surface design-system contract for tokens (color, typography, spacing, radius, shadow, motion) used by both admin-ui and landing-page.
- Standardize layout primitives (page shell, section spacing, card/table/form patterns) while preserving all existing routes and behavior.
- Align component states (default/hover/focus/disabled/loading/empty/error) across shared UI patterns.
- Introduce explicit accessibility + responsive acceptance criteria for both surfaces (contrast, focus indicators, keyboard navigation, reduced motion).
- Execute redesign as phased, non-breaking visual refactors (proposal only; no implementation in this change).

## Impact
- Affected specs: `ui-design-system` (new capability)
- Affected code (planned):
  - `packages/admin-ui/src/styles.css`
  - `packages/admin-ui/src/ui/*`
  - `packages/admin-ui/src/app/Shell.tsx`
  - `packages/admin-ui/src/pages/*.tsx`
  - `packages/landing-page/src/styles/tokens.css`
  - `packages/landing-page/src/styles/landing.css`
  - `packages/landing-page/src/components/*.tsx`
- Non-goals in this proposal:
  - No route changes
  - No API behavior changes
  - No feature removals
