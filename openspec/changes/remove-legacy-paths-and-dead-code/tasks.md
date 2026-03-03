## 1. Legacy compatibility removal (BREAKING)
- [x] 1.1 Remove `/admin-ui` redirect handling from `packages/bridge-server/src/app.ts`.
- [x] 1.2 Add/adjust tests so `/admin-ui` is unsupported (expect 404) while `/admin` remains functional.

## 2. Remove redundant repo-root Admin UI copies
- [x] 2.1 Stop generating the legacy filesystem copy `public/admin-ui/**` and remove the `public/admin-ui/` entry from `.gitignore`.
- [x] 2.2 Delete tracked repo-root Admin UI assets under `public/admin/**` (audit evidence: unused).

## 3. Single source of truth for Worker Admin UI assets
- [x] 3.1 Update the root build pipeline to sync Admin UI assets only into `packages/worker/public/admin/**`.
- [x] 3.2 Remove `scripts/syncAdminUiPublic.mjs` (or refactor it into a thin wrapper) so there is a single sync implementation.

## 4. Dead code + unused dependency cleanup
- [x] 4.1 Add `knip` to repo-root devDependencies and add a root `deadcode:check` script.
- [x] 4.2 Add `knip.json` with explicit entrypoints for each package.
- [x] 4.3 Run knip and remove unused exports/files/dependencies in small batches.

## 5. Verification
- [x] 5.1 `npm run build`
- [x] 5.2 `npm run typecheck`
- [x] 5.3 `npm test`
- [x] 5.4 `npm --workspace @mcp-nexus/worker run verify:deploy-button`
- [x] 5.5 Manual smoke (Node):
  - [x] `GET /` serves landing page
  - [x] `GET /admin` serves Admin UI
  - [x] `GET /admin-ui` is unsupported (expect 404)
- [x] 5.6 `openspec validate remove-legacy-paths-and-dead-code --strict`
