# InsuMinder - Agent Operating Guide

Welcome to InsuMinder. This document serves as the top-level operating guide and navigation index for AI agents and contributors working in this codebase.

---

## 1. Project Overview & Architecture Stack

InsuMinder is an insulin reminder, injection logging, and adherence tracking application supporting both PWA and native Android packaging.

- **Frontend**: React 19, Vite 8, pure CSS design system (Dark & Light themes), i18n (EN, HE, RU).
- **Backend**: Node.js (v22 LTS compatible), Express, SQLite / in-memory DB, Web Push, Telegram Bot integration.
- **Serverless / Cloudflare**: Cloudflare Pages Functions (`functions/` mirrored identically in `client/functions/`).
- **Mobile Packaging**: Android WebView Wrapper / Capacitor (`android/app/build.gradle`).
- **CI / CD**: GitHub Actions (`.github/workflows/ci.yml`, `.github/workflows/security.yml`).

---

## 2. Core Workspace Rules (`.agents/rules/`)

Strict engineering standards are modularized into topic-specific rules under [`.agents/rules/`](file:///.agents/rules/):

| Rule File | Topic & Scope |
| :--- | :--- |
| [`01-branching-and-pr.md`](file:///.agents/rules/01-branching-and-pr.md) | Branching protocol, conventional commits, zero autonomous push/commit, PR gating. |
| [`02-ui-standards.md`](file:///.agents/rules/02-ui-standards.md) | Centering standards, `--section-gap: 20px`, SVG bounding boxes, modal scroll locking. |
| [`03-version-sync.md`](file:///.agents/rules/03-version-sync.md) | Zero-tolerance versioning, mandatory 9-file synchronization, semver increment. |
| [`04-zero-secrets.md`](file:///.agents/rules/04-zero-secrets.md) | Absolute zero hardcoded credentials, dynamic VAPID generation, ephemeral testing keys. |
| [`05-functions-zero-diff.md`](file:///.agents/rules/05-functions-zero-diff.md) | Cloudflare Pages functions zero-diff parity (`functions/` $\leftrightarrow$ `client/functions/`). |
| [`06-i18n-and-theme-parity.md`](file:///.agents/rules/06-i18n-and-theme-parity.md) | 100% 3-way translation parity (EN, HE, RU) and dual theme parity (Dark & Light). |
| [`07-state-preservation.md`](file:///.agents/rules/07-state-preservation.md) | Language as pure presentation; zero state reset on language change. |

---

## 3. Modular Agent Skills (`.agents/skills/`)

Repeatable operational runbooks are encapsulated into self-contained skills under [`.agents/skills/`](file:///.agents/skills/):

- **[`release-version`](file:///.agents/skills/release-version/SKILL.md)**: Runbook for version bumping across all 9 manifest files, updating unit test assertions, building the Android APK, and verifying zero-tolerance versioning.
- **[`security-audit`](file:///.agents/skills/security-audit/SKILL.md)**: Runbook for scanning repository secret leaks, executing high/critical CVE dependency audits, and safely patching lockfiles.

---

## 4. Key Verification & Development Commands

```bash
# Start full-stack local development (backend + frontend)
npm run dev

# Run unit and integration tests (backend + frontend)
npm test

# Verification checks (must all pass before proposing a PR)
npm run tokens           # AI context window & token telemetry (or .\tokens in PowerShell)
npm run check:secrets    # Rule 13: zero credentials scan
npm run check:audit      # Standalone dependency vulnerability check
npm run check:version    # Rule 9: 9-file version sync & semver bump check
npm run check:i18n       # Rule 7: 3-way translation parity check
npm run check:theme      # Rule 8: dark/light theme CSS variable parity check
git diff --no-index functions client/functions  # Rule 1: Cloudflare zero-diff
```

---

## 5. Dynamic Project State & Memory

For active backlog items, architectural decisions, and chronological release milestone logs, refer to:
- [`MEMORY.md`](file:///MEMORY.md) — Single persistent source of truth for project memory.

