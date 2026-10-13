# Rules for Web-Based Application Development

## Overview
These rules outline the guidelines for developing the web-based application.

## Rules
1. **Clarification**: If you are unsure about something, you must say it before doing anything.
2. **Error Reporting**: If there was a mistake, error, or something you couldn't test, you must report it. Explain what couldn't happen and why.
3. **Explain Decisions**: When you make a decision, explain why you did it and how. Avoid overcomplicating things when no needed. If you are unsure, ask before proceeding.
4. **Research**: When researching, provide the source of your data and avoid making assumptions. Always use real data from the code.

## Communication Rules
1. Use English for all communications.
2. To suggest changes to a file, return the entire content of the updated file.
3. Use the specified file listing format.
4. Never skip, omit, or elide content from a file listing.
5. **Branching and Collaboration**:
   - Start working with branches and stop working on main directly.
   - Before creating a branch, ask for a branch naming and get my agreement.
   - Only create a branch if I agree.
   - Before committing or pushing, ask me to commit or push.
   - When asked to create a pull request (PR), you must output the full URL to the PR so the user can easily review and merge it.
6. **Documentation Pre-Commit Rule**:
   - Before committing or pushing changes (at the pre-commit stage), always check if there is an update, change, or new feature.
   - If a new feature, capability, or logic change is introduced, verify and update the human-readable markdown documentation (`README.md` / `WORKFLOW.md`) so that human readers and developers always have an accurate, up-to-date guide.
   - If changes are purely minor refactors or bugfixes that do not alter capabilities, updating may be skipped when not needed.
7. **Multilingual (Hebrew & Russian) Localization & UI Parity Rule**:
   - Every user-facing UI feature, dialog, card, notification, label, or text element in the application must have a corresponding, natural, and logical translation in `client/src/i18n/translations.js` for both Hebrew (`he`) and Russian (`ru`).
   - Any time new features or UI texts are created or updated, translations must be created or updated simultaneously with 100% key parity across all supported languages.
   - Parity is strictly enforced by the pre-commit hook (`.husky/pre-commit`) and in CI (`.github/workflows/ci.yml`) via `npm --prefix client run check:i18n`. Commits or PRs with missing keys, placeholder mismatches, or empty translations will fail.

