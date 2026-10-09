# InsuMinder — Deployment & Cloud Infrastructure Guide

## Architecture Summary
* **Frontend:** Hosted globally on Cloudflare Pages (`https://insuminder.pages.dev`).
* **Production Database & API:** Cloudflare Pages Functions + Cloudflare D1 (Serverless SQLite, 100% free).
* **Local Development:** Local Node.js Express server + SQLite (`npm run dev` or `docker compose up`).

---

## 1. Cloudflare Pages Configuration

### Build Configurations
1. Open **Cloudflare Dashboard** > **Workers & Pages** > **insuminder**.
2. Go to **Settings** > **Builds & deployments** > **Build configurations**:
   * **Framework preset:** `None`
   * **Build command:** `npm run build`
   * **Build output directory:** `dist`
   * **Root directory (Advanced):** `client`
3. Click **Save**.

### 2. Cloudflare D1 Database Binding (Free Database Setup)

1. In Cloudflare Dashboard, go to **Storage & Databases** > **D1 SQL Database**.
2. Click **Create database** > name it `insuminder-db` > Click **Create**.
3. Now link it to your Pages project:
   - Go to **Workers & Pages** > **insuminder** > **Settings** > **Functions**.
   - Scroll down to **D1 database bindings** > Click **Add binding**.
   - **Variable name:** `DB` (must be uppercase `DB`).
   - **D1 database:** Select `insuminder-db`.
4. Click **Save**.

Your production API endpoints (`/api/injections` and `/api/logs`) will now run automatically on Cloudflare Pages with zero external servers!

---

## 3. Local Development (Unchanged)

Run locally with either:
* **Single Terminal:** `.\start-dev.ps1` (or `npm run dev`)
* **Docker Compose:** `.\start-docker.ps1` (or `docker compose up --build`)
