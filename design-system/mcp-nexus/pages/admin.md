# Admin Page Overrides

> **PROJECT:** MCP Nexus
> **Page Type:** Operations Dashboard / Data Management

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/mcp-nexus/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Shell model:** left sidebar on desktop + bottom mobile nav on small screens
- **Canvas:** app-level frame can fill viewport; content is card- and table-oriented
- **Density:** prioritize operational data density and fast scanability over marketing whitespace
- **Sections:** header metadata/actions + page content modules (KPIs, tables, forms, dialogs)

### Spacing Overrides

- **Content density:** High (tight but readable)
- **Table/forms:** maintain compact spacing and clear row/action affordances

### Typography Overrides

- Use **Fira Sans** as default UI font (`--font-sans`)
- Use **Fira Code** for mono values, IDs, snippets, and metric emphasis (`--font-mono`)

### Color Overrides

- Prioritize OLED dark readability with green-accent actions/status
- Keep semantic status colors (`success`, `warning`, `danger`) clearly distinct

### Component Overrides

- Preserve existing interactions for:
  - Data tables + pagination
  - Dialogs/drawers
  - Import/export menus
  - Toasts and empty/loading/error states
- Keep mobile nav labels + icons readable at small sizes

---

## Page-Specific Components

- Primary components:
  - `ShellLayout` navigation shell
  - tables (`DataTable`, responsive table patterns)
  - overlays (`Dialog`, `Drawer`, `ConfirmDialog`)
  - action controls (`IconButton`, `ImportExportActions`, `StatusMenu`)

---

## Recommendations

- Keep hover motion subtle (no layout shifts)
- Preserve skip-link + keyboard navigation quality
- Ensure high-contrast text in dense table views
- Prefer token-driven updates over one-off color literals

## Non-Breaking Constraints (Admin)

- Do not change the existing admin route map
- Do not change `/admin/api/*` request paths/contracts
- Do not alter auth redirect semantics (`/login?next=...`)
