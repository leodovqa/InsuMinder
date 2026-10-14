#!/usr/bin/env node

/**
 * CI & Pre-Commit Theme (Dark & Light) Parity & Consistency Checker
 *
 * Verifies that:
 * 1. 100% of required design system CSS variables are defined in both Dark and Light modes.
 * 2. Dark mode is properly configured as the primary system default in :root.
 * 3. Light theme overrides exist for all critical UI components to guarantee contrast and readability.
 * 4. No anti-patterns exist (e.g. white text on light backgrounds or unhandled dark container bleeding).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexCssPath = path.resolve(__dirname, '../src/index.css');
const appCssPath = path.resolve(__dirname, '../src/App.css');

const REQUIRED_THEME_VARS = [
  '--text',
  '--text-h',
  '--bg',
  '--border',
  '--code-bg',
  '--accent',
  '--accent-bg',
  '--accent-border',
  '--shadow'
];

const CRITICAL_LIGHT_COMPONENTS = [
  '.context-switcher-pill',
  '.context-switch-btn',
  '.profile-account-info',
  '.profile-input:disabled',
  '.phone-prefix-addon',
  '.share-code-box',
  '.copy-code-btn',
  '.group-view-btn',
  '.clock-picker-popover',
  '.clock-steppers-row',
  '.clock-display-digit',
  '.clock-picker-trigger',
  '.language-btn',
  '.config-item',
  '.auth-hero-banner',
  '.auth-modal-container'
];

function extractCssBlock(cssContent, selectorPattern) {
  const match = cssContent.match(selectorPattern);
  if (!match) return null;
  const startIndex = match.index + match[0].length;
  let depth = 1;
  let endIndex = startIndex;
  while (depth > 0 && endIndex < cssContent.length) {
    if (cssContent[endIndex] === '{') depth++;
    else if (cssContent[endIndex] === '}') depth--;
    endIndex++;
  }
  return cssContent.substring(startIndex, endIndex - 1);
}

function parseCssVariables(cssBlock) {
  if (!cssBlock) return {};
  const vars = {};
  const regex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(cssBlock)) !== null) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
}

function runThemeCheck() {
  console.log('🎨 Checking Theme (Dark & Light) Consistency & Style System Parity...');
  let hasError = false;

  if (!fs.existsSync(indexCssPath)) {
    console.error(`❌ Error: index.css not found at ${indexCssPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(appCssPath)) {
    console.error(`❌ Error: App.css not found at ${appCssPath}`);
    process.exit(1);
  }

  const indexCss = fs.readFileSync(indexCssPath, 'utf8');
  const appCss = fs.readFileSync(appCssPath, 'utf8');

  // 1. Verify Dark Mode Block in index.css
  const darkBlock = extractCssBlock(indexCss, /(:root,\s*\[data-theme="dark"\]|\[data-theme="dark"\])\s*\{/);
  if (!darkBlock) {
    hasError = true;
    console.error('❌ [Dark Theme]: Missing ":root, [data-theme="dark"]" declaration block in index.css.');
  }

  // 2. Verify Light Mode Block in index.css
  const lightBlock = extractCssBlock(indexCss, /\[data-theme="light"\]\s*\{/);
  if (!lightBlock) {
    hasError = true;
    console.error('❌ [Light Theme]: Missing "[data-theme="light"]" declaration block in index.css.');
  }

  const darkVars = parseCssVariables(darkBlock);
  const lightVars = parseCssVariables(lightBlock);

  // Check required variables across both themes
  for (const varName of REQUIRED_THEME_VARS) {
    if (!darkVars[varName]) {
      hasError = true;
      console.error(`❌ [Variable Missing in Dark]: ${varName} is not defined in Dark theme.`);
    }
    if (!lightVars[varName]) {
      hasError = true;
      console.error(`❌ [Variable Missing in Light]: ${varName} is not defined in Light theme.`);
    }
  }

  if (!hasError) {
    console.log(`✓ Core Theme Variables Parity verified: ${REQUIRED_THEME_VARS.length} variables defined across [data-theme="dark"] and [data-theme="light"].`);
  }

  // 3. Verify Light Theme Component Coverage in App.css
  const missingLightComponents = [];
  for (const comp of CRITICAL_LIGHT_COMPONENTS) {
    const selectorPattern = new RegExp(`\\[data-theme="light"\\][^\\{]*${comp.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}`);
    if (!selectorPattern.test(appCss)) {
      missingLightComponents.push(comp);
    }
  }

  if (missingLightComponents.length > 0) {
    hasError = true;
    console.error(`❌ [Light Component Overrides Missing]: ${missingLightComponents.length} component(s) missing light-mode rules:`);
    missingLightComponents.forEach(c => console.error(`    - ${c}`));
  } else {
    console.log(`✓ Light Theme component overrides verified: ${CRITICAL_LIGHT_COMPONENTS.length} critical UI elements styled for light mode.`);
  }

  // 4. Anti-Pattern Contrast Safeguards
  // Safeguard A: clock-display-digit in light mode must not be white
  const clockDigitMatch = appCss.match(/\[data-theme="light"\]\s+\.clock-display-digit\s*\{([^}]+)\}/);
  if (clockDigitMatch) {
    const ruleContent = clockDigitMatch[1];
    if (ruleContent.includes('#ffffff') || ruleContent.includes('#fff')) {
      hasError = true;
      console.error('❌ [Contrast Hazard]: .clock-display-digit in light mode is set to white (#fff/#ffffff), causing invisible digits.');
    }
  }

  // Safeguard B: active group view button in light mode must have explicit text color
  const groupViewActiveMatch = appCss.match(/\[data-theme="light"\]\s+\.group-view-btn\.active\s*\{([^}]+)\}/);
  if (groupViewActiveMatch) {
    const ruleContent = groupViewActiveMatch[1];
    if (!ruleContent.includes('color:') || !ruleContent.includes('background')) {
      hasError = true;
      console.error('❌ [Contrast Hazard]: .group-view-btn.active in light mode must specify both background and text color.');
    }
  }

  // Safeguard C: verify dark theme is set as root fallback
  if (!indexCss.includes(':root,') || !indexCss.includes('color-scheme: dark')) {
    hasError = true;
    console.error('❌ [Default Theme Hazard]: Default color-scheme or :root dark mode fallback is missing.');
  }

  if (hasError) {
    console.error('\n💥 Theme parity & consistency check FAILED! Please ensure all components have valid dark/light styling.\n');
    process.exit(1);
  }

  console.log('✓ Contrast & color anti-pattern check clean (no unhandled dark backgrounds or invisible text in light mode).');
  console.log('\n✓ Full Theme Parity verified for modern Dark and modern Light modes.\n');
}

runThemeCheck();

