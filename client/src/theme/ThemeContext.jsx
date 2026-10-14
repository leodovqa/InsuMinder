import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../authService';

const DEFAULT_THEME = 'dark';
const THEME_STORAGE_KEY = 'insuminder_theme';

export const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {}
});

/**
 * Resolves initial theme with priority:
 * 1. User profile theme if logged in
 * 2. User-scoped localStorage theme
 * 3. Generic localStorage theme
 * 4. System preference via window.matchMedia
 * 5. Default fallback to 'dark'
 */
export function getInitialTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const user = authService.getCurrentUser();
    if (user?.theme && (user.theme === 'dark' || user.theme === 'light')) {
      return user.theme;
    }
    if (user?.id) {
      const userStored = localStorage.getItem(`${THEME_STORAGE_KEY}_${user.id}`);
      if (userStored === 'dark' || userStored === 'light') {
        return userStored;
      }
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // storage or matchMedia error
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => getInitialTheme());

  const applyThemeToDOM = (activeTheme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', activeTheme);
      document.documentElement.style.colorScheme = activeTheme;
    }
  };

  const setTheme = useCallback((newTheme) => {
    const next = newTheme === 'light' ? 'light' : 'dark';
    setThemeState(next);
    applyThemeToDOM(next);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, next);
        const user = authService.getCurrentUser();
        if (user?.id) {
          localStorage.setItem(`${THEME_STORAGE_KEY}_${user.id}`, next);
          user.theme = next;
          localStorage.setItem('insuminder_auth_user', JSON.stringify(user));
        }
      }
    } catch {
      // storage error
    }

    if (authService.getToken()) {
      authService.updateTheme(next).catch((err) => {
        console.error('Failed to sync theme preference:', err);
      });
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Listen for system theme changes if no explicit user override exists
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e) => {
      try {
        const hasStored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!hasStored) {
          setTheme(e.matches ? 'light' : 'dark');
        }
      } catch {
        // ignore
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

