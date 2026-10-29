# Rule: State & Configuration Decoupling from Localization

## 1. Zero State Reset on Language Change (Rule 10)
Changing the interface language or localization MUST NEVER alter, reset, branch, reload, or discard any user configuration, active session state, or displayed data.

---

## 2. Decoupling Guarantees
When a user switches languages (English $\leftrightarrow$ Hebrew $\leftrightarrow$ Russian), the application must simply swap the translated presentation text while strictly preserving:

1. **Active Data Context**:
   - Whether the user is viewing "My Data" or "Shared Data", the active view and owner ID must remain strictly unchanged.
2. **Active Settings & Toggles**:
   - Notification preferences, Telegram master toggle, Web Push subscription status, and scheduled alarm times must remain identical.
3. **Form & View State**:
   - The current active navigation tab, draft inputs, or open dialog modals must stay in place without unexpected closing or clearing.
4. **Network Cache & Authentication**:
   - Switching language must never trigger unnecessary user profile re-fetches, auth token invalidations, or reload loops.

---

## 3. Architecture Principle: Language is Pure Presentation
- Localization is strictly a presentation-layer string mapping (`t(key)`).
- The application must **NEVER** save, query, or branch user settings per-language (e.g. storing one config for `en` and another for `he`).
- There is always exactly ONE unified user configuration state per user account.

