#!/usr/bin/env node

/**
 * scripts/check-version.js
 * Enforces 100% version synchronization across all application manifests,
 * configs, Cloudflare functions, and Android Gradle files.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
let hasError = false;

function error(msg) {
  console.error(`❌ [Version Check] ${msg}`);
  hasError = true;
}

function success(msg) {
  console.log(`✓ [Version Check] ${msg}`);
}

console.log('🔍 Checking Application Version Consistency & Parity...');

// 1. Source of Truth: client/public/version.json
const versionJsonPath = path.join(rootDir, 'client/public/version.json');
if (!fs.existsSync(versionJsonPath)) {
  error(`Missing version.json at: ${versionJsonPath}`);
  process.exit(1);
}

const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
const canonicalVersion = versionData.version;
const canonicalVersionCode = versionData.versionCode;
const versionHistory = versionData.versionHistory || [];

if (!canonicalVersion) {
  error('client/public/version.json is missing "version" field.');
  process.exit(1);
}

if (!canonicalVersionCode) {
  error('client/public/version.json is missing "versionCode" field.');
  process.exit(1);
}

if (!versionHistory.includes(canonicalVersion)) {
  error(`client/public/version.json "versionHistory" must include current version "${canonicalVersion}".`);
}

// 1b. Enforce Version Bump against main branch (Zero-Tolerance Versioning Rule)
try {
  const { execSync } = require('child_process');
  let currentBranch = '';
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    // ignore
  }

  const isCI = Boolean(process.env.CI);
  const githubRef = process.env.GITHUB_REF || '';
  const isMainBranch = (currentBranch === 'main' || currentBranch === 'origin/main' || githubRef === 'refs/heads/main') && !process.env.GITHUB_BASE_REF;

  if (!isMainBranch) {
    let rawMain = null;
    try {
      rawMain = execSync('git show origin/main:client/public/version.json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    } catch {
      try {
        execSync('git fetch origin main --depth=1', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        rawMain = execSync('git show origin/main:client/public/version.json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      } catch {
        try {
          rawMain = execSync('git show main:client/public/version.json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        } catch {
          // unable to reach origin/main
        }
      }
    }

    if (rawMain) {
      try {
        const mainData = JSON.parse(rawMain);
        const mainVersion = mainData.version;
        const mainCode = mainData.versionCode;

        function parseSemver(v) {
          const match = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
          if (!match) return null;
          return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
        }

        function isSemverGreater(vA, vB) {
          const a = parseSemver(vA);
          const b = parseSemver(vB);
          if (!a || !b) return false;
          if (a[0] !== b[0]) return a[0] > b[0];
          if (a[1] !== b[1]) return a[1] > b[1];
          return a[2] > b[2];
        }

        if (mainVersion && mainCode) {
          if (!isSemverGreater(canonicalVersion, mainVersion)) {
            error(
              `Version must be bumped compared to main (current: v${canonicalVersion}, main: v${mainVersion}). ` +
              `Every branch/PR must bump the version according to Semantic Versioning (MAJOR: X.0.0, MINOR: x.Y.0, or PATCH: x.y.Z).`
            );
          } else {
            success(`Version bump verified: v${mainVersion} -> v${canonicalVersion}`);
          }

          if (canonicalVersionCode <= mainCode) {
            error(
              `versionCode must be incremented compared to main (current: ${canonicalVersionCode}, main: ${mainCode}).`
            );
          } else {
            success(`versionCode increment verified: ${mainCode} -> ${canonicalVersionCode}`);
          }
        }
      } catch (parseErr) {
        if (isCI) {
          error(`Failed to parse main branch version.json: ${parseErr.message}`);
        }
      }
    } else {
      if (isCI) {
        error('Could not retrieve client/public/version.json from origin/main to verify version bump in CI.');
      } else {
        console.warn('⚠️ [Version Check] origin/main not reachable locally; skipping branch comparison.');
      }
    }
  }
} catch (err) {
  if (process.env.CI) {
    error(`Failed to verify version bump against main: ${err.message}`);
  }
}

// 2. android/app/build.gradle
const gradlePath = path.join(rootDir, 'android/app/build.gradle');
if (fs.existsSync(gradlePath)) {
  const gradleContent = fs.readFileSync(gradlePath, 'utf8');
  const nameMatch = gradleContent.match(/versionName\s+["']([^"']+)["']/);
  const codeMatch = gradleContent.match(/versionCode\s+(\d+)/);

  if (!nameMatch || nameMatch[1] !== canonicalVersion) {
    error(`android/app/build.gradle versionName (${nameMatch ? nameMatch[1] : 'not found'}) does not match ${canonicalVersion}`);
  }
  if (!codeMatch || parseInt(codeMatch[1], 10) !== canonicalVersionCode) {
    error(`android/app/build.gradle versionCode (${codeMatch ? codeMatch[1] : 'not found'}) does not match ${canonicalVersionCode}`);
  }
} else {
  error(`Missing build.gradle at: ${gradlePath}`);
}

// 3. Root package.json
const rootPkgPath = path.join(rootDir, 'package.json');
if (fs.existsSync(rootPkgPath)) {
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  if (rootPkg.version !== canonicalVersion) {
    error(`package.json version (${rootPkg.version}) does not match ${canonicalVersion}`);
  }
}

// 4. Client package.json
const clientPkgPath = path.join(rootDir, 'client/package.json');
if (fs.existsSync(clientPkgPath)) {
  const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
  if (clientPkg.version !== canonicalVersion) {
    error(`client/package.json version (${clientPkg.version}) does not match ${canonicalVersion}`);
  }
}

// 5. Server package.json
const serverPkgPath = path.join(rootDir, 'server/package.json');
if (fs.existsSync(serverPkgPath)) {
  const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, 'utf8'));
  if (serverPkg.version !== canonicalVersion) {
    error(`server/package.json version (${serverPkg.version}) does not match ${canonicalVersion}`);
  }
}

// 6. client/src/pwa.js
const pwaPath = path.join(rootDir, 'client/src/pwa.js');
if (fs.existsSync(pwaPath)) {
  const pwaContent = fs.readFileSync(pwaPath, 'utf8');
  const pwaMatch = pwaContent.match(/ANDROID_PACKAGE_INFO\s*=\s*\{[^}]*version:\s*['"]([^'"]+)['"]/);
  if (!pwaMatch || pwaMatch[1] !== canonicalVersion) {
    error(`client/src/pwa.js ANDROID_PACKAGE_INFO.version (${pwaMatch ? pwaMatch[1] : 'not found'}) does not match ${canonicalVersion}`);
  }
} else {
  error(`Missing client/src/pwa.js at: ${pwaPath}`);
}

// 7. functions/api/download/android.js
const funcPath = path.join(rootDir, 'functions/api/download/android.js');
if (fs.existsSync(funcPath)) {
  const funcContent = fs.readFileSync(funcPath, 'utf8');
  const funcMatch = funcContent.match(/version:\s*['"]([^'"]+)['"]/);
  if (!funcMatch || funcMatch[1] !== canonicalVersion) {
    error(`functions/api/download/android.js version (${funcMatch ? funcMatch[1] : 'not found'}) does not match ${canonicalVersion}`);
  }
}

// 8. client/functions/api/download/android.js
const clientFuncPath = path.join(rootDir, 'client/functions/api/download/android.js');
if (fs.existsSync(clientFuncPath)) {
  const clientFuncContent = fs.readFileSync(clientFuncPath, 'utf8');
  const clientFuncMatch = clientFuncContent.match(/version:\s*['"]([^'"]+)['"]/);
  if (!clientFuncMatch || clientFuncMatch[1] !== canonicalVersion) {
    error(`client/functions/api/download/android.js version (${clientFuncMatch ? clientFuncMatch[1] : 'not found'}) does not match ${canonicalVersion}`);
  }
}

// 9. server/src/index.js
const serverIndexPath = path.join(rootDir, 'server/src/index.js');
if (fs.existsSync(serverIndexPath)) {
  const serverIndexContent = fs.readFileSync(serverIndexPath, 'utf8');
  const serverMatch = serverIndexContent.match(/version:\s*['"]([^'"]+)['"]/);
  if (!serverMatch || serverMatch[1] !== canonicalVersion) {
    error(`server/src/index.js version (${serverMatch ? serverMatch[1] : 'not found'}) does not match ${canonicalVersion}`);
  }
}

if (hasError) {
  console.error('\n❌ Version parity check failed. All version definitions must be synchronized.');
  process.exit(1);
} else {
  success(`Full version synchronization verified across all 9 sources: v${canonicalVersion} (versionCode ${canonicalVersionCode}).\n`);
  process.exit(0);
}

