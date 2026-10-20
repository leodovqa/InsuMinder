# InsuMinder — Application Development Plan & Roadmap

## 1. Project Overview & Clinical Mission
InsuMinder is a web and mobile platform for insulin-dependent individuals, caregivers, and families. The platform tracks rapid-acting (Bolus) and long-acting (Basal) insulin injections, prevents dangerous insulin stacking, and dispatches automated reminders at critical clinical intervals (10-minute meal window, 2-hour glucose check, 3-hour eligibility safety lock).

---

## 2. Technology Stack & Production Architecture

* **Frontend**: React 19, Vite, Vitest, CSS Design System (Theme Tokens, RTL/LTR bidirectional support).
* **Local Backend**: Node.js, Express, SQLite (`server/insuminder.db`), background timer scheduler.
* **Production Cloud**: Cloudflare Pages Functions (serverless edge API) + Cloudflare D1 (serverless SQLite database).
* **Mobile & Notifications**: Android APK (AndroidX Custom Tabs / TWA WebContainer + Native GIS Bridge), Web Push (RFC 8291/8292 VAPID encryption), and Telegram Bot API.
* **Testing & Quality Assurance**: Vitest (client components & clinical timers), Node.js built-in test runner (server API & database integration), GitHub Actions CI/CD with 100% theme, version, i18n, and cloud/client function parity gating.

---

## 3. Phase 1: Completed Milestones

### 1. Development Environment & Setup
- [x] Node.js, npm, Vite, and Express parallel startup scripts (`npm run dev`, `.\start-dev.ps1`, Docker Compose).
- [x] Strict ESLint configuration and multi-tier parity validation scripts (`scripts/check-version.js`).

### 2. User Interface & Clinical Safety Windows
- [x] Modern responsive UI with dark/light theme parity and full RTL (Hebrew) and LTR (English, Russian) localization.
- [x] Dynamic Bolus & Basal injection button with automatic 20:00 split and midnight reversion.
- [x] 10-Minute Meal Time countdown with visual progress bar.
- [x] 2-Hour Postprandial Glucose Check countdown and alert card.
- [x] 3-Hour Active Insulin Eligibility countdown and safety guard (gray button state + Early Injection Confirmation Modal).
- [x] Stacked Israeli Calendar Weekly Trend Chart (Sunday–Saturday).
- [x] Manual historical injection logging with reusable `DatePickerModern` and `TimePicker24h`.

### 3. Server, Database & API Development
- [x] REST API endpoints for bolus/basal injection tracking (`POST /api/injections`, `POST /api/injections/manual`, `GET /api/logs`).
- [x] User authentication (passwordless email verification codes + Google Identity Services OAuth).
- [x] Brute-force account protection (10-minute lockout after 5 failed attempts).
- [x] Medical privacy consent agreement modal and mandatory onboarding flow.
- [x] Cascade account & data deletion (`DELETE /api/auth/account`).
- [x] Cloudflare Pages serverless edge API (`functions/api/`) maintaining 100% hash parity with client functions.

### 4. Notifications & Cross-Channel Dispatch
- [x] Multi-destination Telegram bot notification dispatcher with master toggle and destination active/pause controls.
- [x] Web Push notifications with VAPID encryption and zero-secret dynamic architecture.
- [x] Granular notification preferences with scoped controls for Personal Data vs Shared Caregiver Data.
- [x] Opportunistic edge reminder dispatch (`context.waitUntil`) and external scheduled cron runner (`/api/cron`).

### 5. Mobile & Android Ecosystem
- [x] Native Android package (`com.insuminder.app`, `InsuMinder.apk`) with AndroidX Custom Tabs and WebContainer fallback.
- [x] Native 1-Tap Google Sign-In bridge via Play Services Auth.
- [x] Adaptive density launcher icons and v1/v2/v3 APK signing.
- [x] In-app PWA update progress indicator and major upgrade notification modal.

---

## 4. Phase 2: Active & Upcoming Roadmap

1. **Alternative Date Formats User Setting** (Active Sprint):
   - Provide user configuration in Settings to toggle between `DD/MM/YYYY` (default), `MM/DD/YYYY`, and `YYYY-MM-DD`.
   - Update `DatePickerModern` and clinical date helpers to respect the selected format dynamically across all locales.
2. **Native Android Notification Permission Gating (`POST_NOTIFICATIONS`)**:
   - Explicit runtime permission prompt on Android 13+ devices with settings navigation fallback.
   - Decouple test notification targets from the Basal injection modal.
   - Premature basal pop-up timing guard (minimum 5-minute threshold).
3. **Multiple Concurrent Shared Caregiver Accounts**:
   - Expand caregiver access from 1 active group to concurrent multi-group aggregation and switching.
4. **Data Export & Clinical Reporting**:
   - Generate CSV and printable PDF reports of injection logs for endocrinologist visits.
5. **Offline Injection Queue**:
   - Offline injection queuing in IndexedDB with automated Service Worker background sync.

---

## 5. Core Development & Collaboration Rules
- **Rule 1 (Mandatory UI Standards)**: Strict adherence to [UI_STANDARDS.md](file:///e:/Leo/Github/InsuMinder/UI_STANDARDS.md) for centering, `--section-gap: 20px;`, icon scales, and modal scroll locking.
- **Rule 5 (Branching & PR Gating)**: Never commit directly to `main`. Branches require explicit user agreement. PRs must pass 100% green CI status checks before merging.
- **Rule 7 & 8 (i18n & Theme Parity)**: 100% 3-way translation parity across English, Hebrew, and Russian, plus seamless Dark and Light theme fidelity.
- **Rule 9 (Unified Versioning)**: Every branch/release must synchronize version strings across all 9 manifest and code locations.
- **Rule 12 & 13 (Memory & Secrets)**: Update [MEMORY.md](file:///e:/Leo/Github/InsuMinder/MEMORY.md) for persistent cross-machine context. Zero hardcoded secrets anywhere in the codebase.
