# MCP Nexus Design System (Master)

This file defines shared visual and interaction rules for:

- `packages/admin-ui`
- `packages/landing-page`

Page-specific overrides (these win on conflict):

- `design-system/mcp-nexus/pages/admin.md`
- `design-system/mcp-nexus/pages/landing.md`

## Product Direction

- **Visual tone:** OLED dark surfaces with a green-accent identity
- **Typography:** Fira Sans for UI text + Fira Code for mono values/code
- **Interaction:** crisp focus states, restrained motion, high information clarity

## Shared Token Contract (canonical names)

Use and preserve these semantic token names in both surfaces:

- **Color:** `--color-bg`, `--color-surface-1`, `--color-surface-2`, `--color-surface-hover`, `--color-text`, `--color-text-muted`, `--color-text-inverse`, `--color-border`, `--color-border-subtle`, `--color-primary`, `--color-primary-hover`, `--color-primary-light`, `--color-primary-dark`, `--color-cta`, `--color-cta-hover`, `--color-success`, `--color-warning`, `--color-danger` (+ `*-light` companions)
- **Typography:** `--font-sans`, `--font-mono`, `--text-xs`..`--text-3xl`, `--lh-tight`/`--lh-base`/`--lh-loose`
- **Spacing:** `--space-0`, `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-10`, `--space-12`
- **Shape / elevation:** `--radius`, `--radius-sm`, `--radius-lg`, `--shadow`, `--shadow-lg`, `--shadow-xl`
- **Motion / layering:** `--transition-fast`, `--transition-base`, `--transition-slow`, `--z-*`

Legacy aliases (`--bg`, `--panel`, `--text`, `--primary`, etc.) may remain as compatibility bridges, but new styling should prefer canonical tokens.

## Component State Model

Interactive components should define and visually differentiate:

1. default
2. hover
3. active
4. focus-visible
5. disabled
6. loading
7. empty
8. error

## Accessibility + Responsiveness Baseline

- WCAG AA contrast for text and controls
- Visible `:focus-visible` on all interactive elements
- Keyboard support for dialogs, drawers, and menus
- Reduced-motion behavior via `prefers-reduced-motion`
- No horizontal scrolling at 375px
- Mobile navigation must remain discoverable and operable

## Non-Breaking Boundaries

UI refactors must not change:

- Existing admin route map: `/`, `/keys`, `/tokens`, `/usage`, `/playground`, `/settings`, `/login`
- Landing CTA destinations (`/admin`, `/health`, GitHub, in-page anchors)
- Admin API request paths under `/admin/api/*`
