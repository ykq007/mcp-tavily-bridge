## ADDED Requirements

### Requirement: Admin UI served at /admin without legacy /admin-ui route
When the Admin UI build output is present for the Node bridge-server, the system SHALL serve the Admin UI static assets at `/admin`. The system SHALL NOT provide the legacy `/admin-ui` compatibility route.

#### Scenario: Admin UI is available at /admin
- **GIVEN** the Node bridge-server is running
- **AND** the Admin UI build output exists
- **WHEN** the user requests `GET /admin/`
- **THEN** the server returns `200` and serves the Admin UI `index.html`

#### Scenario: Legacy /admin-ui route is unsupported
- **GIVEN** the Node bridge-server is running
- **WHEN** the user requests `GET /admin-ui`
- **THEN** the server returns `404`
