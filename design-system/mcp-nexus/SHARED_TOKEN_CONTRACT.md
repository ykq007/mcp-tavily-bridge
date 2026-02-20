# Shared Token Contract Notes (Admin UI + Landing Page)

This note documents the minimal shared token contract currently used by:

- `packages/admin-ui/src/styles.css`
- `packages/landing-page/src/styles/tokens.css`

The goal is consistency without a large refactor.

## Canonical Token Names (keep these stable)

### Colors

- `--color-bg`
- `--color-surface-1`
- `--color-surface-2`
- `--color-surface-hover`
- `--color-text`
- `--color-text-muted`
- `--color-text-inverse`
- `--color-border`
- `--color-border-subtle`
- `--color-primary`
- `--color-primary-hover`
- `--color-primary-light`
- `--color-primary-dark`
- `--color-cta`
- `--color-cta-hover`
- `--color-success` / `--color-success-light`
- `--color-warning` / `--color-warning-light`
- `--color-danger` / `--color-danger-light`

### Typography

- `--font-sans`
- `--font-mono`
- `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-2xl`, `--text-3xl`
- `--lh-tight`, `--lh-base`, `--lh-loose`

### Spacing / Radius / Shadows / Motion / Layers

- `--space-0`, `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`, `--space-10`, `--space-12`
- `--radius`, `--radius-sm`, `--radius-lg`
- `--shadow`, `--shadow-lg`, `--shadow-xl`
- `--transition-fast`, `--transition-base`, `--transition-slow`
- `--z-base`, `--z-sticky`, `--z-dropdown`, `--z-drawer`, `--z-modal`, `--z-toast`

## Existing Alias Layer (compatibility)

Both surfaces still expose legacy aliases mapped from canonical tokens:

- `--bg` → `--color-bg`
- `--panel` / `--panel-solid` → surface tokens
- `--text` / `--muted` → text tokens
- `--border` / `--border-light` → border tokens
- `--primary*` and `--cta*` → primary/cta tokens
- status aliases (`--success`, `--warning`, `--danger`, etc.)

Recommended minimal policy:

1. Keep aliases for backward compatibility.
2. Prefer canonical `--color-*`, `--font-*`, `--space-*` in new styles.
3. When changing token values, update both files in lockstep.

## Practical Mapping Rule

When a token change is requested:

1. Apply in `packages/admin-ui/src/styles.css` (`:root` and `html[data-theme='dark']`).
2. Mirror the same canonical token change in `packages/landing-page/src/styles/tokens.css`.
3. Do **not** change route destinations or API path contracts as part of token work.
