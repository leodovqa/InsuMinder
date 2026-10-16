# InsuMinder 💉⏰

> **A smart, safe, and automated insulin injection tracker & reminder platform for diabetes management.**

InsuMinder is designed for insulin-dependent individuals, caregivers, and families to track rapid-acting insulin doses, prevent dangerous insulin stacking, and dispatch automated, reliable reminders at critical clinical intervals.

---

## 🌟 Core Clinical Logic & Safety Windows

When managing diabetes with rapid-acting insulin (e.g., NovoRapid, Humalog, Apidra), timing is critical to prevent both post-meal glucose spikes (hyperglycemia) and life-threatening insulin stacking (hypoglycemia). InsuMinder enforces three medical safety windows:

```
[Injection Logged] ────> 10 min ────> 2 hours ────> 3 hours
                            │            │             │
                            ▼            ▼             ▼
                    🍽️ Meal Window  🩸 Postprandial  🎯 Safe Eligibility
                       Reminder        Check Window     (Lock Cleared)
```

1. **🍽️ 10-Minute Meal Time Reminder (`+10 min`)**
   - **Clinical Rationale:** Rapid-acting insulin takes approximately 10–15 minutes to enter the bloodstream and begin working. Waiting 10 minutes between injection and the first bite of carbohydrates synchronizes the peak absorption of food with the peak action of insulin, preventing sudden glucose spikes.
   - **App Behavior:** A dedicated card with a visual progress bar counts down 10 minutes. When reached, Telegram delivers a meal notification (`🍽️ Meal Time Reminder`).

2. **🩸 2-Hour Blood Glucose Check (`+2 hours`)**
   - **Clinical Rationale:** Postprandial (post-meal) blood glucose reaches its peak approximately 2 hours after food intake. Checking glucose at this exact mark allows users to evaluate their carbohydrate counting and insulin-to-carb ratios.
   - **App Behavior:** Displays a 2-hour countdown tile and sends a Telegram reminder (`🩸 2-Hour Glucose Check`) prompting the user to measure their glucose.

3. **🎯 3-Hour Active Insulin Eligibility & Stacking Lock (`+3 hours`)**
   - **Clinical Rationale:** Rapid-acting insulin remains biologically active in the body (Insulin On Board - IOB) for 3 to 4 hours. Administering an additional corrective or meal dose before 3 hours have passed causes **insulin stacking**, multiplying active doses and risking severe, dangerous hypoglycemia.
   - **App Behavior:** The home dashboard features a prominent **3-Hour Injection Eligibility Card**. If an injection was logged under 3 hours ago, the card is in a **Locked / Active Insulin** state with a live countdown timer. Once 3 hours elapse, the card turns green: **"Ready to Inject — Safe window reached"**.

4. **⚠️ Rapid Injection Trend Warning**
   - **Safety Mechanism:** If consecutive doses are logged within less than 3 hours of each other, the Injection Logs view displays an amber rapid trend alert detailing the dose times to alert users and caregivers of possible accidental double-dosing.

---

## 🚀 Application Capabilities & Features

### 1. Dashboard & Smart Timers
- **Bolus & Basal Dual-Modality Logging:** Supports both rapid-acting mealtime doses (**Bolus**) and long-acting background doses (**Basal**).
- **Dynamic Split Button:** Standard full-width button logs Bolus insulin throughout the day. At the user's configured Basal time (e.g. 20:00:00), the button dynamically splits in half:
  - **Left (Blue):** Bolus Insulin (triggers 10m meal reminder, 2h check, 3h eligibility countdown).
  - **Right (Orange):** Basal Insulin (one-time background dose; logs event without queuing reminder alerts).
  - **Smart Reversion:** Logging a Basal dose immediately reverts the button back to the single Bolus button. The split also resets cleanly at midnight (`00:00:00`).
- **Modern 24-Hour Clock Picker:** Settings provides a sleek custom 24-hour clock picker with quick steppers, two synchronized 24-hour scroll columns (`00`–`23` and `00`–`59`), and evening presets (`20:00`, `21:00`, `22:00`, `23:00`). Strictly enforces 24-hour format across all locales with zero AM/PM.
- **Safe Timer Anchoring:** Active timers (10-minute meal window, 2-hour check, 3-hour eligibility) remain strictly anchored to the latest Bolus injection, ensuring evening basal doses do not interrupt ongoing meal timers.
- **Early Bolus Injection Guard & Visual Gray State:** When less than 3 hours have passed since the previous Bolus dose (active insulin window), the Bolus injection button turns gray (`btn-gray`) while remaining interactive. Clicking the gray button prompts an **Early Injection Confirmation Modal** with `Yes` and `No` actions to prevent accidental insulin stacking. Selecting `Yes` logs the dose, resets the 10m/2h/3h notifications, and re-anchors the 3-hour timer. Dismissing (`No`, `✕`, or `Escape`) cancels without action. The Basal button remains orange and unaffected.
- **Live Real-Time Clock:** Continuous 24-hour clock synced to local Jerusalem time (`Asia/Jerusalem`).
- **Dynamic State Cards:** Real-time countdowns for 10-minute meal window, 2-hour check, and 3-hour eligibility status.
- **Daily Metrics:** Real-time summary tiles showing today's injection count and the exact time of the last dose.

### 2. Authentication, Google OAuth & Security Controls
- **Magic Code Authentication:** Passwordless login and registration via 6-digit email verification codes (10-minute expiry).
- **Google Identity Services (GIS) Sign-In & Sign-Up:** Authentic Google OAuth popup / One Tap prompt in Google Chrome and modern browsers, providing one-click authentication and automated account creation.
- **Provider Tracking & Duplicate Email Protection:** Tracks `auth_provider` (`google` vs `email`) in the database. If a user registered with Google attempts to register with email/password (or vice-versa), registration is rejected with `"This email is already registered. Please log in."` without disclosing the underlying registration provider.
- **Brute-Force Protection & Account Lockout:** Tracks consecutive failed login attempts (`failed_login_attempts`). After 5 consecutive incorrect passwords, the account is locked for 10 minutes (`locked_until` in DB), returning a 429 status code with the remaining lockout duration. Counter resets to 0 upon successful login.
- **Profile Name Synchronization & Preservation:** When registering via Google, initial profile details (`first_name`, `last_name`, `phone`) are populated from Google. When a user customizes their name in Profile, the customized name is permanently preserved and prioritized across all navigation surfaces (sidebar drawer, user badge, and header) without being overwritten on subsequent Google logins.
- **User Scoping:** All injection logs, configurations, and groups are strictly scoped to the authenticated user.
- **User Profile:** Dedicated Profile management screen allowing users to update their First Name, Last Name, and Phone number with input validation (letters-only for names).
- **Drawer Navigation:** Displays the user's prioritized display name, email, and quick access navigation.

### 3. Caregiver & Family Shared Access (Groups)
- **Shared Access System:** Patients and caregivers can share tracking data seamlessly.
- **Group Creation & Share Codes:** Generate distinct share codes (`INSU-XXXXXX`) to invite family members or caregivers.
- **Home Context Switcher:** Switch between personal logs and viewing shared family member doses directly from the home dashboard.
- **Group Management:** View group members, copy invitation codes, and leave or manage groups.

### 4. Injection Logs & Weekly Israeli Calendar Analytics
- **Slide-Out Drawer:** Clean left-sided drawer housing the complete logs view.
- **Stacked Israeli Calendar Weekly Chart (Sunday–Saturday):** Visual stacked bar chart grouped by week with previous/next week navigation. Bolus doses form the foundation (blue for historical days, purple for today), and Basal doses are stacked on top in vibrant orange (`#ea580c`).
- **Weekly Modality Metric Chips:** Quick-glance chips above the chart display weekly counts: `Bolus this week` and `Basal this week`.
- **Dose Type Badges & Reminders Notice:** Each log entry displays a `Bolus` or `Basal` badge.
- **Basal Scheduled Reminder Status (In Logs Only):** If basal insulin has not yet been injected today, a dedicated basal status row appears under today's logs showing `Not injected yet` alongside its scheduled reminder time and live status pill (`⏳ Pending`, `✓ Sent`, or `✕ Not Sent`). Once injected, it displays the logged dose time and the reminder dispatch status. Clicking the status pill opens the reminder details modal with comprehensive delivery diagnostics.
- **Per-Dose Delivery Pills:** Each bolus log entry displays pills for 10m, 2h, and 3h reminder statuses (`Sent`, `Pending`, or `Not Sent` with delivery error diagnostics tooltip).
- **Direct URL Deep Linking:** Direct navigation via query parameters (e.g. `/?page=logs`, `/?page=settings`, `/?page=profile`).

### 5. Multi-Destination Telegram Reminders
- **Master ON/OFF Switch & Dynamic Card Collapse:** A dedicated master toggle in the Telegram Notifications settings header allows turning Telegram reminders completely on or off. When OFF, the card collapses neatly to show only the Telegram icon, title, and the toggle switch in the OFF state, eliminating clutter for users relying on Web Push or in-app alerts.
- **Complete State & Destination Preservation:** Toggling Telegram OFF preserves all existing bot tokens, chat IDs, custom names, default configuration selections, and individual active/paused states intact without data loss. When toggled back ON, all configurations and selections are immediately restored.
- **Smart Home Alert Suppression:** When the Telegram master toggle is turned OFF, the home screen "Telegram not configured" alert banner is automatically suppressed, respecting the user's choice to use alternative reminder channels.
- **Backend Dispatch Suppression:** When Telegram is turned OFF in preferences, both the local Node scheduler and Cloudflare edge workers suppress Telegram reminder transmissions, marking notifications as disabled in settings rather than reporting unconfigured errors.
- **Multi-Bot Configuration:** Save multiple Telegram bot tokens and chat IDs with custom names (e.g., "Personal Bot", "Family Channel").
- **Default Selector:** Toggle which configuration is active with instant default switching.
- **Destination Active / Inactive Switch:** Granular toggle switch on each saved Telegram destination allowing users to pause or resume reminders for specific bots without deleting credentials.
- **Auto-Formatting Web K Channel IDs:** Automatically converts `-4304245048` format to `-1004304245048` supergroup/channel format.
- **Test Notification Tool:** Built-in test dispatcher with live error reporting.
- **Rich Message Templates:** Messages feature emoji icons (`🍽️`, `🩸`, `🎯`), explicit injection timestamps (`💉 Dose logged at: 14:31`), and environment tagging (`From InsuMinder (Local):` vs production `From InsuMinder:`).
- **Stale Reminder Expiration Guards:** Automatically discards overdue reminders (>45m for meal, >2h for 2h check, >3h for 3h window) to eliminate notification spam when servers wake up or restart.
- **Strict User Account Scoping:** Reminders are strictly dispatched only if the user has an active, valid Telegram configuration assigned to their account. If a user deletes their configuration or has none configured, no reminders are sent (never falling back to other users or legacy test data).
- **Local Dev Queue Reset Control:** In local development, a dedicated button (`.dev-clear-queue-btn`) in the top-right header on the home dashboard allows clearing and cancelling all pending due notifications and scheduled basal reminders instantly.

### 6. Automated Background Delivery & Cloud Cron
- **Production Serverless Architecture:** Hosted on Cloudflare Pages Functions with zero cold-start costs.
- **Dedicated Cloud Cron Trigger:** Scheduled via high-precision external cloud cron (e.g. cron-job.org) pinging the `/api/cron` endpoint every 5 minutes 24/7 with zero queue delay.
- **Opportunistic Edge Dispatch:** Reminders are also verified and dispatched opportunistically on the edge on every injection log via `context.waitUntil()`.

### 7. Multilingual Internationalization & Parity (EN, HE, RU)
- **Three Supported Languages:** Complete native dictionaries for English (`en`), Hebrew (`he` - RTL), and Russian (`ru` - LTR).
- **100% Three-Way Parity:** Strict enforcement via pre-commit and CI (`npm run check:i18n`) verifying all 390 leaf keys, non-empty values, and identical token interpolation.
- **Natural Clinical Terminology:** Medically accurate phrasing tailored for diabetes management, insulin logs, and timed reminders.
- **Localized Telegram Dispatch:** Reminders and test alerts are automatically sent in the patient's chosen language.
- **Persistent Preferences:** User language choice persists seamlessly across client localStorage and backend profile database records.

### 8. Dark & Light Theme Appearance
- **Dual Visual Themes:** Complete styling system with dedicated color palettes for both Dark mode and Light mode.
- **Dark Mode Primary Default:** Dark mode is always the robust default, with automatic detection of system preference (`prefers-color-scheme: light`) when no preference is saved.
- **Sidebar Drawer Theme Pill:** Single, dedicated quick-toggle pill (🌙 Dark / ☀️ Light) located directly below the Install Android App button in the sidebar navigation drawer.
- **High Contrast & Accessible Light Theme:** Refined color palettes for light mode ensuring crisp, readable text and UI components across context switchers, profile forms, 24h clock picker, and shared group controls without altering dark mode.
- **Full Cloud & Account Sync:** User theme selection is stored locally across sessions and synchronized with the user's account profile via `PUT /api/auth/profile` and `GET /api/auth/me`.
- **Automated Theme Parity Enforcement:** Pre-commit hooks (`.husky/pre-commit`) and CI (`.github/workflows/ci.yml`) enforce theme variable completeness, critical component overrides, and contrast safety via `npm run check:theme`.

### 9. Granular Notification Preferences & Dedicated Settings View
- **Per-Notification Preference Toggles:** Full user control to enable or disable individual clinical notifications:
  - 🍽️ **10-Minute Meal Time Reminder (`rem10m`)**
  - 🩸 **2-Hour Glucose Check (`rem2h`)**
  - 🎯 **3-Hour Safe Window Reminder (`rem3h`)**
  - 🌙 **Daily Basal Reminder (`basal`)**
- **Dual-Scoped Notification Preferences:** Distinct preference controls for **My Data** (personal doses) vs **Shared Data** (caregiver/viewed accounts), ensuring users only receive the specific alerts relevant to their role.
- **Dedicated Navigation Route:** Directly accessible via the sidebar drawer with dedicated 🔔 icon, URL synchronization (`/?page=notifications`), and active drawer indicator.
- **Sleek iOS-Style Segmented Control:** Pill selector switching effortlessly between `👤 My Data` and `👥 Shared Data` with descriptive status badges.
- **Tactile Interactive Cards:** 16px radius cards with smooth hover lift, individual color accents (amber, red, emerald, violet), full keyboard accessibility (<kbd>Enter</kbd> / <kbd>Space</kbd>), and distinct dimmed states when disabled.
- **UI Status Indicators & Shortcut Navigation:** If a reminder is turned off by user settings, its status is clearly marked as **"Disabled in settings"** on dashboard tiles and injection log pills. Clicking the status opens a reminder details modal featuring an instant shortcut button (**"🔔 Open Notification Settings"**) with zero nested container clutter.
- **Dual Backend Validation:** Both the local Node.js scheduler (`server/src/scheduler.js`) and the Cloudflare Pages serverless edge dispatcher (`functions/api/_telegram.js`) verify user preference flags before scheduling or delivering Telegram reminders.

### 10. Native Android App (.APK Package), PWA & Web Push Notifications
- **Native Android APK Installer:** Standalone compiled Android application package (`InsuMinder.apk`, package `com.insuminder.app`) featuring AndroidX Custom Tabs / Trusted Web Activity (TWA) with an embedded hardware-accelerated WebContainer fallback.
- **Native 1-Tap Google Sign-In:** Embedded `AndroidBridge` bridge powered by Google Play Services Auth (`com.google.android.gms:play-services-auth`), enabling seamless, one-tap native Google Sign-In directly inside the APK without external browser redirects or lost session tokens.
- **High-Density Adaptive Brand Icons:** Complete set of high-resolution density launcher icons (`mipmap-mdpi` through `mipmap-xxxhdpi`) with adaptive foreground/background layers ensuring crisp brand display on all Android launchers, task switchers, and installers.
- **Instant In-App Live Updates:** Features and improvements deploy automatically over the air inside the Android app without requiring users to download or reinstall a new APK for regular web/frontend updates.
- **Clean, Verified & Ad-Free:** Zero adware, zero telemetry trackers, and strictly minimal permissions (`INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `VIBRATE`). Verified via Digital Asset Links (`.well-known/assetlinks.json`).
- **Direct APK Download & Guided Modal:** The sidebar, mainpage bottom banner, and Settings provide direct "Download Android App (.APK)" actions that trigger `/api/download/android` and present a 3-step installation guide modal with clear Google Play Protect navigation for Android users.
- **Automated Standalone Detection:** Automatically detects when running inside the native Android APK (`InsuMinder-Android`, `?app=android`, or `display-mode: standalone`) and gracefully hides download prompts for installed users.
- **Automated CI/CD Build Pipeline:** GitHub Actions workflow (`.github/workflows/android.yml`) compiles, signs (v1/v2/v3 scheme), verifies, and publishes `InsuMinder.apk` as a release artifact on every release.
- **Encrypted Web Push Notifications:** Zero-dependency native RFC 8291 / RFC 8292 Web Push encryption using VAPID keys, delivering native real-time reminder alerts directly to Android notification trays and desktop browsers even when the app is closed.
- **Multi-Channel Dispatch:** Dispatches clinical reminders concurrently across both Telegram and Web Push according to the user's granular preferences.
- **Push Management in Notification Settings:** Full device push controls enabling instant subscription, unsubscription, status detection (Active, Not Subscribed, Blocked), and test push dispatch.

---

## 🛠️ Architecture & Tech Stack

```text
InsuMinder/
├── client/                     # Frontend Application (React 19 + Vite)
│   ├── src/
│   │   ├── components/         # Modals, Charts, Alert Cards, Context Switcher
│   │   ├── services/api.js     # Centralized API fetch layer
│   │   ├── App.jsx             # Main dashboard view & routing
│   │   ├── Profile.jsx         # User profile management view
│   │   ├── NotificationSettings.jsx # Granular notification preference controls
│   │   ├── utils.js            # Clinical calculation & timezone utilities
│   │   └── test/               # Vitest component & UX integration test suites
│   │       ├── App.test.jsx    # Dashboard, modals & clinical timer tests
│   │       ├── auth.test.jsx   # Authentication & session tests
│   │       ├── notificationSettings.test.jsx # Notification preferences test suite
│   │       ├── profile.test.jsx# Profile management tests
│   │       ├── share.test.jsx  # Caregiver & family group tests
│   │       ├── theme.test.jsx  # Dual theme consistency tests
│   │       └── utils.test.js   # Clinical calculation test suite
│   └── functions/api/          # Cloudflare Pages Functions (Frontend copy for parity)
├── functions/api/              # Cloudflare Pages Functions (Production edge backend)
│   ├── _db.js                  # Cloudflare D1 Serverless SQLite connection
│   ├── _telegram.js            # Edge Telegram dispatcher & formatting
│   ├── injections.js           # Injection recording endpoint
│   ├── logs.js                 # Scoped logs retrieval endpoint
│   ├── auth.js                 # Passwordless email verification
│   ├── user.js                 # Profile management
│   ├── share.js                # Caregiver & family group sharing
│   └── cron.js                 # Scheduled reminder background runner
├── server/                     # Local Development Backend (Node.js Express)
│   ├── src/
│   │   ├── db.js               # SQLite3 local database connector & queries
│   │   ├── routes.js           # Express API endpoints
│   │   ├── scheduler.js        # Background notification polling worker
│   │   ├── telegram.js         # Local Telegram HTTP client
│   │   └── index.js            # Server entrypoint (Port 5000)
│   └── test/                   # Node.js built-in runner integration tests
├── .github/workflows/
│   └── ci.yml                  # CI pipeline: lint, functions parity & automated tests
├── DEVELOPMENT.md              # Cloudflare Pages & D1 deployment manual
├── WORKFLOW.md                 # Agent coding standards & schema specification
└── rules.md                    # Core project governance & collaboration rules
```

---

## 💻 Local Development Setup

### Prerequisites
- Node.js 22+ (LTS) or Node.js 24 and npm installed.
- GitHub Actions workflows pinned to Ubuntu 24.04 and v5 actions for LTS stability.

### Start Development Environment
You can start both client and server in parallel with:

```powershell
# Using the preconfigured npm script:
npm run dev

# Or with PowerShell script:
.\start-dev.ps1
```

- **Frontend Client:** `http://localhost:5173`
- **Backend API:** `http://localhost:5000`
- **Database:** Local SQLite file at `server/insuminder.db`

### Running Tests
The project maintains rigorous test suites covering UI, API scoping, and background schedulers:

```powershell
# Run all tests (Server + Client):
npm test

# Run frontend tests only (Vitest):
npm --prefix client test

# Run backend integration tests only:
npm --prefix server test

# Run linting:
npm run lint
```

---

## 🔒 Code Parity Rule
To guarantee zero drift between local development and Cloudflare production, the edge function files in `functions/api/` and `client/functions/api/` must maintain **100% hash parity**. This is verified automatically via:

```powershell
git diff --no-index --exit-code functions/ client/functions/
```

