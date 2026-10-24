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

## 1. Active Sprint Task (v2.0.0)

### Task Details
- **Task**: Therapy Delivery Modes (Pens / MDI vs Insulin Pump / Patch Pump / Pod), Onboarding Selector & Historical Log Isolation
- **Target Version**: 2.0.0 (versionCode 23)
- **Status**: Implemented on branch `feat/therapy-modes-pen-and-pump-flows` (awaiting user commit & push approval).

### Key Architectural Solutions
1. **Database Schema & Migrations**:
   - Added `therapy_mode TEXT DEFAULT NULL` to `users` ('pen' | 'pump').
   - Added `delivery_method TEXT DEFAULT 'pen'` to `injection_logs` ('pen' | 'pump').
   - Maintained backward compatibility: existing logs default to 'pen'.
2. **Mandatory Onboarding Mode Selection**:
   - Following registration and medical privacy acceptance, users without a `therapy_mode` land on the modal (`TherapyModeOnboardingModal.jsx`).
   - Side-by-side interactive tiles for Pens vs Pump/Pod with real-time description text underneath.
   - Disabled continue button until a choice is selected. Persisted to server profile so refreshes/re-logins land back on this screen.
3. **Settings Switch Flow & Modal**:
   - Dedicated "Insulin Delivery Method" section in Settings allows switching modes anytime.
   - Confirmation modal explains the mode differences, warns about method-specific log isolation, and reloads home upon confirmation.
4. **Historical Log Isolation & Home "Last Injection" Rule**:
   - In Pen mode, logs and weekly trends show only Pen injections.
   - In Pump mode, logs and weekly trends show only Pump injections.
   - The Home "Last Injection" card reflects the true latest bolus across both methods to ensure active insulin timing is never lost.
5. **Pump Logic Differences**:
   - Basal eliminated: no basal button on Home, no basal settings/card, no basal reminder toggles, and background schedulers exclude pump users.
   - Relaxed 3h confirmation modal: double-check to prevent accidental clicks without alarming risk warnings.
   - Daily bolus limit doubled from 10 to 20 for pump mode.
   - Orange pills and rapid injection warning cards (< 3h) removed from Home and Logs.

### Key Architectural Solutions
1. **Android Hardware Back Key Dispatch Interception**:
   - In `WebContainerActivity.java`, override `dispatchKeyEvent` and `onKeyDown` for `KeyEvent.KEYCODE_BACK` to prevent WebView internal history exhaustion from finishing the Activity.
   - Comprehensive exit handlers: `window.AndroidBridge.exitApp()`, `insuminder://exit` custom URL scheme interception in `shouldOverrideUrlLoading` and `resolveTargetUri`, and `WebChromeClient.onCloseWindow()`.
2. **Back Navigation Hierarchy**:
   - 1st back: Closes any active modal/drawer.
   - 2nd back: Navigates immediately to Home (`activeTab = 'home'`).
   - 3rd back (on Home): Opens Exit Confirmation Modal.
   - Inside Exit Modal: Back or "Stay" dismisses the modal and remains on Home; "Exit" terminates the native Android activity.
3. **Exit App Confirmation Modal UI**:
   - Replaced stacked bulky buttons with side-by-side single-row layout (`flex-direction: row; gap: 12px; flex: 1 1 0; min-width: 0`).
   - 100% responsive and tested in modern Dark and Light themes.
4. **Modern Native Floating Pull-To-Refresh**:
   - Replaced in-flow expanding text pill with Material/iOS-style floating circular badge overlay (`position: fixed; left: 50%; transform: translate(-50%, ...)`).
   - Zero layout shift: underlying clock, action buttons, and cards stay completely static.
   - Crisp vector SVG spinner with proportional drag rotation and smooth spinning animation on release.

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

### Rule 12: Central Project Memory & "Save for Later" Single Source of Truth Rule
- Whenever the user mentions "write to memory", "remember this", "save for later", "write as next task", or anything related to persisting project context, tasks, bugs, or future plans, developers and AI agents MUST always record, write to, and update `MEMORY.md` in the repository root.
- Machine-specific scratchpad files or ephemeral AI session storage do not synchronize across different developer machines or environments. `MEMORY.md` committed directly to Git is the authoritative, shared single source of truth across all devices.

### Rule 13: Zero Hardcoded Secrets & Credentials Rule
- **VAPID Key Generation Helper**: Run `npm run generate:vapid` (`node scripts/generate-vapid-keys.js`) at any time to generate a fresh RFC 8292 ECDSA P-256 keypair for Cloudflare Pages ("Variables and secrets") and local `.env`. Never commit generated keys to git.
- Under NO circumstances may any real, default, fallback, or mock API keys, private keys (such as VAPID keys), auth secrets, webhook secrets, database credentials, or tokens ever be hardcoded into tracked files in this repository.
- All secrets, private keys, and runtime credentials MUST be loaded strictly through environment variables (`context.env` in Cloudflare Pages Functions or `process.env` in Node.js).
- If environment variables are not configured in a deployment or local runtime, the application code must degrade safely and return a clear, descriptive configuration error (e.g. 'VAPID keys not configured') rather than falling back to hardcoded secrets.
- Automated tests requiring cryptographic keypairs (e.g. VAPID / ECDSA prime256v1 JWT signing) MUST generate ephemeral in-memory keys on the fly during test setup (`crypto.createECDH('prime256v1')`) and never store static keys in test code or mock fixtures.

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
6. **Concurrent Shared Caregiver Multi-Account Management**:
   - Enable caregivers to simultaneously link, monitor, and switch between multiple family members or dependent patient profiles with individual notification preferences.
