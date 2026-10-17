# InsuMinder UI/UX Design & Architecture Standards

> **MANDATORY RULE #1 FOR ALL FRONTEND CODE**:
> Before writing, modifying, refactoring, or deleting any UI component, CSS class, or visual layout in this repository, you MUST strictly adhere to the standards outlined in this document. Zero guesswork, zero arbitrary styling.

---

## 1. Centering & Alignment Standards (Non-Negotiable)

### 1.1 Vertical Centering is Universal
- **EVERY UI element** (buttons, labels, badges, pills, inputs, icon containers, list items, card rows) **MUST ALWAYS be centered vertically** (`align-items: center`).
- Never rely on default baseline or `flex-start` alignment for interactive or row-based elements unless explicitly displaying multi-line prose paragraphs.
- When an icon is paired with text, both must be vertically centered with a clean, consistent gap (typically `6px`–`10px`).

### 1.2 Horizontal Centering by Default
- Buttons, badge pills, status pills, floating action buttons, and standalone icon wrappers must be centered **both horizontally and vertically** (`justify-content: center` + `align-items: center` / `display: inline-flex`).
- If an element is explicitly required to be left-aligned (LTR) or right-aligned (RTL) — such as card titles, form labels, or list descriptions — horizontal alignment may be `flex-start` or `text-align: start`, but it **MUST STILL BE CENTERED VERTICALLY** (`align-items: center`).

---

## 2. Section & Card Spacing Consistency (Unified Application Spacing)

### 2.1 Unified Container-Controlled Spacing (Zero Ad-Hoc Margins)
- **Single Identical Spacing Mechanism Across All Pages**: The spacing between cards, sections, banners, and action buttons must **ALWAYS be 100% identical and uniform** across every single view in the entire application.
- All primary page layout containers:
  - `.home-container` (Home tab)
  - `.page-content-wrapper` (Injection Logs tab)
  - `.settings-container` (Settings tab)
  - `.profile-container` (Profile tab)
  - `.notification-settings-container` (Notifications tab)
  MUST strictly manage child separation through the standardized design variable:
  ```css
  :root,
  [data-theme="dark"],
  [data-theme="light"] {
    --section-gap: 20px;
  }

  .home-container,
  .page-content-wrapper,
  .settings-container,
  .profile-container,
  .notification-settings-container {
    display: flex;
    flex-direction: column;
    gap: var(--section-gap, 20px); /* Universal 20px section gap across all pages */
  }
  ```

### 2.2 Strict Prohibition of Ad-Hoc Margins
- **NEVER apply physical top or bottom margins** (`margin-top` / `margin-bottom`) directly to child cards, sections, banners, or action triggers (e.g. `.trends-chart-card`, `.manual-add-action-bar`, `.rapid-trend-card`, `.daily-logs-section`, `.home-pwa-banner`, `.settings-card`).
- Stacking margins on top of container gaps causes irregular, disjointed spacing between sections.
- Consecutive elements (e.g. Weekly Chart $\rightarrow$ Manual Injection Action Button $\rightarrow$ Rapid Trend Card $\rightarrow$ Today's Injections list) must all have the **exact same vertical separation** (`20px`), guaranteed solely by the parent container's `gap`.

---

## 3. Icon Sizing, Proportions & Enclosures

### 3.1 Standardized Icon Sizing Scale
Icons must conform to a predictable visual hierarchy:
| Component Type | Icon Dimensions | Wrapper Dimensions | Reference Component |
| :--- | :--- | :--- | :--- |
| **Card / Section Headers** | `22px × 22px` SVG | `42px × 42px` rounded box | `.card-icon-wrapper` (Basal, Telegram, Shared Access) |
| **Buttons, Inputs & Controls** | `18px × 18px` SVG / font | `32px × 32px` or inline | TimePicker clock trigger, Delete trash icon, Scope pills |
| **Pills & Scope Badges** | `16px` font / SVG | Inline flex (`gap: 8px`) | "My Data" (`.context-switch-btn`, `.scope-pill-btn`) |
| **Small Status Badges / Chevrons** | `14px` SVG | Inline flex | Clock dropdown chevron, small indicators |

### 3.2 Icon Centering
- All icon wrappers must employ `display: inline-flex; align-items: center; justify-content: center;`.
- Avoid hardcoded top offsets (`margin-top: 2px` or `top: 1px`). Use flexbox centering to achieve pixel-perfect alignment across all platforms and operating systems.

### 3.3 Vector SVG Mandatory for Paired / Segmented Controls (No Raw Emojis)
- **STRICT PROHIBITION**: Never use raw OS system emojis (e.g., `👤` vs `👥`) for paired navigation pills, segmented switches, or control buttons.
- OS emoji fonts (Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji) render glyphs with drastically different bounding boxes (e.g. `👤` renders as a tall, heavy single figure, while `👥` renders as two shorter silhouettes), creating perceived size and height discrepancies.
- Paired interactive elements must **always** use crisp vector SVGs with identical bounding box dimensions (`18px × 18px`), matching stroke width (`2`), and flex centering for 100% mathematical and visual size parity on all devices.

---

## 4. RTL (Right-to-Left) & LTR Bidirectional Design

### 4.1 Symmetry Across Languages
- The interface supports Hebrew (`he` - RTL), English (`en` - LTR), and Russian (`ru` - LTR).
- When displayed in RTL, every element must logically and naturally mirror:
  - Leading icons start on the **right**.
  - Text flows right-to-left.
  - Trailing switches, status badges, and delete actions align symmetrically on the **left**.
- **Use CSS Logical Properties** instead of physical directionals:
  - Use `margin-inline-start` / `margin-inline-end` instead of `margin-left` / `margin-right`.
  - Use `padding-inline-start` / `padding-inline-end` instead of `padding-left` / `padding-right`.
  - Use `inset-inline-start` / `inset-inline-end` instead of `left` / `right`.
  - Use `text-align: start` instead of `text-align: left`.

### 4.2 State & Configuration Decoupling from Localization (Strict Standard)
- **Zero State Reset on Language Change**: Changing the interface language or localization MUST NEVER alter, reset, branch, reload, or discard any user configuration, active session state, or displayed data.
- **Identical State Across All Languages**: When a user switches languages (English, Hebrew, Russian), the app must simply swap the translated text strings while preserving:
  1. **Active Data Context**: Whether the user is viewing "My Data" or "Shared Data", the active view and owner ID must remain strictly unchanged.
  2. **Active Settings & Toggles**: Notification preferences, Telegram master toggle, push states, and schedule times must remain identical.
  3. **Form & View State**: Current page tab, draft inputs, or opened modals must stay in place.
- **Language as Pure Presentation**: Localization is strictly a presentation-layer translation dictionary. The application must **NEVER** query, restore, or branch settings based on "what was previously saved under this language". There is always only ONE unified user configuration state.

---

## 5. Visual Parity on Reused Elements (Badges, Statuses, Pills)

### 5.1 Status Badge Uniformity (e.g., Notifications Scheduled)
When displaying status indicators belonging to the same element family (such as "Sent", "Not Sent", "Disabled", "Scheduled / Upcoming"):
- **Identical Box Model**: Every badge variant must share the exact same structural container:
  ```css
  .reminder-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    padding: 3px 9px;
    border-radius: 9999px;
    white-space: nowrap; /* Never allow awkward multi-line wrapping */
    box-sizing: border-box;
  }
  ```
- **Preserve Component Enclosures**: When a badge is also an interactive `<button>` (e.g. `.reminder-badge-btn`), button reset styles must **never** strip the badge's background pill color or border (`background: none; border: none;` is strictly prohibited on badges).
- **Color Coding Consistency**:
  - `Sent`: Positive green background pill & green border.
  - `Not Sent` / `Failed`: Alert red background pill & red border.
  - `Disabled`: Muted slate/gray background pill & subtle border.
  - `Upcoming` / `Scheduled`: Accent blue/cyan background pill & cyan border.

---

## 6. Anti-Clipping, Overflow Prevention & Label Restraint (Non-Negotiable)

### 6.1 Zero-Cutoff & Zero-Overlap Guarantee
- **NEVER** allow text, labels, badges, or controls to go under, on top of, overlap, or be clipped / cut off by card boundaries or peer elements on any viewport.
- If an element’s localized text could cause clipping, awkward wrapping, or horizontal overflow (such as long compound words in Russian or German):
  1. **Shorten / Rename the label** to a standard, concise status keyword (e.g., `"Отключено"` / `"Disabled"` instead of `"Отключено в настройках"` / `"Disabled in settings"`).
  2. Reserve full prose and detailed descriptions for modal dialogs, subtitles, or tooltips.
  3. Ensure container title rows use `min-width: 0;` and flex distribution so badges always have sufficient space without being clipped.

### 6.2 Edge Clearance & Breathing Room (No Boundary Crowding)
- **Mandatory Border Clearance**: Text, labels, and icons inside buttons, pills, cards, or containers must **NEVER press against or crowd the container's outer border**.
- **Adequate Horizontal Padding**: All clickable buttons and pill containers must maintain a minimum horizontal inset of `14px`–`16px` (`padding-inline: 14px;` or `padding: 10px 14px;`), guaranteeing generous breathing room on both leading and trailing edges across all screen sizes.
- **Start-Aligned List Buttons**: For stacked list items or full-width reminder buttons (e.g., expanded injection log reminder pills):
  - Alignment must be start-aligned (`justify-content: flex-start` / `text-align: start`) with vertical centering (`align-items: center`).
  - In RTL languages (Hebrew), text and icons automatically mirror and align to the right (`start`), while in LTR languages (English, Russian) they align to the left (`start`).
  - Leading icons and text must use a clean `gap: 10px`, and trailing text must never bleed into the container border.

---

## 7. Universal Modal Background Scroll Locking & Touch Containment (Mandatory Standard)

### 7.1 Strict Prohibition of Background / Underneath Scrolling
- **WE NEVER ALLOW THE APP TO SCROLL "UNDER" ANY MODAL**:
  - Whenever ANY modal, dialog, sheet, popover, or drawer is open (never mind what the modal is: injection logging, confirmation, settings, time/date picker, auth, update banner, or celebration dialog), background scrolling on `document.body` and `document.documentElement` **MUST BE STRICTLY AND UNCONDITIONALLY PREVENTED**.
  - Swiping, dragging, or mouse-wheel scrolling when a modal is active must NEVER scroll the background page underneath.
  - Background scrolling is disorienting, breaks gesture boundaries, and ruins mobile touch interaction.

### 7.2 Mandatory Standard Implementation (useLockBodyScroll & CSS Containment)
- **Mandatory Reference-Counted Hook**:
  - Every modal component must invoke the standardized, reference-counted `useLockBodyScroll` hook from `client/src/useLockBodyScroll.js`:
    ```javascript
    import { useLockBodyScroll } from './useLockBodyScroll';

    export function MyCustomModal({ isOpen, onClose }) {
      useLockBodyScroll(Boolean(isOpen));
      if (!isOpen) return null;
      // ...
    }
    ```
  - Reference counting (`activeLockCount`) ensures that nested modals, multi-step dialogs, or closing one modal while another is open never prematurely unfreezes background scroll.
- **Global CSS Locking (`body.modal-open, html.modal-open`)**:
  - Automatically applied whenever at least one modal is active:
    ```css
    body.modal-open,
    html.modal-open {
      overflow: hidden !important;
      touch-action: none;
      overscroll-behavior: contain !important;
    }
    ```
- **Internal Modal Touch & Overscroll Containment**:
  - The modal card container (`.modal-card`) must strictly contain all internal touch and scroll gestures:
    ```css
    .modal-overlay {
      position: fixed;
      inset: 0;
      touch-action: pan-y;
      overscroll-behavior: contain !important;
    }

    .modal-card {
      touch-action: pan-y;
      overscroll-behavior: contain !important;
      max-height: calc(100vh - 40px);
      max-height: calc(100dvh - 40px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    ```

### 7.3 Non-Negotiable Protocol for Future Work
- For **ANY** modal that is created, updated, changed, or fixed in the future:
  1. The component **must** bind `useLockBodyScroll` or be included in the top-level `isAnyAppModalOpen` registry.
  2. The modal overlay and card **must** include `overscroll-behavior: contain !important; touch-action: pan-y;`.
  3. Developers and agents **must test and verify** on both mobile and desktop viewports that the background page cannot be scrolled while the modal is open, and that scrolling inside the modal card works smoothly.

---

## 8. Strict 24-Hour Time & DD/MM/YYYY Date Standards

### 8.1 Universal 24-Hour Time Mandate (Zero AM/PM)
- **WE USE ONLY 24-HOUR TIME WITHOUT ANY AM/PM THROUGHOUT THE ENTIRE APPLICATION**.
- Under no circumstances may any component, view, modal, table, badge, chart, log, notification, or tooltip display "AM", "PM", "am", "pm", or 12-hour clock representations.
- All times must be strictly rendered in 24-hour format with zero-padded hours and minutes: `HH:mm` (e.g., `09:05`, `14:30`, `23:59`).

### 8.2 Universal DD/MM/YYYY Date Standard (Non-Negotiable)
- **WE USE ONLY DD/MM/YYYY DATE FORMAT THROUGHOUT THE ENTIRE USER INTERFACE**.
- All user-facing date inputs, displays, pickers, placeholders, and tooltips must strictly present dates in **`DD/MM/YYYY`** format (e.g., `17/10/2026`).
- **Strict Prohibition of Raw `YYYY-MM-DD` in the UI**:
  - Never display raw ISO `YYYY-MM-DD` directly inside input boxes, labels, or user-facing elements.
  - `YYYY-MM-DD` is strictly reserved for internal state serialization, API payloads, and database storage.
  - Later, an application setting will allow users to configure alternative date formats; until then, `DD/MM/YYYY` is the mandatory application-wide standard.
  - The reusable `DatePickerModern` component renders dates as `DD/MM/YYYY` with placeholder `DD/MM/YYYY` while converting to canonical ISO format for API submission.

### 8.3 Mandatory Reusable Pickers (DatePickerModern & TimePicker24h)
- **Strict Prohibition of Raw `<input type="date">` and `<input type="time">`**:
  - Native browser `<input type="date">` and `<input type="time">` are strictly banned from direct usage. They delegate rendering to host operating system locales, creating inconsistent, unstyled dialogs and forcing 12-hour AM/PM dials on US regional settings.
- **Mandatory Reusable Components**:
  1. **`DatePickerModern`**:
     - Single unified input trigger with calendar icon, `DD/MM/YYYY` formatted display, and chevron.
     - Fully styled popover calendar dialog in Dark and Light themes.
     - Localized month and weekday headers in English, Hebrew, and Russian via `Intl.DateTimeFormat`.
     - Strict `min` and `max` date boundary enforcement (disables out-of-range dates).
     - Jump-to-Today footer button.
  2. **`TimePicker24h`**:
     - Single unified input trigger (`triggerType="input"`) with clock icon, formatted 24h text, and chevron.
     - 24-hour steppers (▲/▼) and dual columns (00–23 hours, 00–59 minutes).
     - Configurable quick presets (e.g. evening basal `['20:00', '21:00', '22:00', '23:00']` or relative injection hours).
     - Zero AM/PM controls or text.

### 8.4 Standard Quick Selection Chips
- **Date Quick Chips (3-Day Fast Window)**:
  - Chip 1: `Today` (`t('time.today')`).
  - Chip 2: `-1 day` formatted as `DD/MM` (e.g. `16/10`).
  - Chip 3: `-2 days` formatted as `DD/MM` (e.g. `15/10`).
  - Allows immediate one-tap selection of recent dates within the 3-day period.
- **Time Quick Chips & Relative Presets**:
  - Quick Chip: `Current Time` (`t('logs.currentTime')`).
  - Relative Popover Presets: In manual injection logging, presets display 4 relative hours from current time (`-1h`, `-2h`, `-3h`, `-4h`, e.g. `09:30`, `08:30`, `07:30`, `06:30`).

### 8.5 Primary Action Button Visual Feedback (No Dull Gray)
- **Primary Confirm / Add Action Buttons** (e.g., `.modal-btn.confirm-btn`, `.manual-submit-btn`) must **NEVER appear dull gray** or visually disabled when active.
- Primary buttons must always use vibrant InsuMinder cyan-blue gradients (`linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)`), crisp borders, and distinct hover/active states (`filter: brightness(1.1)`), reserving opacity reduction solely for the `:disabled` state.

---

## 9. Zero Guesswork & Approval Protocol
- Every UI element must be aligned, predictable, and follow these rules.
- If a developer or agent considers introducing a new layout pattern, differing spacing, or novel icon size, **they must ask and obtain explicit user approval before writing the code**.


