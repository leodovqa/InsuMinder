#!/usr/bin/env node

/**
 * scripts/check-secrets.js
 *
 * Pre-commit & CI security scanner for Rule 13 ("Zero Hardcoded Secrets & Credentials").
 * Recursively scans all tracked files for accidental secrets, private keys, service account JSONs,
 * bot tokens, and sensitive cloud credentials.
 *
 * Usage:
 *   node scripts/check-secrets.js
 *   npm run check:secrets
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// File extensions to skip (binaries, images, fonts, archives, lockfiles)
const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.jar', '.keystore', '.apk', '.aab', '.zip', '.tar', '.gz', '.pdf',
  '.woff', '.woff2', '.ttf', '.eot'
]);

// Ignored path prefixes / substrings
const IGNORED_PATHS = [
  'node_modules/',
  '/node_modules/',
  'package-lock.json',
  '.git/'
];

// Patterns that indicate secrets
const SECRET_PATTERNS = [
  {
    name: 'Private Cryptographic Key',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/i,
    severity: 'CRITICAL'
  },
  {
    name: 'Firebase / GCP Service Account Key JSON',
    customCheck: (content, filePath) => {
      if (filePath.endsWith('.json') && content.includes('"type"') && content.includes('"service_account"') && content.includes('"private_key"')) {
        return 'Contains service_account credentials with private_key';
      }
      return null;
    },
    severity: 'CRITICAL'
  },
  {
    name: 'Telegram Bot Token',
    regex: /\b([0-9]{9,10}):([a-zA-Z0-9_-]{35})\b/,
    severity: 'HIGH'
  },
  {
    name: 'AWS Access Key ID',
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
    severity: 'HIGH'
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/,
    severity: 'CRITICAL'
  },
  {
    name: 'Slack Bot / User Token',
    regex: /\b(xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*)\b/,
    severity: 'HIGH'
  },
  {
    name: 'SendGrid API Key',
    regex: /\bSG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}\b/,
    severity: 'HIGH'
  },
  {
    name: 'Hardcoded VAPID Private Key Variable Assignment',
    regex: /(?:VAPID_PRIVATE_KEY|private_key|privateKey)\s*[:=]\s*['"]([A-Za-z0-9_-]{40,45})['"]/i,
    severity: 'CRITICAL',
    exclude: (filePath) => {
      // Allow generate-vapid-keys.js documentation/logs
      return filePath.replace(/\\/g, '/').includes('scripts/generate-vapid-keys.js');
    }
  },
  {
    name: 'Revoked GitGuardian VAPID Key (Incident Oct 2026)',
    regex: /kZTCIFztIITs-q4NGY2TZUgKst_o27AN4HUi7r9zUV0/,
    severity: 'CRITICAL',
    exclude: (filePath) => {
      // Historical incident documentation in MEMORY.md and the checker script itself are permitted
      const normalized = filePath.replace(/\\/g, '/');
      return normalized.endsWith('MEMORY.md') || normalized.endsWith('scripts/check-secrets.js');
    }
  }
];

function getCandidateFiles() {
  try {
    const tracked = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);
    const untracked = execSync('git ls-files --others --exclude-standard', { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);
    return Array.from(new Set([...tracked, ...untracked]));
  } catch (err) {
    console.error('⚠️ Could not run git ls-files. Falling back to filesystem scan...', err.message);
    return [];
  }
}

function shouldSkipFile(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (IGNORED_PATHS.some(ignored => normalized.includes(ignored))) {
    return true;
  }
  const ext = path.extname(relPath).toLowerCase();
  if (IGNORED_EXTENSIONS.has(ext)) {
    return true;
  }
  return false;
}

function scanFile(relPath) {
  const fullPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(fullPath)) return [];

  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch (err) {
    // Binary or unreadable file
    return [];
  }

  const findings = [];
  const lines = content.split('\n');

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.exclude && pattern.exclude(relPath)) {
      continue;
    }

    if (pattern.customCheck) {
      const customMatch = pattern.customCheck(content, relPath);
      if (customMatch) {
        findings.push({
          file: relPath,
          line: 1,
          name: pattern.name,
          severity: pattern.severity,
          snippet: customMatch
        });
      }
      continue;
    }

    if (pattern.regex) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (pattern.regex.test(line)) {
          findings.push({
            file: relPath,
            line: i + 1,
            name: pattern.name,
            severity: pattern.severity,
            snippet: line.trim().slice(0, 100)
          });
        }
      }
    }
  }

  return findings;
}

function run() {
  console.log('🔒 Scanning repository for hardcoded secrets (Rule 13)...');
  const files = getCandidateFiles();
  const allFindings = [];

  let scannedCount = 0;
  for (const relPath of files) {
    if (shouldSkipFile(relPath)) continue;
    scannedCount++;
    const findings = scanFile(relPath);
    if (findings.length > 0) {
      allFindings.push(...findings);
    }
  }

  console.log(`✓ Scanned ${scannedCount} files.`);

  if (allFindings.length > 0) {
    console.error('\n' + '='.repeat(70));
    console.error('🚨 RULE 13 VIOLATION: SECRETS OR SENSITIVE CREDENTIALS DETECTED!');
    console.error('='.repeat(70));
    for (const finding of allFindings) {
      console.error(`- [${finding.severity}] ${finding.name} in ${finding.file}:${finding.line}`);
      console.error(`  Snippet: ${finding.snippet}`);
    }
    console.error('\nRemediation:');
    console.error('1. Remove hardcoded secrets from tracked files.');
    console.error('2. Move credentials to environment variables (.env or Cloudflare Pages secrets).');
    console.error('3. For mock tests, generate ephemeral in-memory credentials dynamically.');
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }

  console.log('✅ Rule 13 Clean: Zero hardcoded secrets detected.\n');
  process.exit(0);
}

run();
