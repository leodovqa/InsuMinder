#!/usr/bin/env node

/**
 * CI & Pre-Commit Translation Parity Checker
 *
 * Verifies that:
 * 1. 100% of keys in English (en) exist in Hebrew (he) and Russian (ru).
 * 2. 100% of keys in Hebrew (he) and Russian (ru) exist in English (en).
 * 3. No translation value is empty, null, or undefined.
 * 4. Interpolation placeholders ({param}) match between en and each target language.
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
  console.log('🌐 Checking Internationalization (i18n) Parity across English (en), Hebrew (he), and Russian (ru)...');

  if (!translations.en || typeof translations.en !== 'object') {
    console.error('❌ Error: English translations (en) missing or invalid.');
    process.exit(1);
  }

  const enLeafs = collectLeafKeys(translations.en);
  const enKeys = Object.keys(enLeafs);

  const emptyInEn = enKeys.filter(k => typeof enLeafs[k] !== 'string' || !enLeafs[k].trim());
  let hasError = false;

  if (emptyInEn.length > 0) {
    hasError = true;
    console.error(`❌ [Empty in English]: ${emptyInEn.length} key(s) are empty:`);
    emptyInEn.forEach(k => console.error(`    - ${k}`));
  }

  const targetLanguages = [
    { code: 'he', name: 'Hebrew' },
    { code: 'ru', name: 'Russian' }
  ];

  for (const { code, name } of targetLanguages) {
    if (!translations[code] || typeof translations[code] !== 'object') {
      console.error(`❌ Error: ${name} translations (${code}) missing or invalid.`);
      process.exit(1);
    }

    const targetLeafs = collectLeafKeys(translations[code]);
    const targetKeys = Object.keys(targetLeafs);

    const missingInTarget = enKeys.filter(k => !(k in targetLeafs));
    const missingInEn = targetKeys.filter(k => !(k in enLeafs));
    const emptyInTarget = targetKeys.filter(k => typeof targetLeafs[k] !== 'string' || !targetLeafs[k].trim());

    const placeholderMismatches = [];
    for (const k of enKeys) {
      if (k in targetLeafs) {
        const enTokens = extractPlaceholders(enLeafs[k]);
        const targetTokens = extractPlaceholders(targetLeafs[k]);
        if (enTokens.join(',') !== targetTokens.join(',')) {
          placeholderMismatches.push({
            key: k,
            en: enTokens,
            target: targetTokens
          });
        }
      }
    }

    if (missingInTarget.length > 0) {
      hasError = true;
      console.error(`❌ [Missing in ${name} (${code})]: ${missingInTarget.length} key(s) are missing:`);
      missingInTarget.forEach(k => console.error(`    - ${k}`));
    }

    if (missingInEn.length > 0) {
      hasError = true;
      console.error(`❌ [Missing in English (extra in ${code})]: ${missingInEn.length} key(s) exist in ${code} but not in EN:`);
      missingInEn.forEach(k => console.error(`    - ${k}`));
    }

    if (emptyInTarget.length > 0) {
      hasError = true;
      console.error(`❌ [Empty in ${name} (${code})]: ${emptyInTarget.length} key(s) are empty:`);
      emptyInTarget.forEach(k => console.error(`    - ${k}`));
    }

    if (placeholderMismatches.length > 0) {
      hasError = true;
      console.error(`❌ [Placeholder Mismatch in ${name} (${code})]: ${placeholderMismatches.length} key(s) have mismatched tokens:`);
      placeholderMismatches.forEach(m => {
        console.error(`    - ${m.key}: EN has {${m.en.join(', ')}}, ${code.toUpperCase()} has {${m.target.join(', ')}}`);
      });
    }

    if (!hasError) {
      console.log(`✓ ${name} (${code}) translation parity verified: ${enKeys.length} keys in 100% full parity with EN.`);
    }
  }

  if (hasError) {
    console.error('\n💥 i18n parity check FAILED! Please update translations to ensure 100% parity.\n');
    process.exit(1);
  }

  console.log(`\n✓ Full 3-way translation parity verified across EN, HE, and RU (${enKeys.length} keys).`);
  console.log('✓ All translations non-empty, and all interpolation tokens matched.\n');
}

runParityCheck();
