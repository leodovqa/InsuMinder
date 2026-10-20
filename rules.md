# Rules for Web-Based Application Development

## Overview
These rules outline the guidelines for developing the web-based application.

## Rules
1. **Mandatory UI Standards ([UI_STANDARDS.md](file:///d:/Github/InsuMinder/UI_STANDARDS.md))**:
   - The UI standard file (`UI_STANDARDS.md`) is the **#1 mandatory rule** when starting or doing any work on UI code (creating new components, updating, or removing elements).
   - Every element (buttons, labels, pills, badges, inputs, icon containers) must be centered both vertically and horizontally by default. If an element is side-aligned (left or right), it must ALWAYS remain centered vertically.
   - Spacing between sections and cards must ALWAYS be uniform and controlled solely by layout containers (`gap: 22px`). Ad-hoc margins on cards are strictly prohibited.
   - Icon sizes must strictly follow the standard scale (`22px` card headers, `18px` buttons/controls, `16px` pills/badges) and be perfectly centered.
   - All elements must support RTL (Hebrew) and LTR (English/Russian) bidirectional design with logical properties and mirrored alignment.
   - Reused element families (such as notification scheduled status badges: Sent, Not Sent, Disabled in settings, Upcoming) must share identical pill styling, padding, font metrics, and `white-space: nowrap`.
   - Zero guesswork: never assume a visual deviation. If you think of an improvement, you must ask and receive explicit user approval first.
2. **Clarification**: If you are unsure about something, you must say it before doing anything.
3. **Error Reporting**: If there was a mistake, error, or something you couldn't test, you must report it. Explain what couldn't happen and why.
4. **Explain Decisions**: When you make a decision, explain why you did it and how. Avoid overcomplicating things when not needed. If you are unsure, ask before proceeding.
5. **Research**: When researching, provide the source of your data and avoid making assumptions. Always use real data from the code.

## Communication Rules
1. Use English for all communications.
2. To suggest changes to a file, return the entire content of the updated file.
3. Use the specified file listing format.
4. Never skip, omit, or elide content from a file listing.
5. **Branching and Collaboration**:
   - Start working with branches and stop working on main directly.
   - Before doing ANYTHING at the start of a task, always check Git status and the current branch. If the current branch is already merged, ask to change with a branch name suggestion, move to main, ensure main is updated (`git pull origin main`), and only then create and move to the new agreed branch.
   - Before creating a branch, ask for a branch naming and get my agreement.
   - Only create a branch if I agree.
   - Before committing or pushing, ask me to commit or push.
   - When asked to create a pull request (PR), you must output the full URL to the PR so the user can easily review and merge it.
   - Branch protection is strictly enforced on `main`. All PRs must pass mandatory CI status checks (`Automated Tests`, `JS Compilation & Build`, `Lint & Parity Check`) before they can be merged. Never merge a PR before all CI status checks are 100% green.
6. **Documentation Pre-Commit Rule**:
   - Before committing or pushing changes (at the pre-commit stage), always check if there is an update, change, or new feature.
   - If a new feature, capability, or logic change is introduced, verify and update the human-readable markdown documentation (`README.md` / `WORKFLOW.md`) so that human readers and developers always have an accurate, up-to-date guide.
   - If changes are purely minor refactors or bugfixes that do not alter capabilities, updating may be skipped when not needed.
7. **Multilingual (Hebrew & Russian) Localization & UI Parity Rule**:
   - Every user-facing UI feature, dialog, card, notification, label, or text element in the application must have a corresponding, natural, and logical translation in `client/src/i18n/translations.js` for both Hebrew (`he`) and Russian (`ru`).
   - Any time new features or UI texts are created or updated, translations must be created or updated simultaneously with 100% key parity across all supported languages.
   - Parity is strictly enforced by the pre-commit hook (`.husky/pre-commit`) and in CI (`.github/workflows/ci.yml`) via `npm --prefix client run check:i18n`. Commits or PRs with missing keys, placeholder mismatches, or empty translations will fail.
8. **Dual Theme (Dark & Light) & Visual Styling Parity Rule**:
   - Every user-facing UI feature, card, modal, dialog, form input, button, and navigation element must work and look polished across both visual themes: modern sleek Dark mode and modern clean Light mode.
   - All elements must adhere to the application's color and design system (`client/src/index.css` and `client/src/App.css`), maintaining high contrast, clear readability, and proper type aesthetics. Dark-specific hardcoded backgrounds or white texts must never leak unreadable contrast into Light mode, and Dark mode must remain completely unbroken.
   - Parity is strictly enforced by the pre-commit hook (`.husky/pre-commit`) and in CI (`.github/workflows/ci.yml`) via `npm --prefix client run check:theme`. Commits or PRs with missing theme variable definitions, broken contrast rules, or unstyled light-mode elements will fail.
9. **Unified Application Versioning & Parity Rule**:
   - Every single branch, PR, or release MUST bump the application version compared to `main` and increment `versionCode` (strictly enforced by `scripts/check-version.js` in pre-commit and CI).
   - Version bumps follow Semantic Versioning (`MAJOR.MINOR.PATCH`):
     - **MAJOR (`X.0.0`)**: Breaking architectural changes, completely overhauled database schema/API contracts, or fundamental workflow rewrites.
     - **MINOR (`x.Y.0`)**: New features, capabilities, or major settings (e.g. adding master telegram toggle, manual injection logging, caregiver shared access).
     - **PATCH (`x.y.Z`)**: Bug fixes, regression remedies, UI styling/alignment adjustments, translation polish, or performance refactors.
     - **`versionCode`**: Always increment by +1 (integer: 1, 2, 3, 4, 5, ...).
   - Whenever an update or fix is prepared, the version must be synchronized with 100% parity across all 9 project manifests, configurations, and API endpoints:
     - `android/app/build.gradle` (`versionName` and incremented `versionCode`)
     - `client/public/version.json` (`version`, `versionCode`, and `versionHistory`)
     - Root `package.json`, `client/package.json`, and `server/package.json`
     - `client/src/pwa.js` (`ANDROID_PACKAGE_INFO.version` and `APP_CURRENT_CHANGELOG`)
     - `functions/api/download/android.js` and `client/functions/api/download/android.js` (`version`)
     - `server/src/index.js` (`version`)
   - Never release with mismatched, stale, or unbumped version strings across files.
   - Version parity and bump enforcement are strictly checked by the pre-commit hook (`.husky/pre-commit`) and in CI (`.github/workflows/ci.yml`) via `npm run check:version` (`node scripts/check-version.js`). Commits or PRs without a bumped version will fail.
10. **State Preservation & Localization Decoupling Rule**:
    - Changing the interface language / localization MUST NEVER alter, reset, branch, reload, or discard any user configuration, active session state, or displayed data.
    - Switching language must strictly and exclusively swap the localized UI dictionary and text direction (`ltr`/`rtl`).
    - The active data context (`personal` vs `shared`), selected caregiver group, notification preferences, telegram configs, input states, and reminder cards must remain 100% identical before and after switching languages.
    - Always verify this state preservation before committing any changes to settings, profile handling, or user persistence.
11. **Universal Modal Scroll Locking & Touch Containment Rule**:
    - Under NO circumstances may the background application page be allowed to scroll underneath ANY active modal, popover, sheet, or drawer.
    - Whenever creating, updating, changing, or fixing ANY modal in the application, developers and agents MUST bind the reference-counted `useLockBodyScroll` hook (`client/src/useLockBodyScroll.js`) and ensure modal cards contain all touch and scroll gestures (`overscroll-behavior: contain !important; touch-action: pan-y;`) in strict adherence to Section 7 of [UI_STANDARDS.md](file:///d:/Github/InsuMinder/UI_STANDARDS.md).
12. **Central Project Memory & "Save for Later" Single Source of Truth Rule**:
    - Whenever the user mentions "write to memory", "remember this", "save for later", "write as next task", or anything related to persisting project context, tasks, bugs, or future plans, you MUST always record, write to, and update [MEMORY.md](file:///d:/Github/InsuMinder/MEMORY.md) in the repository root.
    - Local agent memory and machine-specific scratchpad/artifact directories do not travel across different PCs or developer workstations. [MEMORY.md](file:///d:/Github/InsuMinder/MEMORY.md) is the authoritative, shared single source of truth across all devices and developer setups.
13. **Zero Hardcoded Secrets & Credentials Rule**:
    - Under NO circumstances may any real, default, fallback, or mock API keys, private keys (such as VAPID keys), auth secrets, webhook secrets, database credentials, or tokens ever be hardcoded into tracked files in this repository.
    - All secrets, private keys, and runtime credentials MUST be loaded strictly through environment variables (e.g., context.env in Cloudflare Pages Functions or process.env in Node.js).
    - If environment variables are not configured in a deployment or local runtime, the application code must degrade safely and return a clear, descriptive configuration error (e.g., 'VAPID keys not configured') rather than falling back to hardcoded secrets.
    - Automated tests that require cryptographic keypairs (e.g. VAPID / ECDSA prime256v1 JWT signing) MUST generate ephemeral in-memory keys on the fly during test setup (crypto.createECDH('prime256v1')) and never store static keys in test code or mock fixtures.
    - Always verify before committing that no keys, tokens, or credential strings have been introduced into source files, markdown docs, or configuration files.
