#!/usr/bin/env node

/**
 * CI & Pre-Commit Hebrew Translation Parity Checker
 *
 * Verifies that:
 * 1. 100% of keys in English (en) exist in Hebrew (he).
 * 2. 100% of keys in Hebrew (he) exist in English (en).
 * 3. No translation value is empty, null, or undefined.
 * 4. Interpolation placeholders ({param}) match between en and he.
 */

import process from 'node:process';
import { translations } from '../src/i18n/translations.js';

function collectLeafKeys(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, collectLeafKeys(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

function extractPlaceholders(str) {
  if (typeof str !== 'string') return [];
  const matches = str.match(/\{([a-zA-Z0-9_]+)\}/g);
  return matches ? matches.map(m => m.slice(1, -1)).sort() : [];
}

function runParityCheck() {
  console.log('🌐 Checking Internationalization (i18n) Parity between English (en) and Hebrew (he)...');

  if (!translations.en || typeof translations.en !== 'object') {
    console.error('❌ Error: English translations (en) missing or invalid.');
    process.exit(1);
  }

  if (!translations.he || typeof translations.he !== 'object') {
    console.error('❌ Error: Hebrew translations (he) missing or invalid.');
    process.exit(1);
  }

  const enLeafs = collectLeafKeys(translations.en);
  const heLeafs = collectLeafKeys(translations.he);

  const enKeys = Object.keys(enLeafs);
  const heKeys = Object.keys(heLeafs);

  const missingInHe = enKeys.filter(k => !(k in heLeafs));
  const missingInEn = heKeys.filter(k => !(k in enLeafs));

  const emptyInEn = enKeys.filter(k => typeof enLeafs[k] !== 'string' || !enLeafs[k].trim());
  const emptyInHe = heKeys.filter(k => typeof heLeafs[k] !== 'string' || !heLeafs[k].trim());

  // Check placeholder matching
  const placeholderMismatches = [];
  for (const k of enKeys) {
    if (k in heLeafs) {
      const enTokens = extractPlaceholders(enLeafs[k]);
      const heTokens = extractPlaceholders(heLeafs[k]);
      if (enTokens.join(',') !== heTokens.join(',')) {
        placeholderMismatches.push({
          key: k,
          en: enTokens,
          he: heTokens
        });
      }
    }
  }

  let hasError = false;

  if (missingInHe.length > 0) {
    hasError = true;
    console.error(`❌ [Missing in Hebrew]: ${missingInHe.length} key(s) are missing from Hebrew:`);
    missingInHe.forEach(k => console.error(`    - ${k}`));
  }

  if (missingInEn.length > 0) {
    hasError = true;
    console.error(`❌ [Missing in English]: ${missingInEn.length} key(s) exist in Hebrew but not in English:`);
    missingInEn.forEach(k => console.error(`    - ${k}`));
  }

  if (emptyInEn.length > 0) {
    hasError = true;
    console.error(`❌ [Empty in English]: ${emptyInEn.length} key(s) are empty:`);
    emptyInEn.forEach(k => console.error(`    - ${k}`));
  }

  if (emptyInHe.length > 0) {
    hasError = true;
    console.error(`❌ [Empty in Hebrew]: ${emptyInHe.length} key(s) are empty:`);
    emptyInHe.forEach(k => console.error(`    - ${k}`));
  }

  if (placeholderMismatches.length > 0) {
    hasError = true;
    console.error(`❌ [Placeholder Mismatch]: ${placeholderMismatches.length} key(s) have mismatched tokens:`);
    placeholderMismatches.forEach(m => {
      console.error(`    - ${m.key}: EN has {${m.en.join(', ')}}, HE has {${m.he.join(', ')}}`);
    });
  }

  if (hasError) {
    console.error('\n💥 i18n parity check FAILED! Please update Hebrew and English translations to ensure 100% parity.\n');
    process.exit(1);
  }

  console.log(`✓ Hebrew translation parity verified: ${enKeys.length} keys in 100% full parity between EN and HE.`);
  console.log('✓ All translations non-empty, and all interpolation tokens matched.\n');
}

runParityCheck();

