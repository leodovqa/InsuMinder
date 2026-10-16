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

## 2. Section & Card Spacing Consistency

### 2.1 Container-Controlled Spacing (Zero Ad-Hoc Margins)
- Spacing between cards, sections, and stacked containers must **ALWAYS be completely uniform** throughout the entire application.
- All section containers (e.g., `.settings-container`, `.app-main`, `.logs-container`) must manage child separation solely through layout properties:
  ```css
  display: flex;
  flex-direction: column;
  gap: 22px; /* Uniform section gap across the application */
  ```
- **STRICT PROHIBITION**: Never apply ad-hoc `margin-top` or `margin-bottom` directly to child cards or sections (e.g., `.shared-access-card`, `.about-app-card`, `.pwa-install-settings-card`) inside flex or grid containers. Stacking margins on top of container gaps causes irregular, disjointed spacing between sections.

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

## 7. Zero Guesswork & Approval Protocol
- Every UI element must be aligned, predictable, and follow these rules.
- If a developer or agent considers introducing a new layout pattern, differing spacing, or novel icon size, **they must ask and obtain explicit user approval before writing the code**.

