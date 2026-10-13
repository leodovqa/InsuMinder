import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { translations } from './translations';

export { translations };

const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['en', 'he', 'ru'];

export const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key, params) => translate(key, params, DEFAULT_LANGUAGE),
  isRTL: false
});

/**
 * Resolves a nested dot-delimited key in translations dictionary with parameter interpolation.
 *
 * @param {string} key - e.g. "home.logInjection"
 * @param {Object} [params] - interpolation tokens, e.g. { time: "14:30" }
 * @param {string} [lang="en"] - 'en' | 'he'
 * @returns {string} translated and interpolated string
 */
export function translate(key, params = {}, lang = DEFAULT_LANGUAGE) {
  if (!key) return '';
  const activeLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
  const dict = translations[activeLang] || translations.en;
  const fallbackDict = translations.en;

  const parts = key.split('.');
  let val = dict;
  for (const part of parts) {
    if (val && typeof val === 'object' && part in val) {
      val = val[part];
    } else {
      val = null;
      break;
    }
  }

  // Fallback to English if missing in active language
  if (val === null || val === undefined) {
    let fallbackVal = fallbackDict;
    for (const part of parts) {
      if (fallbackVal && typeof fallbackVal === 'object' && part in fallbackVal) {
        fallbackVal = fallbackVal[part];
      } else {
        fallbackVal = null;
        break;
      }
    }
    val = fallbackVal;
  }

  if (val === null || val === undefined) {
    return key;
  }

  if (typeof val !== 'string') {
    return String(val);
  }

  // Interpolate tokens: {token}
  let result = val;
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v !== undefined && v !== null ? String(v) : '');
    }
  }

  return result;
}

export function LanguageProvider({ children, initialLanguage = null }) {
  const [language, setLanguageState] = useState(() => {
    if (initialLanguage && SUPPORTED_LANGUAGES.includes(initialLanguage)) {
      return initialLanguage;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const userRaw = localStorage.getItem('insuminder_auth_user');
        if (userRaw) {
          try {
            const u = JSON.parse(userRaw);
            if (u && u.id) {
              const userStored = localStorage.getItem('insuminder_language_' + u.id);
              if (userStored && SUPPORTED_LANGUAGES.includes(userStored)) {
                return userStored;
              }
            }
            if (u && u.language && SUPPORTED_LANGUAGES.includes(u.language)) {
              return u.language;
            }
          } catch {
            // parse error
          }
        }
        const stored = localStorage.getItem('insuminder_language');
        if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
          return stored;
        }
      }
    } catch {
      // storage unavailable
    }
    return DEFAULT_LANGUAGE;
  });

  const setLanguage = useCallback((newLang) => {
    const valid = SUPPORTED_LANGUAGES.includes(newLang) ? newLang : DEFAULT_LANGUAGE;
    setLanguageState(valid);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('insuminder_language', valid);
        const userRaw = localStorage.getItem('insuminder_auth_user');
        if (userRaw) {
          try {
            const u = JSON.parse(userRaw);
            if (u && u.id) {
              localStorage.setItem('insuminder_language_' + u.id, valid);
              u.language = valid;
              localStorage.setItem('insuminder_auth_user', JSON.stringify(u));
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // storage error
    }
  }, []);

  const isRTL = language === 'he';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    }
  }, [language, isRTL]);

  const t = useCallback((key, params) => {
    return translate(key, params, language);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    isRTL
  }), [language, setLanguage, t, isRTL]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (key, params) => translate(key, params, DEFAULT_LANGUAGE),
      isRTL: false
    };
  }
  return ctx;
}
