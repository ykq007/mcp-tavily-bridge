## Context
This proposal scopes a non-breaking UI redesign for both:
- `packages/admin-ui`
- `packages/landing-page`

Goal: establish one cohesive visual system and accessibility baseline while preserving routes and functionality.

## UI audit summary

### 1) Admin UI (`packages/admin-ui`)

#### Styling architecture findings
- `packages/admin-ui/src/styles.css` is monolithic (2,508 lines).
- The file contains layered token resets/overrides (`:root` appears multiple times), including legacy aliases and 2026 override blocks.
- Styling mixes semantic tokens, utility classes, and page/component-specific styles in one file, increasing cascade fragility.
- Both “Brutalist” and “glass/soft” visual language exist in the same stylesheet, producing inconsistent density/radius/shadow outcomes.

#### Layout/system findings
- Primary shell uses desktop sidebar + mobile bottom nav (`app/Shell.tsx`) and route-aware titles.
- Core pages share card/table/form primitives, but style semantics are partly class-driven and partly inline (mixed maintainability).
- Responsive table card-mode is implemented in CSS, but behavior and action affordances vary by page.

#### Accessibility findings (positive)
- Global `:focus-visible` styles exist.
- Dialog and Drawer include focus trap + escape handling.
- Reduced-motion media query exists.
- Toasts and some live status areas use `aria-live`.

#### Accessibility findings (gaps/pain points)
- Custom menus are inconsistent: `StatusMenu` supports richer keyboard controls; `ImportExportActions` supports Escape only.
- Several UI labels/messages in shared components are hardcoded English (not fully i18n-consistent).
- Very large stylesheet and repeated overrides make predictable contrast/focus QA difficult.

#### Admin UI component inventory (`packages/admin-ui/src/ui`)
- `DataTable` / `Pagination`: tabular data scaffolding and paging.
- `Dialog`, `ConfirmDialog`, `Drawer`, `Portal`: layered overlay primitives.
- `KpiCard`, `MetricsCard`, `OnboardingGuide`: overview/dashboard blocks.
- `ErrorBanner`, `EmptyState`, `LoadingState`: async/error/empty handling.
- `IconButton`, `StatusMenu`, `ImportExportActions`, `CopyButton`: action controls.
- `toast`: global notification stack.
- `icons`: icon primitives.

### 2) Landing page (`packages/landing-page`)

#### Styling architecture findings
- Uses `styles/tokens.css` (117 lines) + `styles/landing.css` (634 lines).
- Token names overlap conceptually with admin-ui but are maintained separately.
- Landing applies additional local radii/shadows/glow tokens that diverge from admin surface styling.

#### Structure findings
- Componentized sections (`Navbar`, `Hero`, `Features`, `Footer`) with BEM-like class naming.
- Visual hierarchy is strong and modern, but independent from admin UI primitives.

#### Accessibility findings
- Focus-visible and reduced-motion styles are present.
- Semantic sections/headings are mostly well-structured.
- On small screens, primary nav links are hidden without alternate mobile menu, reducing discoverability.

### 3) Cross-surface pain points
- Duplicate token systems with drift risk.
- Different radius/shadow/density/motion scales between admin and landing.
- No shared contract for component states (hover/focus/disabled/error/skeleton).
- Accessibility behavior is partly strong but not uniformly enforced across custom controls.

## Proposed design direction

### Token direction (shared contract)
Define a shared semantic contract (consumed by both surfaces):
- Color: `bg`, `surface-1/2`, `text`, `text-muted`, `border`, `primary`, `success`, `warning`, `danger`, and corresponding interactive/soft variants.
- Typography: one sans stack, one mono stack, consistent type ramp and line-height scale.
- Spacing: one base grid and spacing steps used in both apps.
- Shape/elevation: shared radius + shadow scale (with dark-mode variants).
- Motion: one transition scale + reduced-motion compliance defaults.

### Layout direction
- Preserve current route map and information architecture.
- Standardize shell/page spacing rhythm, section headers, and card internals.
- Normalize table/form density and interactive affordances.

### Component guidelines
- Use shared state model across admin + landing controls: default, hover, active, focus-visible, disabled, loading, empty, error.
- Prefer semantic tokens over local literal colors.
- Keep component APIs stable; style via tokens and predictable class contracts.

### Accessibility baseline
- WCAG AA contrast targets for text and controls.
- Minimum visible focus indicators on all interactive elements.
- Full keyboard support for dialogs/drawers/menus/popovers.
- Reduced motion behavior preserved across animated states.
- Mobile navigation must remain discoverable and operable.

## Migration plan (phased)

### Phase 0 — Audit freeze + acceptance criteria
- Finalize inventory and acceptance checks.
- Files audited:
  - `packages/admin-ui/src/ui/*`
  - `packages/admin-ui/src/styles.css`
  - `packages/landing-page/src/styles/*`
  - `packages/landing-page/src/components/*`

### Phase 1 — Token unification (non-breaking)
- Introduce canonical semantic token contract while keeping compatibility aliases.
- Planned touch set:
  - `packages/admin-ui/src/styles.css`
  - `packages/landing-page/src/styles/tokens.css`
  - `packages/landing-page/src/styles/landing.css`

### Phase 2 — Primitive alignment
- Update shared primitives first (buttons, cards, inputs, table states, overlays).
- Planned touch set:
  - `packages/admin-ui/src/ui/*`
  - `packages/admin-ui/src/styles.css`
  - Landing shared classes in `landing.css` (`.btn`, card-like sections, status chips)

### Phase 3 — Page surface harmonization
- Apply aligned primitives to shell/pages and landing sections.
- Planned touch set:
  - `packages/admin-ui/src/app/Shell.tsx`
  - `packages/admin-ui/src/pages/*.tsx`
  - `packages/landing-page/src/components/*.tsx`
  - `packages/landing-page/src/styles/landing.css`

### Phase 4 — Hardening + cleanup
- Accessibility validation, responsive QA, test updates, and cleanup of temporary aliases.
- Planned touch set:
  - Relevant `*.test.tsx` files in admin-ui
  - `packages/admin-ui/src/styles.css`
  - `packages/landing-page/src/styles/tokens.css`

## Key risks
- **Cascade regressions from monolithic admin stylesheet**
  - Mitigation: token-first rollout, compatibility aliases, phased PRs.
- **Cross-surface visual mismatch during transition**
  - Mitigation: define token source-of-truth early; update shared primitives before page-level polish.
- **Accessibility regressions in custom interactive widgets**
  - Mitigation: keyboard checklists + targeted tests for dialog/drawer/menu flows.
- **Mobile navigation/table usability regressions**
  - Mitigation: explicit breakpoint acceptance tests and UX sign-off before each phase completion.

## Contrast and accessibility verification (baseline)

### Token contrast checks (WCAG AA)
Using the current canonical tokens in:
- `packages/admin-ui/src/styles.css`
- `packages/landing-page/src/styles/tokens.css`

The following foreground/background pairs meet or exceed common WCAG AA thresholds:
- `--color-text` on `--color-bg` (light): **16.63**
- `--color-text` on `--color-bg` (dark): **16.38**
- `--color-text-muted` on `--color-bg` (light): **5.37**
- `--color-text-muted` on `--color-bg` (dark): **8.09**
- `--color-text-inverse` on `--color-primary` (light): **5.86**
- `--color-text-inverse` on `--color-primary` (dark): **8.07**

### Interaction model upgrades completed (high value)
- Landing mobile nav: menu is discoverable on small screens, closes on Escape, traps focus, and restores focus on close.
- Admin Import/Export action menus: Escape to close + Arrow key navigation + Enter/Space activation (roving tabIndex).
- Admin shell: skip-to-content link.

## Rollout plan (phased PRs) + rollback notes

1) **PR 1 — tokens only**
   - Touch: token blocks in `packages/admin-ui/src/styles.css` + `packages/landing-page/src/styles/tokens.css`.
   - Rollback: revert token commits (no component markup changes).

2) **PR 2 — overlays/menus accessibility + z-index**
   - Touch: `Dialog`, `Drawer`, `ImportExportActions`, `Navbar` mobile menu, toast z-index/classes.
   - Rollback: revert component commits; tokens remain safe.

3) **PR 3 — shell + spacing polish**
   - Touch: `Shell.tsx`, header/sidebar spacing, responsive tweaks.
   - Rollback: revert shell commits; tokens/primitives remain.

4) **PR 4 — page-level harmonization**
   - Touch: admin pages + landing hero/features/footer visual polish.
   - Rollback: revert page commits.
