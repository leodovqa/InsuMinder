# Rule: Branching, Commits & Pull Request Protocol

## Branching Standards
1. **Never Work on Main Directly**:
   - All development, fixes, refactors, and feature additions must take place on dedicated branches.
2. **Branch Check Before Starting Any Task**:
   - Before doing anything at the start of a task, always check `git status` and the active branch.
   - If the current branch is already merged, propose a branch name to the user, return to `main`, run `git pull origin main`, and only create/switch to the new branch upon explicit user agreement.
3. **Branch Naming Agreement**:
   - Always propose the branch name and get explicit user agreement before creating any branch.
   - Standard prefixes:
     - `feat/<short-description>` for new capabilities or settings.
     - `fix/<short-description>` for bug fixes and UI alignments.
     - `chore/<short-description>` for infrastructure, dependencies, or workflows.

## Autonomous Commits & Pushes Strictly Prohibited
1. **Zero Autonomous Commits**:
   - Never run `git commit` autonomously.
   - Only commit when the user explicitly requests it (e.g. "ok commit", "commit", "push", "pr").
2. **Zero Autonomous Pushes**:
   - Never run `git push` autonomously.
   - Only push when explicitly requested.

## Conventional Commit Messages
- Format: `<type>(<scope>): <imperative summary>`
- Detailed bullet points are mandatory:
  - Rationale for the change.
  - Files modified or added.
  - Verification checklist and test results.

## Pull Request (PR) Protocol
1. Check whether a PR already exists: `gh pr list --head <branch>` (or API check).
2. Create PR targeting `main`: `gh pr create --base main --head <branch> --title "..." --body "..."`.
3. Output the full PR URL in chat so the user can easily review and merge.
4. **Mandatory CI Status Checks**:
   - All PRs must pass 100% green on required status checks:
     - `Automated Tests`
     - `JS Compilation & Build`
     - `Lint & Parity Check`
     - `Build & Verify Android APK`
     - `Dependency Vulnerability Audit`
   - Never advise merging a PR until all checks are completely green.

