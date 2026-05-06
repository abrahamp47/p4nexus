#!/usr/bin/env node
/**
 * Build script that compiles p4nexus and inlines p4nexus-shared into the dist.
 *
 * Steps:
 *  1. Build p4nexus-shared (tsc)
 *  2. Build p4nexus (tsc)
 *  3. Copy p4nexus-shared/dist → dist/_shared
 *  4. Rewrite bare 'p4nexus-shared' specifiers → relative paths
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHARED_ROOT = path.resolve(ROOT, '..', 'p4nexus-shared');
const DIST = path.join(ROOT, 'dist');
const SHARED_DEST = path.join(DIST, '_shared');

// ── 1. Build p4nexus-shared ───────────────────────────────────────
console.log('[build] compiling p4nexus-shared…');
execSync('npx tsc', { cwd: SHARED_ROOT, stdio: 'inherit', timeout: 120_000 });

// ── 2. Build p4nexus ──────────────────────────────────────────────
console.log('[build] compiling p4nexus…');
execSync('npx tsc', { cwd: ROOT, stdio: 'inherit', timeout: 120_000 });

// ── 3. Copy shared dist ────────────────────────────────────────────
console.log('[build] copying shared module into dist/_shared…');
fs.cpSync(path.join(SHARED_ROOT, 'dist'), SHARED_DEST, { recursive: true });

// ── 4. Rewrite imports ─────────────────────────────────────────────
console.log('[build] rewriting p4nexus-shared imports…');
let rewritten = 0;

function rewriteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes('p4nexus-shared')) return;

  const relDir = path.relative(path.dirname(filePath), SHARED_DEST);
  // Always use posix separators and point to the package index
  const relImport = relDir.split(path.sep).join('/') + '/index.js';

  const updated = content
    .replace(/from\s+['"]p4nexus-shared['"]/g, `from '${relImport}'`)
    .replace(/import\(\s*['"]p4nexus-shared['"]\s*\)/g, `import('${relImport}')`);

  if (updated !== content) {
    fs.writeFileSync(filePath, updated);
    rewritten++;
  }
}

function walk(dir, extensions, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, extensions, cb);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      cb(full);
    }
  }
}

walk(DIST, ['.js', '.d.ts'], rewriteFile);

// ── 5. Make CLI entry executable ────────────────────────────────────
const cliEntry = path.join(DIST, 'cli', 'index.js');
if (fs.existsSync(cliEntry)) fs.chmodSync(cliEntry, 0o755);

// ── 6. Build & copy web UI ──────────────────────────────────────────
const WEB_ROOT = path.resolve(ROOT, '..', 'p4nexus-web');
const WEB_DEST = path.join(DIST, '..', 'web');

if (fs.existsSync(path.join(WEB_ROOT, 'package.json'))) {
  console.log('[build] building p4nexus-web…');
  if (!fs.existsSync(path.join(WEB_ROOT, 'node_modules'))) {
    console.log('[build] installing p4nexus-web dependencies…');
    execSync('npm ci', { cwd: WEB_ROOT, stdio: 'inherit', timeout: 120_000 });
  }
  execSync('npm run build', { cwd: WEB_ROOT, stdio: 'inherit', timeout: 120_000 });

  // Copy dist → p4nexus/web/ (shipped in the npm package)
  fs.rmSync(WEB_DEST, { recursive: true, force: true });
  fs.cpSync(path.join(WEB_ROOT, 'dist'), WEB_DEST, { recursive: true });
  console.log('[build] copied web UI → p4nexus/web/');
} else {
  console.log('[build] skipping web UI (p4nexus-web not found)');
}

console.log(`[build] done — rewrote ${rewritten} files.`);
