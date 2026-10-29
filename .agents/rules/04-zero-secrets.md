# Rule: Zero Hardcoded Secrets & Credentials

## 1. Absolute Prohibition of Secrets
**ZERO hardcoded secrets, API tokens, bot tokens, or private cryptographic keys** anywhere in the codebase.
- No real Telegram bot tokens.
- No private cryptographic keys (e.g. PEM format keys or headers).
- No GCP/Firebase service account JSON files with credentials.
- No GitHub personal access tokens, AWS keys, or Slack tokens.
- No real production passwords, DB connection strings with credentials, or VAPID private keys.

---

## 2. Environment Variables & Secret Ingestion
1. All sensitive production keys must be ingested at runtime via environment variables or secret vaults:
   - Cloudflare Workers / Pages Secrets
   - GitHub Actions Secrets (for CI/CD)
   - `.env` files (which must be strictly included in `.gitignore` and never committed)
2. Example configuration files (`.env.example`) must contain obvious placeholder values only (e.g. `your-telegram-token-here`).

---

## 3. Dynamic Keypair Generation & Ephemeral Testing
1. **Dynamic VAPID Generation**:
   - In automated test suites or local server initialization where push notifications or web push keys are needed, always generate ephemeral keypairs in memory (e.g. `webpush.generateVAPIDKeys()`) instead of checking in static keys.
2. **Ephemeral Test Tokens**:
   - For mock tests requiring Telegram tokens, construct dummy tokens programmatically or use safe mock strings formatted to bypass false positives while never being valid API credentials.

---

## 4. Automated Pre-Commit Verification
Always run `check-secrets.js` before submitting or proposing a commit:
```bash
node scripts/check-secrets.js
```
The scan checks all tracked files and will fail immediately if any sensitive pattern is detected.
