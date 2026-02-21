import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerRoot = path.resolve(__dirname, '..');

const adminUiRoot = path.resolve(workerRoot, '../admin-ui');
const adminUiPackageJson = path.join(adminUiRoot, 'package.json');
const adminUiDist = path.join(adminUiRoot, 'dist');

const dest = path.resolve(workerRoot, 'public/admin');

if (!existsSync(adminUiPackageJson)) {
  // Deploy Button builds an isolated repo from `packages/worker/` only. In that
  // template environment, the Admin UI source workspace is not present, but
  // prebuilt assets are committed in `public/admin`.
  console.log('Admin UI source not found; using prebuilt assets in public/admin.');
  process.exit(0);
}

const buildExit = await run(NPM, ['run', 'build'], { cwd: adminUiRoot });
if (buildExit !== 0) {
  process.exit(buildExit);
}

if (!existsSync(adminUiDist)) {
  throw new Error(`Admin UI build output not found at: ${adminUiDist}`);
}

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp(adminUiDist, dest, { recursive: true });

console.log(`Synced admin UI assets to ${dest}`);

