# Rule: Version Synchronization & Zero-Tolerance Bumping

## 1. Zero-Tolerance Versioning Policy
Every branch or pull request targeting `main` **MUST** bump the application semantic version (`MAJOR`, `MINOR`, or `PATCH`) and increment `versionCode` by at least 1. Merging a PR without a version bump is strictly blocked by CI (`check-version.js`).

---

## 2. Mandatory 9-File Synchronization
When updating the version (`vX.Y.Z`, `versionCode: N`), ALL 9 manifest and source locations must be updated synchronously:

1. **`client/public/version.json`** (Canonical Source of Truth):
   - Update `"version": "X.Y.Z"`
   - Update `"versionCode": N`
   - Append `"X.Y.Z"` to `"versionHistory"` array
2. **`android/app/build.gradle`**:
   - Update `versionName "X.Y.Z"`
   - Update `versionCode N`
3. **`package.json`** (Root):
   - Update `"version": "X.Y.Z"`
4. **`client/package.json`**:
   - Update `"version": "X.Y.Z"`
5. **`server/package.json`**:
   - Update `"version": "X.Y.Z"`
6. **`client/src/pwa.js`**:
   - Update `ANDROID_PACKAGE_INFO.version = 'X.Y.Z'`
   - Update `APP_CURRENT_CHANGELOG` entry if applicable
7. **`functions/api/download/android.js`**:
   - Update `version: 'X.Y.Z'`
8. **`client/functions/api/download/android.js`**:
   - Update `version: 'X.Y.Z'` (must remain 100% byte-for-byte identical to `functions/`)
9. **`server/src/index.js`**:
   - Update `version: 'X.Y.Z'` in health check endpoint

---

## 3. Unit Test Assertions
Always update unit test expectations that assert version strings:
- `client/src/test/pwa.test.jsx` (expects current version)
- `client/src/test/App.test.jsx` (expects current version and changelog)

---

## 4. Verification
Run the automated verification script before committing:
```bash
node scripts/check-version.js
```
The check verifies both local 9-file consistency and comparison against `origin/main`.

