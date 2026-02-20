# Landing Page Overrides

> **PROJECT:** MCP Nexus
> **Page Type:** Product Landing / Marketing Surface

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/mcp-nexus/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** ~1120px content shell (centered), with full-width background treatments
- **Layout:** sticky navbar, hero, capabilities/features, footer
- **Sections:** `Navbar` → `Hero` → `Features` → `Footer`

### Spacing Overrides

- Keep generous top-level rhythm, but preserve compact mobile spacing below 768px

### Typography Overrides

- Use **Fira Sans** for body/headings and **Fira Code** only where mono treatment is intentional

### Color Overrides

- OLED dark + green-accent direction should be reflected in key CTAs, interactive highlights, and status chips
- Decorative glows should remain subtle and not reduce text contrast

### Component Overrides

- Mobile nav must remain fully operable (open/close, focus handling, Escape close)
- CTA hierarchy remains primary-to-secondary and routes remain unchanged
- Keep feature cards scannable and consistent with admin token language

---

## Page-Specific Components

- Primary components:
  - `Navbar` (desktop links + mobile dialog menu)
  - `Hero` (headline + CTA + stats)
  - `Features` (grid of capability cards)
  - `Footer` (utility links/status)

---

## Recommendations

- Keep button and card hover effects subtle, with reduced-motion fallback
- Ensure nav/CTA contrast remains WCAG AA in light and dark themes
- Avoid introducing new destinations for primary links without product approval

## Non-Breaking Constraints (Landing)

- Preserve current destinations used by landing CTAs and links (`/admin`, `/health`, `#features`, GitHub)
- Preserve overall section structure unless explicitly requested otherwise
