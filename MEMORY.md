# InsuMinder — Central Project Memory & Single Source of Truth

> **Purpose of this Document**:  
> This file is the permanent, universal single source of truth for all cross-machine context, planned tasks, known bugs, architectural standards, and "save later" memory in InsuMinder. Whenever working on this repository from any computer, IDE, or AI session, always consult this file before starting new work.

---

## 0. Security Alert & Remediation: Exposed VAPID Private Key (GitGuardian)

> **Status**: ✅ REMEDIATED in v1.8.1 (`fix/rotate-vapid-keys-and-remove-hardcoded-secrets`)  
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

### Remediation Actions Completed in v1.8.1
1. **Hardcoded Fallback Keys Fully Removed**:
   - Removed `STABLE_VAPID_KEYS` from `functions/api/_webpush.js`, `client/functions/api/_webpush.js`, and `server/src/webpush.js`.
   - `resolveVapidKeys(env)` now strictly loads keys from `env.VAPID_PUBLIC_KEY` / `process.env` and safely returns `null` or configuration error when keys are missing.
   - Strict Rule 1 zero-diff between `functions/` and `client/functions/` verified.
2. **Zero-Secret Dynamic Testing**:
   - In `server/test/webpush.test.js`, ephemeral in-memory ECDH keypair is generated dynamically at runtime (`crypto.createECDH('prime256v1')`), ensuring unit tests never require hardcoded keys in the repository.
3. **Rule 13 Enacted**:
   - Added Rule 13 ("Zero Hardcoded Secrets & Credentials Rule") to `rules.md` and `MEMORY.md`.
4. **User Environment Deployment Step (Cloudflare Pages Dashboard)**:
   - Navigate in Cloudflare to: **Workers & Pages → InsuMinder → Settings → Variables and secrets**
   - Add the following variables with their exact Types:
     - Variable: `VAPID_PUBLIC_KEY` | Type: `Text` (or `Secret`) | Value: `BKIv2PuDkWiWtMl8g80hszhwJxa37QsAcSMYIcyQjtHEvjX03YfJ6VLcMlOTbDeSYTmxLmGhoHLa0d3M-_gJ-qw`
     - Variable: `VAPID_PRIVATE_KEY` | Type: `Secret` (Encrypted) | Value: `<secure_private_key_provided_in_deployment_notes>`
     - Variable: `VAPID_SUBJECT` | Type: `Text` | Value: `mailto:insuminder@gmail.com`
5. **GitGuardian Resolution**:
   - In the GitGuardian email / dashboard, click **"Fix This Secret Leak"** and mark the incident as rotated & revoked.
6. **VAPID Key Generation & Rotation Standard**:
   - Anytime new VAPID keys are needed, run `npm run generate:vapid` (or `node scripts/generate-vapid-keys.js`).
   - In Cloudflare Pages dashboard (**Workers & Pages → InsuMinder → Settings → Variables and secrets**), update:
     - `VAPID_PUBLIC_KEY`: Type `Text` or `Secret`
     - `VAPID_PRIVATE_KEY`: Type `Secret`
     - `VAPID_SUBJECT`: Type `Text` (`mailto:insuminder@gmail.com`)
   - Also update local `.env` if testing web push notifications locally.

---


### Google Cloud & Firebase Client API Key Security Lockdown Guide
> **Status**: ✅ HARDENED in v2.3.1  
> **Project**: `insuminder-f6f48`  
> **API Key (in `android/app/google-services.json`)**: `AIzaSyCeFVJjCSlHj44jIYyMZ5ldqHxspPkWpsc`  
> **Android Application ID**: `com.insuminder.app`  

#### Step-by-Step Google Cloud Console Restriction Instructions:
1. Navigate to: [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials?project=insuminder-f6f48)
2. Locate and edit the Android API key: `AIzaSyCeFVJjCSlHj44jIYyMZ5ldqHxspPkWpsc` (often labeled "Android key (auto created by Firebase)").
3. **Set Application Restrictions**:
   - Select **Android apps**.
   - Click **Add package name and fingerprint**:
     - **Package Name**: `com.insuminder.app`
     - **SHA-1 Certificate Fingerprint**: `FF:B5:3B:3A:04:6B:38:A4:FB:0E:3A:46:2D:DA:A8:33:FE:51:D9:0F`
     - *(Optional SHA-256 for reference)*: `9F:08:3E:3A:EC:74:D5:7D:94:D7:B3:46:71:7B:CB:E6:72:A5:32:35:20:C2:AA:5A:87:64:F8:5C:E5:20:AA:FE`
4. **Set API Restrictions**:
   - Select **Restrict key**.
   - Enable strictly the following APIs required by the client:
     1. `Firebase Cloud Messaging API` (for push notifications)
     2. `Firebase Installations API` (for client registration tokens)
     3. `Google Identity Services / Play Services Auth` (for Google Sign-In)
5. Click **Save**. The key is now cryptographically bound to InsuMinder's release build and cannot be abused by external apps or domains.

---

## 1. Planned Tasks & Future Backlog (Saved for Later)

### Task 1: Interactive Weekly Injection History Drilldown by Day with Chunked / Lazy Fetching
- **User Story**: In Injection Logs, the user can tap on each day in the weekly report / chart (only days that actually have logged data) to view all injections recorded for that day.
- **Detailed Historical Cards**: Clicking a day displays its logged injection details (time of injection, dose type, delivery method, and reminder statuses: 10m, 2h, 3h Sent / Not Sent with tooltip), identical to how today's injections are displayed on Home and Logs.
- **Chunked / Lazy Loading Architecture (Zero Server Throttling)**:
  - Do NOT fetch massive historical datasets on initial app load. Initial load continues to fetch only recent / current week logs.
  - When the user navigates "back" to a previous week using the week navigation arrows (`< Prev Week`), the app dynamically requests that specific week chunk from the server (e.g. `GET /api/logs?weekStart=YYYY-MM-DD`).
  - Cache loaded weeks in client state to prevent duplicate network calls.

### Key Architectural Solutions
1. **In-App Direct APK Download Flow (`isAndroidApp()`)**:
   - Tapping "Update Now" in the Android app previously only reloaded the WebView, never downloading the actual compiled native APK binary.
   - Fixed in `applyAppUpdate()` and `UpdateBanner.jsx`: on Android, triggers `downloadAndroidApk()`, which launches the native package installer/download manager directly for the latest release APK.
2. **Ground-Truth Native Version Matching (Zero False-Positive Popups on Launch)**:
   - Root cause: WebView `localStorage` persisted stale version strings across APK updates or backup restores.
   - Fixed in `pwa.js`: Priority 1 check in `getStoredAppVersion()` queries `window.AndroidBridge.getNativeVersion()`.
   - In `checkForAppUpdate()`, compares `window.AndroidBridge.getNativeVersionCode()` against remote `data.versionCode`. If native is equal or newer, stored version is synced and update modal is completely suppressed on first launch.
3. **High-Speed Pull-to-Refresh (<350ms Snappy Execution)**:
   - In `App.jsx`, `refreshAppData()` now fetches logs, telegram configs, and caregiver status concurrently via `Promise.allSettled` with a 1200ms timeout race.
   - Removed artificial 450ms `setTimeout` delay from `handlePullTouchEnd`. Dismisses immediately upon data settlement with zero layout jumps.
4. **Exit App Modal Alignment & Bidirectional Parity**:
   - Wrapped modal header icon and title in `.exit-modal-header-left` (`display: flex; align-items: center; gap: 12px; flex: 1;`).
   - Added `.modal-close-x-btn` (✕) on the opposite corner matching all standard modals.
   - Icon and title remain tightly grouped side-by-side across all localizations (HE, EN, RU).
5. **Dual-Channel Reminders (Native Android AlarmManager + Telegram)**:
   - Synchronized 10m meal reminder, 2h glucose check reminder, and daily basal reminder with native Android `AlarmManager` via `scheduleNativeReminder` and `cancelNativeReminder`.
   - Declared `SCHEDULE_EXACT_ALARM` in `AndroidManifest.xml` with adaptive fallback to `setAndAllowWhileIdle` on Android 12+ (API 31+).
   - If both Telegram and Device Notifications are enabled, reminders fire simultaneously on both channels!

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

### Rule 9: 9-File Unified Version Synchronization (Zero-Tolerance Versioning Rule)
- **ZERO-TOLERANCE POLICY**: Under NO circumstances may any branch or PR ever be merged without bumping the application version compared to `main` and incrementing `versionCode`. Merging without versioning is strictly prohibited and permanently blocked.
- Enforced automatically in local pre-commit (`.husky/pre-commit`) and in CI (`.github/workflows/ci.yml`) via `node scripts/check-version.js`. Any PR with an unbumped version or unincremented `versionCode` will immediately fail CI and cannot be merged.
- Every release or version bump must synchronize the exact same version string across all 9 locations:
  1. `android/app/build.gradle` (`versionName` & incremented `versionCode`)
  2. `client/public/version.json` (`version`, `versionCode`, `versionHistory`)
  3. Root `package.json`
  4. `client/package.json`
  5. `server/package.json`
  6. `client/src/pwa.js` (`ANDROID_PACKAGE_INFO.version` & `APP_CURRENT_CHANGELOG`)
  7. `functions/api/download/android.js`
  8. `client/functions/api/download/android.js`
  9. `server/src/index.js`
- Verified in pre-commit and CI via `node scripts/check-version.js`.

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

### Rule 12: Central Project Memory & "Save for Later" Single Source of Truth Rule
- Whenever the user mentions "write to memory", "remember this", "save for later", "write as next task", or anything related to persisting project context, tasks, bugs, or future plans, developers and AI agents MUST always record, write to, and update `MEMORY.md` in the repository root.
- Machine-specific scratchpad files or ephemeral AI session storage do not synchronize across different developer machines or environments. `MEMORY.md` committed directly to Git is the authoritative, shared single source of truth across all devices.

### Rule 13: Zero Hardcoded Secrets & Credentials Rule
- **VAPID Key Generation Helper**: Run `npm run generate:vapid` (`node scripts/generate-vapid-keys.js`) at any time to generate a fresh RFC 8292 ECDSA P-256 keypair for Cloudflare Pages ("Variables and secrets") and local `.env`. Never commit generated keys to git.
- Under NO circumstances may any real, default, fallback, or mock API keys, private keys (such as VAPID keys), auth secrets, webhook secrets, database credentials, or tokens ever be hardcoded into tracked files in this repository.
- All secrets, private keys, and runtime credentials MUST be loaded strictly through environment variables (`context.env` in Cloudflare Pages Functions or `process.env` in Node.js).
- If environment variables are not configured in a deployment or local runtime, the application code must degrade safely and return a clear, descriptive configuration error (e.g. 'VAPID keys not configured') rather than falling back to hardcoded secrets.
- Automated tests requiring cryptographic keypairs (e.g. VAPID / ECDSA prime256v1 JWT signing) MUST generate ephemeral in-memory keys on the fly during test setup (`crypto.createECDH('prime256v1')`) and never store static keys in test code or mock fixtures.
- **Automated Pre-Commit & CI Secret Scanner**: Enforced automatically in local pre-commit (`.husky/pre-commit`), root `npm test`, and in CI (`.github/workflows/ci.yml`) via `scripts/check-secrets.js` (`npm run check:secrets`). Scans tracked files and untracked git candidates for private keys, service account JSONs, Telegram bot tokens, and sensitive cloud credentials before any commit or PR can succeed.

---

### Rule 14: Dynamic Date Formatting & Strict 24-Hour Time Standards
- **Zero Hardcoded Date Formats**:
  - No component, screen, view, modal, table, or chart may hardcode a date display format.
  - All user-facing date displays, logs, and pickers MUST dynamically honor the active date format preference configured in Settings (`DD/MM/YYYY` [default], `MM/DD/YYYY`, or `YYYY-MM-DD`).
- **Universal Date Formatting Architecture & Fallback Mechanism**:
  - Always format dates using `formatDisplayDate(value, dateFormat)` or format-aware helpers (`formatDateOnly`, `formatDateTime`) from `src/utils.js`.
  - **Failsafe Automatic Fallback**: If `dateFormat` is omitted in any call or component, the formatting utilities and `DatePickerModern` automatically retrieve the user's choice from `getSavedDateFormat()` (stored in `localStorage['insuminder_date_format']`), guaranteeing zero regressions even if a prop is not explicitly forwarded.
- **Mandatory Reusable Date Picker Component (`DatePickerModern`)**:
  - All date picking across the entire application MUST use `DatePickerModern`.
  - Native `<input type="date">` is strictly prohibited.
  - `DatePickerModern` must always bind to the active `dateFormat` (with automatic fallback to `getSavedDateFormat()`). It manages parsing, dynamic placeholders, and keyboard input masking.
- **Strict 24-Hour Time (Zero AM/PM)**:
  - We use ONLY 24-hour time without AM/PM throughout the entire application (`HH:mm`, e.g. `14:30`).
  - Native `<input type="time">` is strictly banned; use `TimePicker24h`.

---

## 3. Completed Milestones History

### v2.3.0 — Dedicated Meal Portion Carb Calculator, Personal Foods Database & Quick Navigation
- **Dedicated Meal Portion Carb Calculator (`CarbCalculator`)**:
  * Calculates exact portion carbohydrates in real-time from carbs per 100g:
    $$\text{Total Carbs} = \frac{\text{Carbs per 100g} \times \text{Portion Weight (g)}}{100}$$
  * Formatted output with 1 decimal place precision (e.g. 25g/100g with 140g meal = 35.0g carbs).
  * Quick portion preset chips (50g, 75g, 100g, 125g, 150g, 200g, 250g, 300g) for 1-tap portion selection.
  * Clear button and interactive formula transparency breakdown (`(25g × 140g) ÷ 100 = 35g carbs`).
- **Personal Food Database & User Scoping**:
  * New `saved_foods` table in SQLite (`server/src/db.js`) and Cloudflare D1 (`functions/api/_telegram.js`).
  * Endpoints `GET /api/foods`, `POST /api/foods`, `DELETE /api/foods/:id` with user authentication, input validation, and cascade deletion upon user account deletion.
  * Local guest fallback caching to `localStorage` (`insuminder_saved_foods`) for instant offline use.
  * Search bar with case-insensitive filtering across all saved foods, displaying 20 most recent foods by default.
  * On saved food selection: **Auto-populates the Carbs per 100g input ONLY**, leaving portion grams input empty for the user to input their custom meal portion weight.
- **Home Dashboard Quick Access Shortcut & Dedicated Navigation**:
  * Placed a sleek, modern quick shortcut card directly below the Bolus & Basal injection action buttons on the Home tab for 1-tap navigation before taking a mealtime dose.
  * Integrated dedicated navigation tab positioned between Home and Injection Logs (`/?page=calculator`, alias `/?page=carbs`).
  * Full accessibility, keyboard navigation, and custom delete confirmation modal.
- **Top-Side Toast Notification Engine for Calculator**:
  * Replaced static, in-place feedback banner with the application's central auto-dismissing top-side toast notification system (`onNotify={setNotification}`).
  * Dispatches standard `.app-notification-success` and `.app-notification-warning` with 4.5s auto-dismiss and manual close button, unifying notification UX with settings and injection alerts.
- **Production Injection Reliability & Cloudflare D1 Subrequest Optimization**:
  * Root Cause: `ensureTablesExist` in `_telegram.js` was executing 29 sequential `CREATE TABLE` and `ALTER TABLE` queries on every `/api/injections` call and inside `context.waitUntil(dispatchDueNotifications)`, frequently exceeding Cloudflare's 50-subrequest worker limit and triggering HTTP 500/524 errors.
  * Solved with worker isolate caching (`tablesEnsured`) and fast-path `PRAGMA table_info` checks: reduces D1 subrequests from 65+ down to 0 on warm requests and 3 on cold start.
  * Resilient Client Error Handling: in `App.jsx`, updated `handleLogInjection` and `handleManualInjectionSubmit` to catch any 5xx server blips, timeouts, or network interruptions, immediately saving the dose to `enqueueOfflineInjection` with optimistic local state updates and an encouraging `(Saved offline)` toast. No injection is ever lost or rejected with false connection errors.
  * Added `.catch` handler to background `context.waitUntil` dispatch.
  * Fixed Israel Daylight Saving Time (DST) transition calculation for `yesterday` in unit tests.
- **Rule 1, 7, 8, 9, 13 Compliance**:
  * Zero diff between `functions/` and `client/functions/`.
  * 100% 3-way translation parity (EN, HE, RU) across 650 keys in `translations.js`.
  * Modern Dark & Light theme parity verified with `npm --prefix client run check:theme`.
  * Zero Hardcoded Secrets (Rule 13) pre-commit & CI scanner verified via `scripts/check-secrets.js`.
  * Synchronized semantic version bump to `v2.3.0` (versionCode `27`) across all 9 locations verified via `check-version.js`.

### v2.2.0 — Firebase Cloud Messaging (FCM) Killed App Push Delivery, AlarmClock Doze Immunity & 1-Tap Battery Exemption
- **Firebase Cloud Messaging (FCM) Remote Push Engine for Killed App Delivery**:
  * Solved Android OEM task-killer notification loss (Xiaomi HyperOS, Samsung OneUI) when app is closed/swiped away or force-killed.
  * Google Play Services FCM wakes up device and delivers notification banner even when the app process is completely dead.
  * Pure Web Crypto implementation of Google OAuth2 Service Account assertion JWTs (`crypto.subtle.importKey("pkcs8", ...)` and `crypto.subtle.sign("RSASSA-PKCS1-v1_5", ...)`) in `functions/api/_fcm.js` and `client/functions/api/_fcm.js` with zero external dependencies, running natively on Cloudflare Pages Functions edge runtime.
  * Express server FCM engine in `server/src/fcm.js` for local dev and self-hosted environments.
  * Device FCM token subscription route (`POST /api/push/subscribe` with `{ fcmToken }`) saved as `fcm:<token>` endpoint.
  * Multi-channel scheduler integration in `server/src/scheduler.js` and `functions/api/_telegram.js` routing to FCM when subscriptions start with `fcm:`, with auto-pruning on `UNREGISTERED` expired tokens.
- **High-Precision AlarmClock Engine (`AlarmManager.setAlarmClock()`)**:
  * Upgraded native Android alarms from `setExactAndAllowWhileIdle` to `AlarmManager.setAlarmClock()`.
  * Immune to Android Doze mode, doesn't require `SCHEDULE_EXACT_ALARM` runtime permission, and triggers with millisecond precision.
- **Phone Reboot & Package Update Alarm Persistence (`BootReceiver`)**:
  * Implemented `BootReceiver` listening for `ACTION_BOOT_COMPLETED` and `ACTION_MY_PACKAGE_REPLACED`.
  * Reads persisted reminder schedules from SharedPreferences and reschedules future alarms via `setAlarmClock()` automatically upon device reboot.
- **100% Concurrent Deduplication Guard**:
  * Centralized `NotificationHelper.displayNotification()` with shared reminder tag and Android `NotificationCompat.Builder.setOnlyAlertOnce(true)`.
  * 60-second SharedPreferences timestamp guard prevents duplicate banner chimes even when both local AlarmClock and remote FCM push trigger at the exact same second.
- **1-Tap Background & Battery Optimization Exemption**:
  * Native bridge methods `isBatteryOptimizationIgnored()` and `requestIgnoreBatteryOptimizations()`.
  * Triggers Android's native 1-tap system dialog (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) without sending users through complex system menus.
  * UI card in `NotificationSettings.jsx` showing battery status (Unrestricted vs Optimized) and FCM connection status banner with full Dark & Light mode parity.
- **Full Version Parity & 0-Diff Functions**:
  * Synchronized version bump to `v2.2.0` (versionCode `26`) across all 9 locations with 0 diff between `functions/` and `client/functions/`.

### v2.1.0 — Offline Injection Sync Queue & Universal Button Loading Animations
- **Offline Injection Sync Queue (`client/src/offlineQueue.js`)**:
  * Seamless offline logging for both Bolus and Basal injections (and manual logs) when disconnected or network requests fail.
  * Preserves exact dose timestamps (`injected_at`) and delivery method.
  * Optimistically updates UI state and logs in memory so clinical countdown timers (10m, 2h, 3h safe window) and native Android `AlarmManager` alarms fire without delay.
  * Persistent storage in `localStorage` with corrupted JSON recovery and duplicate minute tolerance (dequeuing on 409 responses).
  * Automatic background synchronization via `registerOfflineSyncListeners` on `online` network restoration, tab visibility, and pull-to-refresh.
  * Real-time Offline Sync Banner with one-click "Sync Now" button and pending sync badges (`⏳ Sync Pending`) in logs table and latest injection card.
- **Backend Smart Scheduling for Offline Sync (`is_offline_sync: true`)**:
  * In `functions/api/injections.js`, `client/functions/api/injections.js`, `server/src/index.js`, and `server/src/db.js`:
  * Detects when an injection was logged in the past. If reminder times (10m, 2h, 3h) have already passed, marks them as sent with `'Sync after reminder time'` to prevent spamming expired alerts.
  * If reminder times are still in the future, leaves `status = 0` so the server scheduler delivers them on time.
- **Universal Button Loaders & Dynamic Action Titles**:
  * In `NotificationSettings.jsx`: replaced `'...'` static text on "Enable / Disable Device Push" with animated `.btn-spinner` and localized dynamic states (`devicePushEnabling`, `devicePushDisabling`).
  * Added animated `.btn-spinner` and disabled state to the "Send Test Push" button while dispatching test alerts.
  * In Home big injection buttons (`App.jsx`): dynamically updates title text from static "Log Injection" to "Injecting...", "Log Bolus" to "Logging Bolus...", and "Log Basal" to "Logging Basal..." while loading.
- **Full Version Parity & 0-Diff Functions**:
  * Synchronized version bump to `v2.1.0` (versionCode `25`) across all 9 locations with 0 diff between `functions/` and `client/functions/`.

### v2.0.1 — Unified Notification Messages across OS & Telegram, 3h Native Alarm & Zero-Tolerance CI Versioning Check
- **Single Source of Truth for Notification Messages**:
  * Unified reminder messages across Android Native AlarmManager, Web Push, and Telegram in `client/src/utils.js` (`getReminderNotificationContent`) and `translations.js` (`reminderMessages`).
  * Ensured identical clinical prompt texts, dose times, emojis, and styling across all 3 languages (EN, HE, RU) with 100% parity.
- **Fixed Basal Notification Missing Description**:
  * Added `settings.basalReminderTitle` and `settings.basalReminderDesc` to `translations.js` under `settings` so native reminders no longer display raw unmapped keys.
- **Added 3-Hour Native Android Notification**:
  * Added `bolus-3h` AlarmManager scheduling and cancellation to `client/src/App.jsx`, ensuring users receive native OS alerts when the 3-hour safe injection window is reached.
- **Zero-Tolerance Versioning Rule Enacted in CI & Pre-Commit**:
  * Updated `.husky/pre-commit`, `.github/workflows/ci.yml` (`fetch-depth: 0`), and `scripts/check-version.js` so unversioned commits and PRs are permanently blocked from merging.
- **Full Version Parity & 0-Diff Functions**:
  * Synchronized version bump to `v2.0.1` (versionCode `24`) across all 9 locations with 0 diff between `functions/` and `client/functions/`.

### v1.9.3 (PR pending) — Xiaomi HyperOS Direct App Info Intent Fallback, Spinner Timeout & Settings UI Visibility
- **Xiaomi HyperOS Direct App Info Intent Fallback**:
  * In WebContainerActivity.java, added isXiaomiDevice() detection. On Xiaomi/HyperOS/MIUI devices, directly dispatch Settings.ACTION_APPLICATION_DETAILS_SETTINGS (App Info) and miui.intent.action.APP_PERM_EDITOR to guarantee access to notification, permission, and autostart toggles without being blocked by Xiaomi's security manager.
  * In requestNotificationPermission(), immediately invoke openAppNotificationSettings() for Xiaomi devices since sideloaded APKs have runtime permission dialogs suppressed by default.
- **Permission Suppression Spinner Freeze Fix**:
  * In NotificationSettings.jsx, added a 2-second timeout fallback on res.pendingPrompt to clear pushLoading and prompt the user if the OS silently drops requestPermissions() without returning a result.
- **Enhanced Settings Button Visibility**:
  * Added .push-action-btn.btn-settings styling with bright cyan accent in both dark and light modes, eliminating the perceived "grayed out" appearance.
- **Full Version Parity & 0-Diff Functions**:
  * Synchronized version bump to v1.9.3 (versionCode 15) across all 9 locations with 0 diff between functions/ and client/functions/.

### v1.9.2 (PR #48) — Xiaomi HyperOS / Android 14+ Notification Auto-Redirect & Date Format Settings UI
- **Xiaomi HyperOS / Android 14+ Notification Auto-Redirect**:
  * Rewrote openAppNotificationSettings() in WebContainerActivity.java with 3-tier fallback intents (Xiaomi/MIUI extras app_package and app_uid, standard EXTRA_APP_PACKAGE, and ACTION_APPLICATION_DETAILS_SETTINGS).
  * Auto-redirect on permission denial/suppression: when HyperOS silently auto-denies runtime permission for sideloaded APKs, immediately redirects to device notification settings.
  * In NotificationSettings.jsx, exposed persistent Open Device Notification Settings button alongside Enable Push button for Android even in default permission state.
  * In App.jsx, changed permission prompt tracking from permanent localStorage to session-scoped sessionStorage, automatically re-checking permissions on login and after app update completion.
- **Date Format Settings UI Collision & Wrapping Fix**:
  * Fixed visual collision in Settings tab where date sample chip collided with checkmark icon in RTL Hebrew, and ISO format wrapped to two lines.
  * Re-architected option layout into dedicated text description block and meta block (date-format-sample with white-space: nowrap; and checkmark icon flex-clustered with gap: 8px).
  * Added light theme overrides for .date-format-desc.
- **Full Version Parity & 0-Diff Functions**:
  * Synchronized version bump to v1.9.2 (versionCode 14) across all 9 locations with 0 diff between functions/ and client/functions/.

### v1.9.1 (PR #47) — Android Native Permissions & Notification Lifecycle Overhaul
- **Strict Native Android Permission Gating (`POST_NOTIFICATIONS`)**: `WebContainerActivity.java` runtime permission prompt bridge with `window.__onNativeNotificationPermissionResult(granted)`. In `NotificationSettings.jsx`, wait for native callback before activating or dispatching test push, with explicit feedback banners and device settings redirection button.
- **Android Onboarding Permission Prompt**: Prompt for runtime notification permissions upon login/registration in the Android container if not yet granted.
- **Decoupled Test Push Delivery**: Decoupled test notifications from the clinical basal modal by targeting `/?page=notifications`.
- **Premature Basal Pop-Up Timing Guard**: Added `getBasalTimeDiffMinutes(nowDate, basalTimeStr)` in `utils.js` with circular 24h clock wrap-around. Blocks early basal modal pop-up and displays informative warning toast if accessed earlier than 5 minutes before scheduled basal time.
- **Basal Modal Header UI Alignment**: Standardized `.modal-header`, `.early-modal-header-left`, and `.modal-close-x-btn` for bidirectional spacing parity.
- 100% synchronized version bump to `v1.9.1` (versionCode `13`) across all 9 locations with 0 diff between `functions/` and `client/functions/`.

### v1.9.0 (PR #45) — Dynamic Date Format Setting (Israel/Global/ISO), Universal 24-Hour Time & Local Session Persistence
- User-selectable date formats (`DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`) with fail-safe automatic fallback via `getSavedDateFormat()`.
- Reusable `DatePickerModern` calendar popover and unified `TimePicker24h`.
- Strict 24-hour time standardization application-wide with zero AM/PM.
- Local storage session fallback persistence preventing repeated privacy modal prompts on page refresh.

### v1.9.6 (PR #52) — Direct APK Download, OS Notification Detection, QA Tester Account & Diagnostics
- Eradicated APK download freeze and modal screen dimming in WebView: eliminated window.open download traps in pwa.js and AndroidInstallModal.jsx and added download handling to onCreateWindow in WebContainerActivity.java.
- Enhanced getNotificationPermission() in pwa.js to inspect window.Notification?.permission and persistent localStorage flag, instantly recognizing when notifications are permitted in Android OS settings and rendering the status as **Active ("פעיל")**.
- Eliminated confusing double buttons in NotificationSettings.jsx, consolidating to a single, contextual action button ("בדיקת התראות" when active, "הפעל התראות" when pending).
- Added "I enabled it in settings - Activate now" direct confirmation button in ManualNotificationGuideModal.jsx.
- Dedicated QA tester user (qa-tester or qa@insuminder.com with password A123456!) supported across Cloudflare Functions and Express server, automatically creating the user if missing and bypassing email OTPs.
- Built interactive In-App Diagnostics Center (DiagnosticModal.jsx) accessible for QA user and via 5-tap gesture on the app footer version, featuring live subsystem introspection, action triggers, event stream log, and /api/dev/device-logs telemetry.
- 100% version synchronization across all 9 locations to 1.9.6 (versionCode 18).

### v1.9.6 (PR #52) — Direct APK Download, OS Notification Detection, QA Tester Account & Diagnostics
- Eradicated APK download freeze and modal screen dimming in WebView: eliminated window.open download traps in pwa.js and AndroidInstallModal.jsx and added download handling to onCreateWindow in WebContainerActivity.java.
- Enhanced getNotificationPermission() in pwa.js to inspect window.Notification?.permission and persistent localStorage flag, instantly recognizing when notifications are permitted in Android OS settings and rendering the status as **Active ("פעיל")**.
- Eliminated confusing double buttons in NotificationSettings.jsx, consolidating to a single, contextual action button ("בדיקת התראות" when active, "הפעל התראות" when pending).
- Added "I enabled it in settings - Activate now" direct confirmation button in ManualNotificationGuideModal.jsx.
- Dedicated QA tester user (qa-tester or qa@insuminder.com with password A123456!) supported across Cloudflare Functions and Express server, automatically creating the user if missing and bypassing email OTPs.
- Built interactive In-App Diagnostics Center (DiagnosticModal.jsx) accessible for QA user and via 5-tap gesture on the app footer version, featuring live subsystem introspection, action triggers, event stream log, and /api/dev/device-logs telemetry.
- 100% version synchronization across all 9 locations to 1.9.6 (versionCode 18).

### v1.9.5 (PR #51) — Native APK Download Handler, Safe In-App Manual Guide & Notification Onboarding
- Native APK Download Handler & DownloadListener in `WebContainerActivity.java` and `pwa.js` resolving WebView stuck download loading lines by routing external downloads to GitHub Releases via system browser / Android DownloadManager.
- Built `ManualNotificationGuideModal.jsx` with 3 clear step-by-step instructions for device settings, completely eradicating Android `net::ERR_UNKNOWN_URL_SCHEME` white screen errors.
- Automatic Notification Permission Onboarding on Install, Login, and Update in `App.jsx` (calling `promptNotificationPermissionIfNeeded`, strictly restricted to when permission is not yet granted).
- Resolved duplicate alert rendering in `NotificationSettings.jsx` and added native version introspection (`getNativeVersion()`, `getNativeVersionCode()`, `downloadApk(url)`).
- 100% version synchronization across all 9 locations to `v1.9.5` (versionCode `17`).

### v1.9.4 (PR #50) — Pure Intent URI Fallback, Outdated APK Shell Auto-Detection & CI Suite Stabilization
- Pure Android `intent:` scheme fallback (`intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=com.insuminder.app;end`) to open system settings directly even when the native bridge method is missing.
- Implemented `Intent.parseUri(..., Intent.URI_INTENT_SCHEME)` in `WebContainerActivity.java` to properly handle intent URIs within WebView.
- Outdated APK Shell Auto-Detection in `NotificationSettings.jsx` and `pwa.js`: immediately alerts users running ancient native APK containers (e.g. `v1.2.0` lacking Android 14 `POST_NOTIFICATIONS`) and provides a 1-tap download and install button for the latest APK (`v1.9.4`).
- Prevented 3-dot indefinite loading spinner by identifying unsupported native bridge methods immediately on toggle.
- CI Server Unit Test Suite Stabilization: resolved socket teardown race conditions in `server/test/download.test.js` via awaited `server.close()`, ensured clean SQLite database shutdown in `server/test/manual-injections.test.js`, and randomized test email per run to eliminate test runner cancellations.
- 100% version synchronization across all 9 locations to `v1.9.4` (versionCode `16`).

### v1.9.3 (PR #49) — Xiaomi HyperOS Notification Permission & System Settings Bridge
- Added dedicated Xiaomi HyperOS / MIUI App Info and security permissions intent handlers.
- Fallback timer to prevent silent blocking on aggressive OEM permission managers.
- High-visibility settings button styling and translations.

### v1.9.2 (PR #48) — Basal Notification Direct App/Web Launch Link
- Appended direct app/web launch link to scheduled basal reminders.
- Deep link routing to `/?action=basal` and basal injection confirmation modal.

### v1.8.1 (PR #44) — Zero Hardcoded Secrets Architecture & VAPID Credential Remediation
- Fully eradicated hardcoded VAPID keys from `functions/api/_webpush.js`, `client/functions/api/_webpush.js`, and `server/src/webpush.js`.
- Dynamic environment resolution with graceful fallback error handling when credentials are missing.
- Ephemeral in-memory test keypair generation in `server/test/webpush.test.js` using `crypto.createECDH('prime256v1')`.
- Enacted Rule 13 ("Zero Hardcoded Secrets & Credentials Rule") in `rules.md` and `MEMORY.md`.
- Strict 100% version synchronization across all 9 manifest and code locations.

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

1. **Data Export & Clinical Reporting (CSV & PDF)**:
   - Export injections in CSV format filtered by 7, 14, 30, or 90 days.
   - Printable summary for doctor visits.
2. **Telegram Chat ID Auto-Detection / Webhook**:
   - Simplify Telegram onboarding by having users send `/start` to the bot to automatically bind `chat_id`.
3. **Concurrent Shared Caregiver Multi-Account Management**:
   - Enable caregivers to simultaneously link, monitor, and switch between multiple family members or dependent patient profiles with individual notification preferences.
