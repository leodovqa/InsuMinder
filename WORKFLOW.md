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
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    name TEXT,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
```

Core API Endpoints
- **Injections & Logs**:
  - `POST /api/injections`: Records injection, sets 10m, 2h, and 3h reminder targets.
  - `GET /api/logs`: Retrieves user-scoped logs (or viewed group member logs).
- **Authentication**:
  - `POST /api/auth/send-code`: Generates 6-digit code for email.
  - `POST /api/auth/verify-code`: Verifies code, logs in, returns session user.
- **User Profile**:
  - `GET /api/user/profile`: Fetches user profile.
  - `PUT /api/user/profile`: Updates first name, last name, phone.
- **Caregiver / Family Sharing**:
  - `GET /api/share/groups`: Retrieves user groups and members.
  - `POST /api/share/groups`: Creates a new group with share code `INSU-XXXXXX`.
  - `POST /api/share/join`: Joins a group using share code.
  - `DELETE /api/share/groups/:id`: Leaves or deletes group.
- **Telegram & Reminders**:
  - `GET /api/telegram-configs`: Returns user configs with default indicator.
  - `POST /api/telegram-configs`: Adds new config.
  - `POST /api/telegram-configs/default`: Switches active default.
  - `DELETE /api/telegram-configs/:id`: Deletes config.
  - `POST /api/telegram/test`: Tests bot connectivity.
  - `GET /api/cron`: Dispatches due reminders (automated background runner).

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