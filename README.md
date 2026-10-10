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
- **One-Click Injection Logging:** Instant logging button with safety confirmation dialog and floating toast feedback.
- **Live Real-Time Clock:** Continuous 24-hour clock synced to local Jerusalem time (`Asia/Jerusalem`).
- **Dynamic State Cards:** Real-time countdowns for 10-minute meal window, 2-hour check, and 3-hour eligibility status.
- **Daily Metrics:** Real-time summary tiles showing today's injection count and the exact time of the last dose.

### 2. Passwordless Authentication & Profile Management
- **Magic Code Authentication:** Passwordless login and registration via 6-digit email verification codes (10-minute expiry).
- **User Scoping:** All injection logs, configurations, and groups are strictly scoped to the authenticated user.
- **User Profile:** Dedicated Profile management screen allowing users to update their First Name, Last Name, and Phone number with input validation (letters-only for names).
- **Drawer Navigation:** Displays the user's full name, email, and quick access navigation.

### 3. Caregiver & Family Shared Access (Groups)
- **Shared Access System:** Patients and caregivers can share tracking data seamlessly.
- **Group Creation & Share Codes:** Generate distinct share codes (`INSU-XXXXXX`) to invite family members or caregivers.
- **Home Context Switcher:** Switch between personal logs and viewing shared family member doses directly from the home dashboard.
- **Group Management:** View group members, copy invitation codes, and leave or manage groups.

### 4. Injection Logs & Weekly Israeli Calendar Analytics
- **Slide-Out Drawer:** Clean left-sided drawer housing the complete logs view.
- **Israeli Calendar Weekly Chart (Sunday–Saturday):** Visual bar chart grouped by week from Sunday through Saturday with previous/next week navigation.
- **Per-Dose Delivery Pills:** Each log entry displays pills for 10m, 2h, and 3h reminder statuses (`Sent`, `Pending`, or `Not Sent` with delivery error diagnostics tooltip).
- **Direct URL Deep Linking:** Direct navigation via query parameters (e.g. `/?page=logs`, `/?page=settings`, `/?page=profile`).

### 5. Multi-Destination Telegram Reminders
- **Multi-Bot Configuration:** Save multiple Telegram bot tokens and chat IDs with custom names (e.g., "Personal Bot", "Family Channel").
- **Default Selector:** Toggle which configuration is active with instant default switching.
- **Auto-Formatting Web K Channel IDs:** Automatically converts `-4304245048` format to `-1004304245048` supergroup/channel format.
- **Test Notification Tool:** Built-in test dispatcher with live error reporting.
- **Rich Message Templates:** Messages feature emoji icons (`🍽️`, `🩸`, `🎯`), explicit injection timestamps (`💉 Dose logged at: 14:31`), and environment tagging (`From InsuMinder (Local):` vs production `From InsuMinder:`).
- **Stale Reminder Expiration Guards:** Automatically discards overdue reminders (>45m for meal, >2h for 2h check, >3h for 3h window) to eliminate notification spam when servers wake up or restart.

### 6. Automated Background Delivery & Cloud Cron
- **Production Serverless Architecture:** Hosted on Cloudflare Pages Functions with zero cold-start costs.
- **Automated Cron Trigger:** Scheduled GitHub Actions workflow ([`.github/workflows/cron.yml`](.github/workflows/cron.yml)) pings the `/api/cron` endpoint every 5 minutes 24/7.
- **Automated Run Cleanup:** Scheduled workflow ([`.github/workflows/cleanup-runs.yml`](.github/workflows/cleanup-runs.yml)) runs every 6 hours (4 times daily) to purge accumulated cron logs and keep the GitHub Actions tab clean.

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
│   │   ├── utils.js            # Clinical calculation & timezone utilities
│   │   └── test/               # Vitest component & UX integration test suites
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
│   ├── cron.yml                # 5-minute production cron trigger
│   └── cleanup-runs.yml        # 6-hour automated run history cleanup
├── DEVELOPMENT.md              # Cloudflare Pages & D1 deployment manual
├── WORKFLOW.md                 # Agent coding standards & schema specification
└── rules.md                    # Core project governance & collaboration rules
```

---

## 💻 Local Development Setup

### Prerequisites
- Node.js 20+ and npm installed.

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

