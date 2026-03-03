## Context
Before this change, the monorepo produced multiple copies of Admin UI build artifacts and kept a legacy HTTP route:

- Root build ran `scripts/syncAdminUiPublic.mjs`, which copied `packages/admin-ui/dist` to:
  - repo-root `public/admin/**` (tracked)
  - repo-root `public/admin-ui/**` (gitignored legacy compatibility copy)
  - `packages/worker/public/admin/**` (required for Deploy Button template)
- Node bridge-server (`packages/bridge-server`) served Admin UI from `packages/admin-ui/dist` at `/admin`, and redirected `/admin-ui` to `/admin`.

## Goals
- Remove legacy HTTP route `/admin-ui` from the Node bridge-server.
- Remove redundant repo-root Admin UI artifact copies.
- Keep the Cloudflare Worker Deploy Button template working by preserving committed assets under `packages/worker/public/**`.
- Establish a single canonical sync path for Worker Admin UI assets.
- Add automated dead-code detection and remove unused code/dependencies with verification after each batch.

## Non-goals
- No change to Worker runtime routing behavior.
- No change to Admin API path contracts (`/admin/api/**`) or auth semantics.
- No UI redesign.

## Decisions
1. **Worker template assets remain the source of truth for Worker deployments**
   - Keep `packages/worker/public/admin/**` committed.
   - Keep `packages/worker/scripts/verifyDeployButton.mjs` as the enforcement mechanism.

2. **Stop producing repo-root `public/admin/**` and `public/admin-ui/**`**
   - Audit indicates repo-root `public/admin/**` is only referenced by the sync script itself.

3. **Single sync implementation**
   - Prefer syncing `packages/admin-ui/dist` into `packages/worker/public/admin/**` via a single script invoked from the root build.

4. **Dead code detection**
   - Use `knip` for cross-package unused-file/export/dependency detection.

## Alternatives considered
- Keep `scripts/syncAdminUiPublic.mjs` but remove only the legacy destinations.
  - Rejected: still encourages a root-level public/ convention that is not used by runtime.
- Use `npm --workspace @mcp-nexus/worker run build:admin` from the root build.
  - Acceptable fallback; but it rebuilds admin-ui even though workspaces already built.

## Risks / mitigations
- **Breaking change**: users with bookmarks to `/admin-ui` will see 404.
  - Mitigation: explicit breaking note in proposal + manual QA step.
- **Accidental Worker template breakage** if prebuilt assets are removed.
  - Mitigation: keep `packages/worker/public/**` committed and enforce via CI `verify:deploy-button`.
