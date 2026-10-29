#!/usr/bin/env node

/**
 * scripts/check-vulnerabilities.js
 *
 * Automated security vulnerability scanner for InsuMinder.
 * Runs `npm audit --audit-level=high` across root, client, and server
 * workspaces to detect and block high and critical severity package vulnerabilities.
 *
 * Usage:
 *   node scripts/check-vulnerabilities.js
 *   npm run check:audit
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  { name: 'Root Project', dir: REPO_ROOT },
  { name: 'Client App', dir: path.join(REPO_ROOT, 'client') },
  { name: 'Server Backend', dir: path.join(REPO_ROOT, 'server') }
];

console.log('🔒 Scanning Dependencies for High/Critical Security Vulnerabilities (npm audit)...');

let hasVulnerabilities = false;
let npmChecked = false;

// Determine npm executable name (npm.cmd on Windows, npm on Unix)
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const target of TARGETS) {
  const pkgLock = path.join(target.dir, 'package-lock.json');
  if (!fs.existsSync(pkgLock)) {
    console.warn(`⚠️ [Vulnerability Check] Skipping ${target.name}: no package-lock.json found.`);
    continue;
  }

  console.log(`\n🔎 Auditing ${target.name} (${path.relative(REPO_ROOT, target.dir) || '.'})...`);

  const result = spawnSync(npmCmd, ['audit', '--audit-level=high'], {
    cwd: target.dir,
    encoding: 'utf8',
    shell: true
  });

  const isCmdNotFound = (result.error && (result.error.code === 'ENOENT' || result.error.message.includes('not found'))) ||
    (!result.error && result.status !== 0 && (
      (result.stderr && (result.stderr.includes('not recognized') || result.stderr.includes('not found') || result.stderr.includes('No such file'))) ||
      (result.stdout && (result.stdout.includes('not recognized') || result.stdout.includes('not found')))
    ));

  if (isCmdNotFound) {
    if (process.env.CI) {
      console.error(`❌ [Vulnerability Check] npm CLI not found in CI environment.`);
      process.exit(1);
    } else {
      console.warn(`⚠️ [Vulnerability Check] npm CLI not available in local PATH. Skipping local audit (CI will strictly enforce).`);
      npmChecked = false;
      break;
    }
  }

  if (result.error) {
    console.error(`❌ [Vulnerability Check] Error executing npm audit in ${target.name}:`, result.error.message);
    hasVulnerabilities = true;
    continue;
  }

  npmChecked = true;

  if (result.status !== 0) {
    console.error(`❌ [Vulnerability Check] High or critical vulnerabilities detected in ${target.name}!`);
    if (result.stdout) {
      console.error(result.stdout);
    }
    if (result.stderr) {
      console.error(result.stderr);
    }
    hasVulnerabilities = true;
  } else {
    console.log(`✓ [Vulnerability Check] ${target.name}: 0 high or critical vulnerabilities.`);
  }
}

if (hasVulnerabilities) {
  console.error('\n❌ Security audit failed: One or more dependencies contain high or critical vulnerabilities.');
  console.error('Please run `npm audit fix` or upgrade vulnerable dependencies before committing.');
  process.exit(1);
}

if (npmChecked) {
  console.log('\n✅ All workspace dependencies verified clean (zero high or critical vulnerabilities).');
}
process.exit(0);
