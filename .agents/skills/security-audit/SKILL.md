---
name: security-audit
description: Runbook for scanning repository for secret leaks, auditing npm dependencies for high/critical CVEs, and patching lockfiles.
---

# Security Audit Runbook

Use this skill whenever running automated vulnerability scans, auditing third-party packages, or investigating security alerts.

---

## 1. Secret Leak Detection (Rule 13)
Scan all tracked files for accidental credentials, private keys, bot tokens, or service accounts:
```bash
node scripts/check-secrets.js
```
If a failure occurs:
1. Identify the detected file and pattern.
2. Replace hardcoded secrets with environment variable references (`process.env.*`) or ephemeral mocks.
3. Re-run `node scripts/check-secrets.js` until 0 secrets are found.

---

## 2. Dependency Vulnerability Audit
Scan client, server, and root lockfiles for high and critical CVEs:
```bash
node scripts/check-vulnerabilities.js
```
The script runs `npm audit --json --audit-level=high` inside:
- Root directory (`.`)
- Client directory (`client/`)
- Server directory (`server/`)

---

## 3. Resolving Vulnerabilities
If high or critical vulnerabilities are discovered:
1. **Direct Dependency**: Run `npm update <package>` or bump the version in `package.json`.
2. **Transitive Dependency**:
   - Inspect the dependency path in the audit report.
   - Patch `package-lock.json` directly with the non-vulnerable release, updating both the `packages["node_modules/..."]` and `dependencies` stanzas.
   - Avoid `npm audit fix --force` as it can introduce breaking major changes.
3. Re-run `node scripts/check-vulnerabilities.js` to confirm all 3 checks pass with 0 vulnerabilities.

---

## 4. Verification in CI
Vulnerability auditing runs automatically on every pull request via [`.github/workflows/security.yml`](file:///e:/Leo/Github/InsuMinder/.github/workflows/security.yml).
Both secret checks and vulnerability checks must be completely green before merging.

