## 1. Discovery & baseline
- [x] 1.1 Capture UI inventory and current-state audit for admin-ui primitives in `packages/admin-ui/src/ui/*` and layout/page usage in `packages/admin-ui/src/app` + `packages/admin-ui/src/pages`.
- [x] 1.2 Capture landing-page UI inventory and style audit in `packages/landing-page/src/components/*` + `packages/landing-page/src/styles/*`.
- [x] 1.3 Produce accessibility baseline checks (focus visibility, keyboard nav, reduced motion, color contrast) for key flows.

## 2. Token consolidation
- [x] 2.1 Create canonical token map (semantic colors, type scale, spacing, radius, shadows, motion) and define light/dark parity.
- [x] 2.2 Refactor admin-ui token declarations in `packages/admin-ui/src/styles.css` to consume canonical token layers.
- [x] 2.3 Refactor landing-page token declarations in `packages/landing-page/src/styles/tokens.css` and connect to same semantic contract.

## 3. Layout + component alignment
- [x] 3.1 Standardize admin shell/layout surfaces (`packages/admin-ui/src/app/Shell.tsx`, page cards/tables/forms) without route/functionality changes.
- [x] 3.2 Standardize shared admin-ui component states in `packages/admin-ui/src/ui/*` (buttons, dialogs, drawers, table, empty/error/loading).
- [x] 3.3 Apply same component language to landing-page sections and CTA hierarchy in `packages/landing-page/src/components/*` and `landing.css`.

## 4. Accessibility + responsiveness hardening
- [x] 4.1 Ensure keyboard-complete interaction models for menus/popovers/dialogs/drawers.
- [x] 4.2 Verify WCAG AA contrast targets for text, controls, focus rings, and status colors.
- [x] 4.3 Ensure responsive behavior at common breakpoints without content loss (including navigation discoverability on mobile).

## 5. Validation & rollout
- [x] 5.1 Add/update visual + unit checks where existing tests cover styles/components (`packages/admin-ui/src/*.test.ts*`, `packages/admin-ui/src/ui/*.test.tsx`).
- [x] 5.2 Ship in phased PRs (tokens → primitives → page surfaces) with screenshot diffs and rollback notes.
- [x] 5.3 Run `openspec validate refactor-unified-admin-landing-ui --strict` before implementation handoff.

## Risks and mitigations
- Risk: token refactor causes broad visual regressions.
  - Mitigation: phase by component family, keep compatibility aliases during transition, snapshot key screens each phase.
- Risk: mobile UX regressions (especially nav/table patterns).
  - Mitigation: breakpoint-by-breakpoint QA and explicit mobile acceptance criteria.
- Risk: accessibility regressions in custom popovers/dialog flows.
  - Mitigation: keyboard walkthrough checklist + focus-trap and escape behavior tests.
