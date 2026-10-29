# Rule: Internationalization (i18n) & Theme Parity

## 1. 100% 3-Way Translation Parity (Rule 7)
InsuMinder supports three languages: English (`en`), Hebrew (`he`), and Russian (`ru`).

### Parity Requirements:
1. **Zero Key Drift**:
   - 100% of translation keys in `en` MUST exist in `he` and `ru`.
   - 100% of keys in `he` and `ru` MUST exist in `en`.
   - No orphan keys or missing translations are permitted.
2. **Non-Empty Strings**:
   - Every translation value must be a non-empty, non-whitespace string.
3. **Parameter Parity**:
   - Interpolation placeholders (e.g. `{param}`, `{minutes}`, `{name}`) must match identically between `en` and target languages.
4. **Verification**:
   ```bash
   npm run check:i18n
   # or: npm --prefix client run check:i18n
   ```

---

## 2. 100% Dual Theme Parity (Rule 8)
InsuMinder provides first-class support for both **Dark** (primary system default) and **Light** themes.

### Theme Parity Requirements:
1. **Design System Variables**:
   - All standard tokens (`--text`, `--text-h`, `--bg`, `--border`, `--code-bg`, `--accent`, `--accent-bg`, `--accent-border`, `--shadow`, `--section-gap`) must be defined and functional in both `:root` / `[data-theme="dark"]` and `[data-theme="light"]`.
2. **Contrast & Readability**:
   - Whenever introducing a new UI component, modal, badge, button, or card, explicit Light theme overrides (`[data-theme="light"] .component-class`) MUST be defined if it relies on custom surface styling.
   - Absolute prohibition against low-contrast states (e.g. white text on light gray background, or black text on dark background).
3. **Verification**:
   ```bash
   npm run check:theme
   # or: npm --prefix client run check:theme
   ```

