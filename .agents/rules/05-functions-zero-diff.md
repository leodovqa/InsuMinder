# Rule: Cloudflare Functions Zero-Diff Parity

## 1. Dual Functions Mirroring Standard
Cloudflare Pages deployment in this project utilizes two directory locations for serverless API endpoints:
- `functions/` (root-level Cloudflare Pages API functions)
- `client/functions/` (client directory mirror required for specific local builds and deployments)

**STRICT ZERO-DIFF POLICY**:
These two directories must remain **100% byte-for-byte identical at all times**. Any change made to a file in `functions/` MUST be replicated identically in `client/functions/`, and vice versa.

---

## 2. Applicable Files
All serverless endpoints within:
- `functions/api/download/android.js` $\leftrightarrow$ `client/functions/api/download/android.js`
- `functions/api/dev/device-logs.js` $\leftrightarrow$ `client/functions/api/dev/device-logs.js`
- Any future serverless functions or middleware added under `functions/`.

---

## 3. Mandatory Pre-Commit Verification
Before any commit or PR, verify that zero differences exist:
```bash
git diff --no-index functions client/functions
```
If any diff is reported, synchronize the changed files immediately so the diff output is completely empty.

