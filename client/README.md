# InsuMinder Frontend Client

The frontend client for InsuMinder is built with **React 19** and **Vite**, featuring a custom CSS token-based design system, full bidirectional RTL/LTR localization (English, Hebrew, Russian), and comprehensive automated testing.

---

## 🛠️ Architecture & Tooling

* **Framework**: React 19 (`client/src/App.jsx`, `client/src/main.jsx`)
* **Bundler & Dev Server**: Vite with `@vitejs/plugin-react` and local API proxy to `:5000`
* **Automated Testing**: Vitest + React Testing Library (`client/src/test/`)
* **Styling**: Vanilla CSS design tokens (`client/src/index.css`) with Dark/Light theme parity overrides (`client/src/App.css`)
* **Internationalization (i18n)**: Handcrafted, zero-dependency translation engine (`client/src/i18n/translations.js`) with 100% 3-way parity
* **UI Standards**: Centered layouts, container-controlled `--section-gap: 20px;`, and strict modal scroll locking ([UI_STANDARDS.md](../UI_STANDARDS.md))

---

## 🚀 Development Scripts

Run all scripts from the repository root or within the `client/` directory:

```bash
# Start local dev server with HMR
npm run dev

# Run Vitest test suites
npm test

# Run ESLint validation
npm run lint

# Check 3-way translation parity (EN, HE, RU)
npm run check:i18n

# Check Dark and Light theme styling parity
npm run check:theme

# Build production bundle
npm run build
```

---

## 📋 Tooling & Optimization Notes

* **React Compiler**: The React 19 build currently uses standard Babel/Vite JSX transforms. React Compiler evaluation is deferred to maintain fast HMR build times across environments.
* **ESLint & Parity**: Automated linting enforces ES module standards, unused variable detection, and hooks consistency. Translation and theme parity checks run automatically on pre-commit and CI.
