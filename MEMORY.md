# InsuMinder — Central Project Memory & Single Source of Truth

> **Purpose of this Document**:  
> This file is the permanent, universal single source of truth for all cross-machine context, planned tasks, known bugs, architectural standards, and "save later" memory in InsuMinder. Whenever working on this repository from any computer, IDE, or AI session, always consult this file before starting new work.

---

## 0. Security Alert & Remediation: Exposed VAPID Private Key (GitGuardian)

> **Status**: Verified Real Incident • To be remediated from secondary PC  
> **Source**: GitGuardian Secret Detection Alert (`October 18th 2026, 06:32:41 UTC`)  
> **Repository**: `leodovqa/InsuMinder`

### Incident Details
- **Secret Type**: VAPID Private Key
- **Exposed Secret**: `kZTCIFztIITs-q4NGY2TZUgKst_o27AN4HUi7r9zUV0`
- **Files Containing Hardcoded Secret**:
  1. `functions/api/_webpush.js` (lines 4–8)
  2. `client/functions/api/_webpush.js` (lines 4–8)
  3. `server/src/webpush.js` (lines 3–7)
- **Root Cause**: During the Web Push overhaul (commit `e742748` / PR #41), fallback VAPID keys (`STABLE_VAPID_KEYS`) were committed directly into the source code as a fallback when environment variables were unset.

### Security Impact
The VAPID private key is used to sign RFC 8292 JWTs for Web Push notifications dispatched to browser push services (Google FCM, Mozilla autopush). While it does not expose patient database records or passwords, anyone possessing the key could theoretically sign push messages if they possessed subscriber endpoints.

### Remediation Steps (To Execute from Other PC)
1. **Generate New VAPID Key Pair**:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Store New Keys in Environment Secrets (Never in Git)**:
   - **Cloudflare Pages Dashboard** (Settings > Environment Variables):
     - `VAPID_PUBLIC_KEY` = `<new_generated_public_key>`
     - `VAPID_PRIVATE_KEY` = `<new_generated_private_key>`
     - `VAPID_SUBJECT` = `mailto:support@insuminder.com`
   - **Local / Server `.env`**:
     - Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.
3. **Remove Hardcoded Private Key from Source Code**:
   - In `functions/api/_webpush.js`, `client/functions/api/_webpush.js`, and `server/src/webpush.js`, remove the hardcoded string `kZTCIFztIITs-q4NGY2TZUgKst_o27AN4HUi7r9zUV0`.
   - Update `resolveVapidKeys()` to strictly require `VAPID_PRIVATE_KEY` from `env` (or throw a clean configuration error if missing in production).
   - Ensure strict Rule 1 zero-diff between `functions/` and `client/functions/`.
4. **GitGuardian Resolution**:
   - In the GitGuardian email / dashboard, click **"Fix This Secret Leak"** and mark the incident as rotated/resolved once the new key is deployed.

---

## 1. Immediate Next Sprint Task (Highest Priority)

### Task Details
- **Branch Name**: `feat/android-native-permissions-and-notifications-v1.9.0`
- **Target Version**: `v1.9.0` (versionCode `11`)
- **Status**: Ready to implement upon starting next branch.

### Background & Evidence
Recent testing on mobile devices and Web browsers confirmed that Web Push works, but native Android notifications fail to deliver properly due to missing runtime permission gating and coupled deep links:
1. **Premature "Active" Status & Missing OS Permission Gate**:
   - In `NotificationSettings.jsx`, tapping "Activate Notifications on Device" previously marked the state as active and dispatched a test alert immediately without waiting for the user to respond to the native Android OS prompt.
   - On Android 13+ (API 33+), notifications require explicit runtime permission (`android.permission.POST_NOTIFICATIONS`). If dispatched before the user grants permission, Android silently drops the notification.
2. **Test Alert Linked to Basal Modal**:
   - In `client/src/pwa.js`, `sendTestPush()` hardcoded `url: '/?action=basal'`. Tapping the test notification opened the app and immediately triggered the Basal Injection Confirmation modal.
3. **Premature Basal Prompt**:
   - At **19:57**, tapping the deep link popped up the modal asking to log basal injection, even though scheduled basal was at **20:00**.
4. **Basal Confirmation Modal Header UI Misalignment**:
   - In the confirmation modal, the close `✕` button was smashed directly against the Hebrew title text (`תיעוד אינסולין בזאלי`) due to missing `justify-content: space-between` and `flex: 1` on `.early-modal-header-left`.

### The 5 Implementation Points (Non-Negotiable)

#### Point 1: Strict Native Android Permission Gating (`POST_NOTIFICATIONS`)
- **Native Android (`WebContainerActivity.java`)**:
  - Request Android 13+ `POST_NOTIFICATIONS` runtime permission via `requestPermissions(..., RC_POST_NOTIFICATIONS)`.
  - In `onRequestPermissionsResult`, notify the webview via `window.__onNativeNotificationPermissionResult(granted)`.
  - Expose `openNotificationSettings()` so the app can navigate directly to Android system settings if permission was previously permanently denied.
- **Client Webview (`NotificationSettings.jsx` & `pwa.js`)**:
  - In `handleTogglePush`: DO NOT set `isSubscribed = true` or fire `sendTestPush()` optimistically. Set loading state and wait for the native callback.
  - If user taps **"Allow"** (`granted === true`):
    - Only THEN mark notifications as active (`isSubscribed = true`, `permission = 'granted'`).
    - Dispatch a genuine test alert into the device notification center (`window.AndroidBridge.postNativeNotification`).
    - Show positive feedback toast: *"התראות המכשיר הופעלו בהצלחה! התראת בדיקה נשלחה למגש ההתראות"*.
  - If user taps **"Don't allow"** (`granted === false`):
    - Keep toggle off (`isSubscribed = false`, `permission = 'denied'`).
    - Display explicit decline banner/toast: *"התראות המכשיר נדחו. כדי לקבל תזכורות, יש ללחוץ שוב ולאשר או לפתוח הגדרות מכשיר"*.
    - Provide an "Open Settings" button (`window.AndroidBridge.openNotificationSettings()`) if permission was denied.

#### Point 2: Automatic Native Permission Prompt on App Install / Login (Android Onboarding)
- Standard Android App Lifecycle:
  - When the user installs and completes sign-in (Login or Register) within the Android APK container:
    - Check `window.AndroidBridge.isNotificationPermissionGranted()`.
    - If not yet granted, automatically trigger the native permission prompt once.
    - If the user declines, do not block the app; allow normal navigation and let the user enable it later in Notification Settings.

#### Point 3: Decouple Test Notification from Basal Modal
- In `client/src/pwa.js` (`sendTestPush`):
  - Change target URL from `/?action=basal` to `/?page=notifications` or `/`.
  - Clicking a test notification must ONLY open/focus the app on the notification settings or homepage without triggering any action modal.
  - In `client/public/sw.js` and `WebContainerActivity.java`: ensure the "Log Basal" action button is ONLY attached when `destination.contains('action=basal')` on genuine scheduled basal reminders.

#### Point 4: Premature Basal Pop-Up Timing Guard
- In `client/src/App.jsx` when handling `?action=basal`:
  - Inspect `user.basalTime` (e.g., `"20:00"`).
  - Calculate difference between current local time and scheduled basal time.
  - If current time is strictly before `basalTime` (allowing a threshold of 5 minutes prior):
    - Do NOT open the confirmation modal.
    - Display an informative toast: *"מוקדם מדי להזרקה בזאלית. זמן ההזרקה המתוזמן שלך הוא בשעה {basalTime}"*.
  - If within the valid window (from 5 minutes before scheduled time up to 4 hours after):
    - Open the Basal Confirmation Modal.

#### Point 5: Basal Confirmation Modal Header UI Alignment
- In `client/src/App.css` and `client/src/App.jsx`:
  ```css
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
    margin-bottom: 14px;
  }
  
  .early-modal-header-left,
  .basal-modal-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }
  
  .modal-close-x-btn {
    flex-shrink: 0;
    margin-inline-start: auto;
  }
  ```
  - Guarantees the close button sits at the far edge (top-left in RTL Hebrew, top-right in LTR English/Russian) with ample spacing.

---

## 2. Core Development Rules & Non-Negotiable Standards

### Rule 1: Functions Zero-Diff (Cloudflare Pages vs Client Functions)
- `functions/` and `client/functions/` must be **100% identical at all times (zero diff)**.
- Any change to one directory MUST be immediately copied to the other. Both directories run identical serverless functions on Cloudflare Pages and any drift causes production bugs.
- Always verify with: `git diff --no-index functions client/functions`.

### Rule 2: Detailed Commit Messages
- Never use short or vague commit messages (e.g. "fix bug", "update", "changes").
- Follow Conventional Commits: `<type>(<scope>): <imperative summary>`.
- Always include detailed bullet points listing:
  * Rationale for the change.
  * Files modified/added.
  * Context and testing verification.

### Rule 3 & 5: Autonomous Commits & Pushes Strictly Prohibited
- NEVER run `git commit` or `git push` autonomously.
- Only commit or push when the user explicitly requests it (e.g., "ok commit push", "commit", "push").

### Rule 4: Mandatory Pre-Commit Verification Checklist
Before any commit, run all 6 checks:
1. `npm --prefix client test` (all tests passing).
2. `npm --prefix client run check:theme` (100% theme parity).
3. `npm --prefix client run check:i18n` (100% 3-way translation parity).
4. `node scripts/check-version.js` (full 9-source version sync).
5. `npm --prefix client run lint` (ESLint 0 errors, 0 warnings).
6. `git diff --no-index functions client/functions` (0 diff).

### Rule 6: Pull Request (PR) Protocol
- Always check whether a PR already exists: `gh pr list --head <branch>`.
- Use GitHub CLI: `gh pr create --base main --head <branch> --title "..." --body "..."`.
- Output the full URL to the PR in chat for user review.

### Rule 7: Multilingual Parity (EN, HE, RU)
- Every user-facing UI text, label, error, toast, and dialog must exist in all 3 languages in `client/src/i18n/translations.js`.
- Translations must have 100% key parity across English (`en`), Hebrew (`he` - RTL), and Russian (`ru` - LTR).
- All translations must use natural, grammatically correct medical phrasing.

### Rule 8: Dual Theme Parity (Dark & Light)
- Every component must look polished in both Modern Dark and Modern Light modes.
- Never use hardcoded dark colors or unhandled white text that becomes invisible in Light mode.
- Verified by `npm --prefix client run check:theme`.

### Rule 9: 9-File Unified Version Synchronization
Every release or version bump must synchronize the exact same version string across all 9 locations:
1. `android/app/build.gradle` (`versionName` & incremented `versionCode`)
2. `client/public/version.json` (`version`, `versionCode`, `versionHistory`)
3. Root `package.json`
4. `client/package.json`
5. `server/package.json`
6. `client/src/pwa.js` (`ANDROID_PACKAGE_INFO.version` & `APP_CURRENT_CHANGELOG`)
7. `functions/api/download/android.js`
8. `client/functions/api/download/android.js`
9. `server/src/index.js`
Verified by `node scripts/check-version.js`.

### Rule 10: State Preservation on Localization Change
- Changing the interface language must NEVER reset active context (`personal` vs `shared`), selected owner, basal time, drafts, or form values.
- Language is strictly a presentation-layer translation dictionary.

### Rule 11: Universal Modal Scroll Locking
- Under no circumstances may background pages scroll underneath active modals or navigation drawers.
- Always bind `useLockBodyScroll` hook and enforce `overscroll-behavior: contain !important; touch-action: pan-y;`.

### Rule 12: UI Standards (from `UI_STANDARDS.md`)
- Universal vertical centering (`align-items: center`) on every element, row, and paired icon.
- Universal section gap: `--section-gap: 20px;` managed solely by parent containers. Zero ad-hoc physical margins on child cards.
- Standard icon sizing scale: `22px` card headers, `18px` buttons/controls, `16px` pills/badges.
- Vector SVGs mandatory for paired controls (never raw OS emojis like 👤 vs 👥 which cause glyph size discrepancies).

### Rule 13: Central Project Memory & "Save for Later" Single Source of Truth Rule
- Whenever the user mentions "write to memory", "remember this", "save for later", "write as next task", or anything related to persisting project context, tasks, bugs, or future plans, developers and AI agents MUST always record, write to, and update `MEMORY.md` in the repository root.
- Machine-specific scratchpad files or ephemeral AI session storage do not synchronize across different developer machines or environments. `MEMORY.md` committed directly to Git is the authoritative, shared single source of truth across all devices.

---

## 3. Completed Milestones History

### v1.8.0 (PR #43) — Native Notification Channels, CORS Preflights, Privacy Acceptance & Cascade Account Deletion
- Added `onRequestOptions` and global `Access-Control-Allow-Origin: *` headers to `/api/auth/privacy-accept` and `/api/auth/profile`.
- Multi-tier resilient privacy acceptance with optimistic local update, primary endpoint, and profile fallback.
- User account & data cascade deletion (`DELETE /api/auth/account` and `DELETE /api/auth/me`) wiping logs, push subscriptions, Telegram configs, and sharing relations.
- Consolidated **Info & About** page in sidebar navigation.
- Removed Android WebView tap-highlight square artifacts (`-webkit-tap-highlight-color: transparent`).

### v1.7.0 (PR #42) — In-App Medical Privacy Agreement & Mandatory Consent Flow
- Built 5-section clinical data protection modal without external URLs.
- Added mandatory privacy consent check on login/registration.
- Added in-app policy review card in settings.

### v1.6.0 (PR #41) — Web & Android Push Notification Architecture Overhaul
- Unified Push Notifications naming across all languages.
- Web Push crypto & VAPID signing integration on Cloudflare D1.
- Basal deep link action buttons on notifications.

### v1.5.0 (PR #40) — PWA Update Progress Bar, Celebration Modal & Major Upgrade Rule
- Animated download progress bar and celebratory update modal.
- Native APK download stream handling and major upgrade notifications.

### v1.4.0 (PR #39) — Manual Injection Logging, Modern Reusable Pickers & Spacing Standards
- `POST /api/injections/manual` with duplicate minute prevention, max 1 basal / 10 bolus per day, 31-day past window.
- Reusable `DatePickerModern` calendar popover and unified `TimePicker24h`.
- Relative hour presets (`-1h`, `-2h`, `-3h`, `-4h`).
- Universal `--section-gap: 20px;` spacing standard in `UI_STANDARDS.md`.

### v1.3.1 (PR #38) — Language Switching State Preservation & Reminder Pill Alignment
- Fixed context leakage during language switching.
- Automated version check script (`scripts/check-version.js`).

### v1.3.0 (PR #37) — Telegram Master Toggle & Notification Preferences
- Master toggle for Telegram reminders and per-type notification preferences.

### v1.2.0 (PR #36) — Android APK Packaging & Native Google Sign-In
- Native Android container, adaptive icons, GIS Google Sign-In bridge.

### v1.1.0 & Earlier
- Core insulin logging, 10m/2h/3h eligibility timers, caregiver shared access, and Cloudflare D1 migrations.

---

## 4. Product Backlog & Future Enhancements (Saved for Later)

1. **Basal Notification Direct App/Web Launch Link**:
   - Exclusively for basal insulin reminders (Telegram and Push), append a dedicated action link at the bottom of the notification.
   - Triggers opening the native Android app via intent URL, falling back to `https://insuminder.pages.dev` in browser if app is not installed.
2. **Data Export & Clinical Reporting (CSV & PDF)**:
   - Export injections in CSV format filtered by 7, 14, 30, or 90 days.
   - Printable summary for doctor visits.
3. **Offline Injection Sync Queue**:
   - Queue injection logs in IndexedDB when offline and sync automatically via Service Worker Background Sync when network returns.
4. **Telegram Chat ID Auto-Detection / Webhook**:
   - Simplify Telegram onboarding by having users send `/start` to the bot to automatically bind `chat_id`.
5. **CI Runner Infrastructure Proactive Maintenance**:
   - Track GitHub Actions runner migrations for Node 22/24 LTS and Ubuntu 26 images.
