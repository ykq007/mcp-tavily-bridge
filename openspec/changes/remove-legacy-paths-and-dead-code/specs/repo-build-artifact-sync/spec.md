## ADDED Requirements

### Requirement: Root build updates Worker template Admin UI assets without redundant repo-root copies
When a maintainer runs the monorepo root build, the system SHALL sync the latest Admin UI build output into `packages/worker/public/admin/**` so that the Cloudflare Worker Deploy Button template remains self-contained. The system SHALL NOT create or update redundant repo-root copies under `public/admin/**` or `public/admin-ui/**`.

#### Scenario: Root build keeps Worker template assets current
- **GIVEN** the Admin UI workspace is present and builds successfully
- **WHEN** the maintainer runs `npm run build` at repo root
- **THEN** `packages/worker/public/admin/index.html` exists
- **AND** it reflects the latest Admin UI build output

#### Scenario: Root build does not produce legacy repo-root admin-ui directories
- **WHEN** the maintainer runs `npm run build` at repo root
- **THEN** no files are written under repo-root `public/admin-ui/`
- **AND** no files are written under repo-root `public/admin/`
