# Rule: UI/UX Design & Architecture Standards

Mandatory standards for all frontend UI components, CSS styling, and layout modifications in InsuMinder. Zero guesswork, zero arbitrary styling.

---

## 1. Centering & Alignment Standards
1. **Vertical Centering is Universal**:
   - Every UI element (buttons, labels, badges, pills, inputs, icon containers, list items, card rows) **MUST ALWAYS be centered vertically** (`align-items: center`).
   - Never rely on default baseline or `flex-start` for interactive or row-based elements unless explicitly displaying multi-line prose text.
   - When an icon is paired with text, both must be vertically centered with a consistent gap (`6px`–`10px`).
2. **Horizontal Centering by Default**:
   - Buttons, badge pills, status pills, floating action buttons, and standalone icon wrappers must be centered both horizontally and vertically (`justify-content: center; align-items: center; display: inline-flex`).
   - If an element is explicitly required to be left-aligned (LTR) or right-aligned (RTL) — such as card titles or form labels — horizontal alignment may be `flex-start` or `text-align: start`, but it **MUST STILL BE CENTERED VERTICALLY** (`align-items: center`).

---

## 2. Container-Controlled Section Spacing (`--section-gap: 20px`)
1. **Single Identical Spacing Mechanism Across All Pages**:
   - Spacing between cards, sections, banners, and action triggers must ALWAYS be identical and uniform across every single view.
   - All primary page layout containers (`.home-container`, `.page-content-wrapper`, `.settings-container`, `.profile-container`, `.notification-settings-container`) must strictly use:
     ```css
     :root, [data-theme="dark"], [data-theme="light"] {
       --section-gap: 20px;
     }
     .home-container, .page-content-wrapper, .settings-container, .profile-container, .notification-settings-container {
       display: flex;
       flex-direction: column;
       gap: var(--section-gap, 20px);
     }
     ```
2. **Zero Ad-Hoc Physical Margins**:
   - NEVER apply physical top or bottom margins (`margin-top` / `margin-bottom`) directly to child cards, sections, banners, or action triggers.
   - Separation must be controlled solely by the parent container's `gap`.

---

## 3. Icon Dimensions & Paired Controls
1. **Standardized Icon Scale**:
   - Card/Section Headers: `22px × 22px` SVG in `42px × 42px` rounded wrapper.
   - Buttons & Inputs: `18px × 18px` SVG / font in `32px × 32px` wrapper or inline.
   - Scope Pills & Badges: `16px` font / SVG inline flex (`gap: 8px`).
   - Status Chevrons / Indicators: `14px` SVG inline flex.
2. **Vector SVG Mandatory for Paired / Segmented Controls**:
   - STRICT PROHIBITION against using raw OS emojis (e.g. `👤` vs `👥`) for paired switches or pills.
   - OS emojis have disparate glyph bounding boxes, causing visual size mismatches.
   - Always use crisp vector SVGs with matching bounding boxes (`18px × 18px`) and matching stroke widths.

---

## 4. Modal Scroll Locking & Touch Boundaries
1. When opening a modal, lock the underlying body scroll (`overflow: hidden; touch-action: none;`).
2. Modals must center vertically and horizontally on mobile viewports with adequate safe-area insets (`env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`).
3. Modal backdrops must dismiss on background click while modal container clicks are isolated (`stopPropagation`).

