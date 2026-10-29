---
name: release-version
description: Runbook for bumping application version, synchronizing all 9 manifest locations, updating test assertions, building Android APK, and verifying zero-tolerance versioning compliance.
---

# Release Version Runbook

Use this skill whenever creating a new version release or bumping versions for a PR targeting `main`.

---

## 1. Determine Target Version
1. Check current canonical version in `client/public/version.json`.
2. Follow Semantic Versioning:
   - **PATCH** (`x.y.Z`): Bug fixes, UI alignment, minor refactors.
   - **MINOR** (`x.Y.0`): New features, new endpoints, new settings, architectural improvements.
   - **MAJOR** (`X.0.0`): Breaking changes or major system overhauls.
3. Increment `versionCode` by at least 1 (e.g. `28` $\rightarrow$ `29`).

---

## 2. 9-File Version Synchronization Checklist
Update all 9 files simultaneously:
- [ ] `client/public/version.json`: update `version`, `versionCode`, and append version to `versionHistory`.
- [ ] `android/app/build.gradle`: update `versionName` and `versionCode`.
- [ ] `package.json` (root): update `version`.
- [ ] `client/package.json`: update `version`.
- [ ] `server/package.json`: update `version`.
- [ ] `client/src/pwa.js`: update `ANDROID_PACKAGE_INFO.version` and `APP_CURRENT_CHANGELOG`.
- [ ] `functions/api/download/android.js`: update `version`.
- [ ] `client/functions/api/download/android.js`: update `version` (Rule 1 zero-diff).
- [ ] `server/src/index.js`: update `version` in `/api/health`.

---

## 3. Update Test Expectations
- [ ] `client/src/test/pwa.test.jsx`: update version assertion.
- [ ] `client/src/test/App.test.jsx`: update version assertion and changelog expectation if modified.

---

## 4. Build & Verify Android APK
If testing or preparing a release artifact:
```powershell
Set-Location android
./gradlew assembleRelease
Set-Location ..
```
Verify the output APK at `android/app/build/outputs/apk/release/app-release-unsigned.apk`.

---

## 5. Automated Verification
Run the version parity check script:
```bash
node scripts/check-version.js
```
Ensure 100% pass output:
`✓ [Version Check] Full version synchronization verified across all 9 sources`.

