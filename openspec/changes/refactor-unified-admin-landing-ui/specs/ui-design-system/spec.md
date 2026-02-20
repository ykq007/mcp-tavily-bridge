## ADDED Requirements

### Requirement: Shared semantic token contract
The system SHALL define and use a shared semantic token contract for admin-ui and landing-page covering color, typography, spacing, radii, elevation, and motion across light and dark themes.

#### Scenario: Tokens are applied consistently across both surfaces
- **WHEN** a semantic token value is updated in the shared contract
- **THEN** both admin-ui and landing-page render the updated visual treatment without ad-hoc per-surface overrides
- **AND** legacy token aliases remain available only as temporary compatibility bridges during migration

### Requirement: Non-breaking visual refactor boundaries
The system SHALL preserve existing routes, navigation destinations, and functional behavior while UI redesign work is applied.

#### Scenario: Existing user flows remain intact during redesign
- **WHEN** redesign changes are deployed
- **THEN** all existing admin routes (`/`, `/keys`, `/tokens`, `/usage`, `/playground`, `/settings`, `/login`) remain reachable and functional
- **AND** landing entry points and CTAs continue to route to the same destinations

### Requirement: Unified component state model
The system SHALL standardize component interaction states across shared UI patterns (default, hover, focus-visible, active, disabled, loading, empty, error) for both admin-ui and landing-page.

#### Scenario: Shared components present predictable states
- **WHEN** users interact with buttons, forms, tables, and overlays on either surface
- **THEN** state styling and behavior follow the same design language and token-driven rules
- **AND** no component relies on inaccessible or visually ambiguous state transitions

### Requirement: Accessibility and responsive baseline
The system SHALL enforce accessibility and responsive acceptance criteria across admin-ui and landing-page.

#### Scenario: Keyboard and focus interactions remain complete
- **WHEN** a keyboard-only user navigates dialogs, drawers, menus, tables, and primary navigation
- **THEN** focus order is logical, focus indicators are visible, escape/close behavior is available where relevant, and interactive elements are operable without pointer input

#### Scenario: Responsive layouts preserve discoverability
- **WHEN** the viewport is reduced to tablet and mobile breakpoints
- **THEN** primary navigation, critical actions, and key content remain discoverable and operable
- **AND** layout changes do not hide core navigation paths without an alternative access pattern

### Requirement: Phased migration and risk control
The system SHALL implement redesign work in phased, reviewable increments with rollback capability.

#### Scenario: Migration proceeds by isolated phases
- **WHEN** redesign implementation begins
- **THEN** work is delivered in phases (token foundation, primitive alignment, page harmonization, hardening)
- **AND** each phase includes regression checks for accessibility, responsive behavior, and route/function continuity before progressing
