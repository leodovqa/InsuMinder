# InsuMinder — Development & Deployment Architecture

## 1. System Overview

InsuMinder uses a decoupled architecture separating the client-side user interface from the backend persistence layer.

* **Frontend (Client):** React built with Vite.
  * **Local:** Runs on `http://localhost:5173` via Vite Dev Server.
  * **Production:** Deployed automatically on **Cloudflare Pages** (`https://insuminder.pages.dev`).
* **Backend (API & Scheduler):** Node.js with Express.
  * **Local:** Runs on `http://localhost:5000`.
  * **Database (Local):** SQLite (`insuminder.db`) stored directly in the project directory.
* **Agent Integration:** Aider with local LLM (`qwen2.5-coder:7b`) managing code generation, refactoring, and atomic Git commits.

---

## 2. Project Directory Structure

