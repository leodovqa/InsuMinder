# InsuMinder — Agent Workflow & Code Guidelines

## Project Purpose
InsuMinder is a web application designed to track insulin injections, trigger scheduled notifications after 2 hours and 3 hours, and provide a 24-hour log of injection events.

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

Database Schema (SQLite)
SQL
CREATE TABLE IF NOT EXISTS injection_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    injected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notify_2h_at TIMESTAMP NOT NULL,
    notify_3h_at TIMESTAMP NOT NULL,
    status_2h_sent BOOLEAN DEFAULT 0,
    status_3h_sent BOOLEAN DEFAULT 0
);
Core API Endpoints
POST /api/injections

Computes: notify_2h_at = now + 2 hours, notify_3h_at = now + 3 hours.

Inserts row into injection_logs.

Returns: { success: true, id: <inserted_id> }.

GET /api/logs

Query: Returns all records where injected_at >= datetime('now', '-24 hours') ordered by injected_at DESC.

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