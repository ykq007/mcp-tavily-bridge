# Change: Remove legacy /admin-ui route and redundant root public assets

## Why
The repo currently maintains multiple legacy/duplicate Admin UI outputs and a legacy HTTP route:

- `packages/bridge-server` supports `/admin-ui` as a compatibility redirect to `/admin`.
- Root build copies Admin UI assets to multiple destinations, including a tracked repo-root `public/admin/**` copy and a gitignored `public/admin-ui/**` copy.

These extra paths increase maintenance cost and can confuse deployers about the single source of truth for Admin UI assets.

## What Changes
- **BREAKING**: Remove the Node bridge-server `/admin-ui` compatibility redirect. After this change, `/admin-ui` is unsupported (expected 404).
- Stop generating the legacy filesystem copy at repo-root `public/admin-ui/**` and remove its `.gitignore` entry.
- Remove the redundant tracked repo-root Admin UI asset copy at `public/admin/**` (audit evidence: no runtime/workflow/docs references).
- Simplify Admin UI syncing so the Worker template assets are the only required prebuilt copy:
  - Continue to keep committed assets under `packages/worker/public/admin/**` for the Cloudflare Deploy Button template.
  - Use a single sync script to update `packages/worker/public/admin/**` from `packages/admin-ui/dist` during monorepo builds.
- Add dead-code/unused-dependency detection (knip) and remove unused code/dependencies in small, verified batches.

## Impact
- User-facing behavior:
  - Node bridge-server: `/admin` remains the Admin UI route; `/admin-ui` no longer redirects.
  - Cloudflare Worker: no behavioral change; Deploy Button template MUST remain self-contained.
- Affected code/assets (non-exhaustive):
  - `packages/bridge-server/src/app.ts`
  - `package.json` (root build script)
  - `scripts/syncAdminUiPublic.mjs` (removal or consolidation)
  - `packages/worker/scripts/syncAdminUiPublic.mjs` (becomes the only sync target)
  - `.gitignore`
  - `public/admin/**` (deleted)
  - `public/admin-ui/**` (no longer produced)

## Non-goals
- Do not remove or change the Worker Deploy Button committed assets under `packages/worker/public/**`.
- Do not change Admin API path contracts (`/admin/api/**`), auth, or UI behavior beyond the `/admin-ui` route removal.

## Migration / rollout
- Update any bookmarks/links from `/admin-ui` to `/admin`.
- Rely on `packages/worker/public/admin/**` as the only committed Admin UI static asset copy for Worker Deploy Button deployments.
