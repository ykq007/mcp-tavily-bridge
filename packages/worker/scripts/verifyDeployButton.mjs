import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

function requireFile(root, relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing required template file: ${relativePath}`);
  }
}

function assertReadmeHasNoLegacyAdminPaths(readmeText) {
  const legacy = [
    '/admin/tavily-keys',
    '/admin/brave-keys',
    '/admin/tokens',
    '/admin/settings',
    '/admin/usage',
    'workers.dev/admin/tavily-keys',
    'workers.dev/admin/brave-keys',
    'workers.dev/admin/tokens',
  ];

  for (const needle of legacy) {
    if (readmeText.includes(needle)) {
      throw new Error(`README contains legacy admin endpoint path: ${needle}`);
    }
  }
}

function shouldCopy(templateRoot, srcPath) {
  const rel = path.relative(templateRoot, srcPath);
  if (!rel) return true;

  const top = rel.split(path.sep)[0];
  if (top === 'node_modules') return false;
  if (top === '.wrangler') return false;
  if (top === 'dist') return false;
  if (top === 'dist-test') return false;

  return true;
}

const templateRoot = process.cwd();

// Files that must exist in the Deploy Button template repo (subdirectory export).
requireFile(templateRoot, 'package.json');
requireFile(templateRoot, 'wrangler.jsonc');
requireFile(templateRoot, 'migrations/0001_init.sql');
requireFile(templateRoot, 'public/admin/index.html');
requireFile(templateRoot, '.dev.vars.example');

const tempParent = await mkdtemp(path.join(os.tmpdir(), 'mcp-nexus-worker-template-'));
const tempRoot = path.join(tempParent, 'worker');

try {
  await cp(templateRoot, tempRoot, {
    recursive: true,
    filter: (src) => shouldCopy(templateRoot, src),
  });

  const readmePath = path.join(tempRoot, 'README.md');
  if (existsSync(readmePath)) {
    const readmeText = await readFile(readmePath, 'utf8');
    assertReadmeHasNoLegacyAdminPaths(readmeText);
  }

  // Deploy Button uses an isolated repo (no lockfile). Use npm install (not npm ci).
  const install = await run(NPM, ['install', '--no-audit', '--no-fund'], { cwd: tempRoot });
  if (install.code !== 0) {
    throw new Error(`npm install failed with exit code ${install.code}`);
  }

  const dryRun = await run(
    NPX,
    ['wrangler', 'deploy', '--dry-run', '--env=', '--outdir', 'dist-test'],
    { cwd: tempRoot }
  );
  if (dryRun.code !== 0) {
    throw new Error(`wrangler deploy --dry-run failed with exit code ${dryRun.code}`);
  }

  const combined = `${dryRun.stdout}\n${dryRun.stderr}`;
  if (combined.includes('Cannot find base config file')) {
    throw new Error('wrangler emitted tsconfig base-config warning; template is not self-contained');
  }
  if (combined.includes('Multiple environments are defined')) {
    throw new Error('wrangler emitted multi-env warning; expected to target the top-level environment');
  }
} catch (err) {
  // Keep the temp folder for investigation.
  console.error(`\nDeploy Button verification failed. Temp folder preserved at: ${tempParent}\n`);
  throw err;
}

// Cleanup on success.
await rm(tempParent, { recursive: true, force: true });
console.log('Deploy Button verification passed.');
