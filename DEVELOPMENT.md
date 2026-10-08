# InsuMinder — Deployment & Cloud Infrastructure Guide

## Architecture Summary
* **Frontend:** Hosted globally on Cloudflare Pages (`https://insuminder.pages.dev`).
* **Backend:** Hosted on a Node.js-compatible container host (e.g., Render, Railway, or VPS).
* **Database:** SQLite (local/single-container) or PostgreSQL (e.g., Supabase / Neon free tier for cloud).

---

## 1. Cloudflare Pages Configuration

When the `client/` React app is initialized and pushed to GitHub:

1. Open **Cloudflare Dashboard** > **Workers & Pages** > **insuminder**.
2. Go to **Settings** > **Builds & deployments** > **Build configurations**:
   * **Framework preset:** `Vite`
   * **Build command:** `npm run build`
   * **Build output directory:** `dist`
   * **Root directory (Advanced):** `client`
3. Click **Save**.

### Environment Variables on Cloudflare
1. Go to **Settings** > **Environment variables**.
2. Add a variable:
   * **Variable name:** `VITE_API_URL`
   * **Value:** `https://your-backend-service-url.com` (leave blank until backend is deployed online).
3. Click **Save**.

---

## 2. Git & Production Sync Routine

Whenever you finish a working feature locally, push it from your terminal:

```powershell
# 1. Check current status
git status

# 2. Stage all modifications
git add .

# 3. Create a clean commit
git commit -m "feat: describe the change here"

# 4. Push to GitHub (Cloudflare will automatically rebuild and redeploy)
git push origin main
```

### Recommended Free Backend Hosts
Because Cloudflare Pages only hosts static frontend files, host the Node.js server using:

- **Render.com:** Free Web Service tier (supports Node.js Express).
- **Railway.app:** Generous free trial credits for running full-stack Docker/Node containers.
