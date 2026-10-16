# InsuMinder — Agent Workflow & Code Guidelines

## Project Purpose
InsuMinder is a web application designed to track insulin injections, trigger scheduled notifications after 10 minutes (meal reminder), 2 hours, and 3 hours (glucose checks & eligibility), and provide a log of injection events.

---

## Directory Architecture

Always work strictly within the designated subdirectories:

```text
InsuMinder/
├── client/                  # Frontend application (React + Vite)
│   ├── src/
│   │   ├── components/      # UI elements (buttons, logs, alert cards)
│   │   ├── services/api.js  # Centralized API fetch calls
│   │   ├── App.jsx          # Root view & state
│   │   └── main.jsx         # DOM entry
│   ├── vite.config.js       # Configured with proxy to port 5000
│   └── package.json
├── server/                  # Backend application (Node.js + Express)
│   ├── src/
│   │   ├── db.js            # SQLite connection & queries
│   │   ├── routes.js        # Express API routes
│   │   ├── scheduler.js     # Background notification checker
│   │   └── index.js         # Express server listener
│   ├── insuminder.db        # SQLite database file
│   └── package.json
├── android/                 # Native Android App Package (Gradle + TWA / WebContainer)
│   ├── app/                 # Android application module (Manifest, MainActivity, Keystore)
│   └── gradle/              # Gradle wrapper
├── .github/workflows/
│   ├── ci.yml               # Automated test, build, lint & parity workflow
│   └── android.yml          # Android APK compilation, signing & release workflow
├── .gitignore
├── DEPLOYMENT.md            # Human deployment guide (do not edit)
└── WORKFLOW.md              # Agent coding instructions

Local Development Specs & Ports
Client: React (Vite) running on http://localhost:5173.

Server: Node.js (Express) running on http://localhost:5000.

Database: SQLite file located at server/insuminder.db.

Vite Proxy: All client requests to /api/* are proxied to http://localhost:5000.

Database Schema (SQLite & Cloudflare D1)
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_id TEXT,
    auth_provider TEXT DEFAULT 'email',
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    name TEXT,
    avatar TEXT,
    is_verified BOOLEAN DEFAULT 0,
    share_code TEXT UNIQUE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    language TEXT DEFAULT 'en',
    basal_time TEXT DEFAULT '20:00',
    theme TEXT DEFAULT 'dark',
    notification_preferences TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    consumed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS injection_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT DEFAULT 'bolus',
    injected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notify_10m_at TIMESTAMP NOT NULL,
    notify_2h_at TIMESTAMP NOT NULL,
    notify_3h_at TIMESTAMP NOT NULL,
    status_10m_sent BOOLEAN DEFAULT 0,
    status_2h_sent BOOLEAN DEFAULT 0,
    status_3h_sent BOOLEAN DEFAULT 0,
    error_10m TEXT,
    error_2h TEXT,
    error_3h TEXT
);

CREATE TABLE IF NOT EXISTS telegram_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    bot_token TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    is_default BOOLEAN DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    share_code TEXT UNIQUE NOT NULL,
    owner_user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS basal_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reminder_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    status_sent BOOLEAN DEFAULT 0,
    sent_at TIMESTAMP,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, reminder_date)
);
```

Core API Endpoints
- **Injections & Logs**:
  - `POST /api/injections`: Records injection (`type`: `'bolus'` | `'basal'`), sets 10m, 2h, and 3h reminder targets for bolus. When basal, marks `basal_reminders` as already injected if not already sent. Frontend guards early Bolus injections (<3h from prior Bolus) via gray button state and an Early Injection Confirmation Modal with Yes/No actions.
  - `GET /api/logs`: Retrieves user-scoped logs (or viewed group member logs) and today's `basalReminder` status.
- **Authentication**:
  - `POST /api/auth/send-code`: Generates 6-digit code for email.
  - `POST /api/auth/verify-code`: Verifies code, logs in, returns session user.
  - `GET /api/auth/me`: Validates session cookie or token, returns current user profile and parsed `notification_preferences`.
- **User Profile & Notification Settings**:
  - `GET /api/user/profile`: Fetches user profile.
  - `PUT /api/auth/profile`: Updates first name, last name, phone, basal time (`HH:MM`), theme (`'dark'` | `'light'`), and `notificationPreferences` JSON object.
- **Caregiver / Family Sharing**:
  - `GET /api/share/groups`: Retrieves user groups and members.
  - `POST /api/share/groups`: Creates a new group with share code `INSU-XXXXXX`.
  - `POST /api/share/join`: Joins a group using share code.
  - `DELETE /api/share/groups/:id`: Leaves or deletes group.
- **Telegram & Reminders**:
  - `GET /api/telegram-configs`: Returns user configs with default indicator and active state.
  - `POST /api/telegram-configs`: Adds new config.
  - `PUT /api/telegram-configs/:id/default`: Switches active default.
  - `PUT /api/telegram-configs/:id/toggle`: Toggles `is_active` destination state on/off.
  - `DELETE /api/telegram-configs/:id`: Deletes config.
  - `POST /api/telegram/test`: Tests bot connectivity.
  - `POST /api/dev/clear-notifications`: Clears and resets pending notification queues in injection_logs and basal_reminders (dev & testing).
  - `GET /api/cron`: Dispatches due reminders across Telegram and Web Push (automated background runner).
- **Web Push Notifications & PWA**:
  - `GET /api/push/vapid-public-key`: Returns public VAPID key.
  - `POST /api/push/subscribe`: Subscribes browser/device to Web Push.
  - `POST /api/push/unsubscribe`: Removes browser/device push subscription.
  - `POST /api/push/test`: Sends a test push alert to the current device.

---

## Granular Notification Preferences & Scoped Settings

- **Preference Structure**:
  Stored as JSON in `users.notification_preferences` with scoped boolean toggles:
  ```json
  {
    "personal": {
      "rem10m": true,
      "rem2h": true,
      "rem3h": true,
      "basal": true
    },
    "shared": {
      "rem10m": true,
      "rem2h": true,
      "rem3h": true,
      "basal": true
    }
  }
  ```
- **Scopes**:
  - `personal`: Controls notifications triggered for the user's own injections (`My Data`).
  - `shared`: Controls notifications received for injections logged by connected family members (`Shared Data`).
- **Backend Verification**:
  - `server/src/scheduler.js`: Resolves user notification preferences before dispatching 10m, 2h, 3h, or basal reminders. If disabled (`=== false`), records status as `"Disabled in notification settings."` and skips delivery.
  - `functions/api/_telegram.js`: Cloudflare Pages dispatcher verifies preferences and marks logs accordingly.
- **Frontend Presentation**:
  - `NotificationSettings.jsx`: Interactive toggle cards for both scopes with segmented pill navigation and accessible keyboard controls.
  - Disabled reminders display a neutral `"Disabled in settings"` badge in injection logs and dashboard status cards.
  - Reminder modal details provide a direct shortcut button (**"🔔 Open Notification Settings"**) for quick configuration.

Agent Coding Constraints
Relative Scope: * When instructed to write UI, only touch client/.

When instructed to write backend/database logic, only touch server/.

Never create stray files in the repository root.

API Base URL:
Always use dynamic URL resolution in client/src/services/api.js:

JavaScript
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
Dependencies:

Frontend: Use standard React and Vite tooling.

Backend: Use express, cors, and sqlite3 (or better-sqlite3).

Clean Commits:

Keep edits focused and concise.

Explain changes in 1–2 sentences before writing code.

---

## Internationalization (i18n) & Multilingual Localization

- **Source of Truth**: `client/src/i18n/translations.js` maintains dictionaries for:
  - `en`: English (Source of Truth)
  - `he`: Hebrew (Natural, medically accurate Israeli terminology; RTL layout)
  - `ru`: Russian (Natural, medically accurate Russian terminology; LTR layout)
- **Terminology Standards**:
  - Hebrew: natural Israeli diabetes terms (e.g., הזרקת אינסולין, חלון ארוחה, בדיקת סוכר, חלון בטוח).
  - Russian: natural clinical and diabetes terms (e.g., фиксация инъекции, напоминание о приёме пищи, проверка уровня сахара, безопасное окно для инъекции).
- **Parity Requirement**:
  - Every UI string, feature, dialog, notification, and card must exist across `en`, `he`, and `ru` with 100% 3-way key parity.
  - No empty or missing translations are permitted.
  - Parameter tokens (e.g. `{name}`, `{time}`, `{count}`) must match across all languages.
- **Enforcement**:
  - Pre-commit hook runs `npm run check:i18n`.
  - CI workflow runs `npm --prefix client run check:i18n` under the `lint` job.
  - Automated tests run `client/src/test/i18n.test.js`.

---

## Dual Theme (Dark & Light) Consistency & Style System Parity

- **Source of Truth**: `client/src/index.css` (tokens & CSS variables) and `client/src/App.css` (component styles & light mode polish overrides).
- **Style System Standards**:
  - Default: Modern sleek Dark mode (`:root, [data-theme="dark"]`).
  - Light mode: Modern clean Light mode (`[data-theme="light"]`) with high contrast, sharp borders, and accessible text colors.
  - No element should exhibit dark container bleed or low-contrast text (e.g. white text on light backgrounds or dark text on dark boxes).
- **Parity Requirement**:
  - All required design system CSS variables (`--bg`, `--text`, `--text-h`, `--border`, `--code-bg`, `--accent`, etc.) must be defined for both dark and light themes.
  - Critical UI components (context switchers, form inputs, clock steppers, modal dialogues, share codes) must have dedicated light theme overrides.
- **Enforcement**:
  - Pre-commit hook runs `npm run check:theme`.
  - CI workflow runs `npm --prefix client run check:theme` under the `lint` job.
  - Automated tests run `client/src/test/theme.test.jsx`.

---

## Branch Protection & Automated CI Gating

- **Branch Protection on `main`**:
  - The `main` branch is protected with required status checks:
    - `Automated Tests`
    - `JS Compilation & Build` (includes Vite build + Cloudflare Pages functions build)
    - `Lint & Parity Check` (includes ESLint, i18n translation parity, theme parity, and functions directory parity)
  - GitHub strictly locks and disables the **Merge pull request** button until all status checks pass 100% green.
  - No broken, unverified, or failing code can be merged into `main` or deployed live to production.