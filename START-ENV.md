# Environment Startup Instructions

## Quickest Option: 1 Terminal Dev (Instant — No Docker Required)

Run both the Backend API and Frontend Client simultaneously in a single terminal:

```powershell
.\start-dev.ps1
```
*(or run `npm run dev` from the root directory)*

* **Frontend Client:** `http://localhost:5173`
* **Backend API:** `http://localhost:5000`
* **Features:** Color-coded logs (`[server]` in blue, `[client]` in green), instant hot reloading, and pressing `Ctrl + C` stops both processes cleanly.

---

## Option 2: Docker Compose (1 Command Containerized)

Once Docker Desktop is installed and running:

```powershell
.\start-docker.ps1
```
*(or run `docker compose up --build`)*

* **Frontend Client:** `http://localhost:5173`
* **Backend API:** `http://localhost:5000`
* **Database:** Isolated inside named Docker volume (`insuminder-db-data`).
* **Reset Database (Fresh Start):** `docker compose down -v`.

---

## Option 3: Separate Local Terminals

### Terminal 1: Backend API
From the root directory:
```powershell
node server/src/index.js
```
* **URL:** `http://localhost:5000`
* **Database:** SQLite file at `server/insuminder.db`

### Terminal 2: Frontend Client
From the `client` directory:
```powershell
cd client
npm run dev
```
* **URL:** `http://localhost:5173`
* **Proxy:** Requests to `/api/*` are forwarded automatically to `http://localhost:5000`