import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { translations } from '../i18n/translations';
import { LanguageProvider, useTranslation, translate } from '../i18n';

describe('i18n Localization and Parity Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

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

  it('enforces 100% key parity across English, Hebrew, and Russian translations', () => {
    const enLeafs = collectLeafKeys(translations.en);
    const heLeafs = collectLeafKeys(translations.he);
    const ruLeafs = collectLeafKeys(translations.ru);

    const enKeys = Object.keys(enLeafs).sort();
    const heKeys = Object.keys(heLeafs).sort();
    const ruKeys = Object.keys(ruLeafs).sort();

    const missingInHe = enKeys.filter(k => !(k in heLeafs));
    const missingInEnFromHe = heKeys.filter(k => !(k in enLeafs));
    const missingInRu = enKeys.filter(k => !(k in ruLeafs));
    const missingInEnFromRu = ruKeys.filter(k => !(k in enLeafs));

    expect(missingInHe, `Keys missing from Hebrew: ${missingInHe.join(', ')}`).toEqual([]);
    expect(missingInEnFromHe, `Keys extra in Hebrew: ${missingInEnFromHe.join(', ')}`).toEqual([]);
    expect(missingInRu, `Keys missing from Russian: ${missingInRu.join(', ')}`).toEqual([]);
    expect(missingInEnFromRu, `Keys extra in Russian: ${missingInEnFromRu.join(', ')}`).toEqual([]);

    expect(enKeys.length).toBeGreaterThan(50);
    expect(heKeys.length).toBe(enKeys.length);
    expect(ruKeys.length).toBe(enKeys.length);
  });

  it('ensures no translation string is empty or whitespace-only', () => {
    const enLeafs = collectLeafKeys(translations.en);
    const heLeafs = collectLeafKeys(translations.he);
    const ruLeafs = collectLeafKeys(translations.ru);

    for (const [key, val] of Object.entries(enLeafs)) {
      expect(typeof val, `EN ${key} is string`).toBe('string');
      expect(val.trim().length, `EN ${key} is non-empty`).toBeGreaterThan(0);
    }

    for (const [key, val] of Object.entries(heLeafs)) {
      expect(typeof val, `HE ${key} is string`).toBe('string');
      expect(val.trim().length, `HE ${key} is non-empty`).toBeGreaterThan(0);
    }

    for (const [key, val] of Object.entries(ruLeafs)) {
      expect(typeof val, `RU ${key} is string`).toBe('string');
      expect(val.trim().length, `RU ${key} is non-empty`).toBeGreaterThan(0);
    }
  });

  it('interpolates tokens correctly in English, Hebrew, and Russian', () => {
    const enText = translate('auth.verifyEmailSubtitle', { email: 'patient@example.com' }, 'en');
    expect(enText).toBe('Enter the 6-digit code sent to patient@example.com');

    const heText = translate('auth.verifyEmailSubtitle', { email: 'patient@example.com' }, 'he');
    expect(heText).toBe('הזינו את הקוד בן 6 הספרות שנשלח אל patient@example.com');

    const ruText = translate('auth.verifyEmailSubtitle', { email: 'patient@example.com' }, 'ru');
    expect(ruText).toBe('Введите 6-значный код, отправленный на patient@example.com');
  });

  it('falls back to English if a key is not defined in another language', () => {
    const fallbackText = translate('common.save', {}, 'fr');
    expect(fallbackText).toBe('Save');
  });

  it('returns key string if key is completely unknown', () => {
    const missing = translate('nonexistent.nested.key', {}, 'he');
    expect(missing).toBe('nonexistent.nested.key');
  });

  it('updates document lang and dir attributes when switching language to Hebrew (RTL) and Russian (LTR)', () => {
    const wrapper = ({ children }) => React.createElement(LanguageProvider, null, children);
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.language).toBe('en');
    expect(result.current.isRTL).toBe(false);
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.getAttribute('lang')).toBe('en');

    // Switch to Hebrew (RTL)
    act(() => {
      result.current.setLanguage('he');
    });

    expect(result.current.language).toBe('he');
    expect(result.current.isRTL).toBe(true);
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('he');
    expect(localStorage.getItem('insuminder_language')).toBe('he');

    // Switch to Russian (LTR)
    act(() => {
      result.current.setLanguage('ru');
    });

    expect(result.current.language).toBe('ru');
    expect(result.current.isRTL).toBe(false);
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.getAttribute('lang')).toBe('ru');
    expect(localStorage.getItem('insuminder_language')).toBe('ru');

    // Switch back to English
    act(() => {
      result.current.setLanguage('en');
    });

    expect(result.current.language).toBe('en');
    expect(result.current.isRTL).toBe(false);
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(localStorage.getItem('insuminder_language')).toBe('en');
  });

  it('initializes LanguageProvider with logged-in user language preference', () => {
    localStorage.setItem('insuminder_auth_user', JSON.stringify({ id: 99, email: 'user@ru.com', language: 'ru' }));
    const wrapper = ({ children }) => React.createElement(LanguageProvider, null, children);
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.language).toBe('ru');
    expect(result.current.isRTL).toBe(false);
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.getAttribute('lang')).toBe('ru');
  });

  it('persists language to user-specific localStorage key when language changes', () => {
    localStorage.setItem('insuminder_auth_user', JSON.stringify({ id: 55, email: 'user55@ru.com', language: 'en' }));
    const wrapper = ({ children }) => React.createElement(LanguageProvider, null, children);
    const { result } = renderHook(() => useTranslation(), { wrapper });

    expect(result.current.language).toBe('en');

    act(() => {
      result.current.setLanguage('ru');
    });

    expect(result.current.language).toBe('ru');
    expect(localStorage.getItem('insuminder_language')).toBe('ru');
    expect(localStorage.getItem('insuminder_language_55')).toBe('ru');
    const updatedUser = JSON.parse(localStorage.getItem('insuminder_auth_user'));
    expect(updatedUser.language).toBe('ru');
  });
});
