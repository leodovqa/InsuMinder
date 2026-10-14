import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme, getInitialTheme } from '../theme/ThemeContext';
import { authService } from '../authService';

function ThemeConsumer() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}

describe('Theme Context & Dark/Light Mode Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('defaults to dark mode when no preferences or system query are set', () => {
    // Mock matchMedia returning false for light
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    expect(getInitialTheme()).toBe('dark');

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('detects light system preference when no explicit override exists', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: light)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));

    expect(getInitialTheme()).toBe('light');

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('prioritizes user profile theme if logged in', () => {
    vi.spyOn(authService, 'getCurrentUser').mockReturnValue({
      id: 42,
      email: 'user@example.com',
      theme: 'light'
    });

    expect(getInitialTheme()).toBe('light');

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
  });

  it('updates DOM data-theme attribute and localStorage on theme switch', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');

    const setLightBtn = screen.getByRole('button', { name: 'Set Light' });
    fireEvent.click(setLightBtn);

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('insuminder_theme')).toBe('light');

    const toggleBtn = screen.getByRole('button', { name: 'Toggle' });
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('insuminder_theme')).toBe('dark');
  });

  it('invokes authService.updateTheme when user has active session', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-jwt-token');
    const updateThemeSpy = vi.spyOn(authService, 'updateTheme').mockResolvedValue({ success: true });

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    const setLightBtn = screen.getByRole('button', { name: 'Set Light' });
    fireEvent.click(setLightBtn);

    expect(updateThemeSpy).toHaveBeenCalledWith('light');
  });

  it('renders theme selector in the sidebar drawer and toggles theme', async () => {
    // Import App dynamically to test full component tree
    const { default: App } = await import('../App');

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, user: { id: 1, email: 'user@test.com', name: 'User' } })
        });
      }
      if (url === '/api/logs') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, logs: [] })
        });
      }
      if (url === '/api/telegram-configs') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, configs: [] })
        });
      }
      if (url === '/api/share/status') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, shareCode: 'INSU-1234', members: [], sharedGroups: [] })
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true })
      });
    });

    render(<App />);

    // Open sidebar drawer
    const menuBtn = screen.getByRole('button', { name: /open navigation menu/i });
    fireEvent.click(menuBtn);

    // Verify theme selector pill is present
    const darkBtn = screen.getByRole('radio', { name: /Dark/i });
    const lightBtn = screen.getByRole('radio', { name: /Light/i });

    expect(darkBtn).toBeInTheDocument();
    expect(lightBtn).toBeInTheDocument();

    // Click light theme
    fireEvent.click(lightBtn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // Click dark theme
    fireEvent.click(darkBtn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('verifies theme card is removed from Settings tab and only controlled from sidebar', async () => {
    const { default: App } = await import('../App');

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, user: { id: 1, email: 'user@test.com', name: 'User' } })
        });
      }
      if (url === '/api/logs') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, logs: [] })
        });
      }
      if (url === '/api/telegram-configs') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, configs: [] })
        });
      }
      if (url === '/api/share/status') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, shareCode: 'INSU-1234', members: [], sharedGroups: [] })
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ success: true })
      });
    });

    render(<App />);

    // Open drawer to navigate to Settings tab
    const menuBtn = screen.getByRole('button', { name: /open navigation menu/i });
    fireEvent.click(menuBtn);

    const settingsTabBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsTabBtn);

    // Verify Theme card heading does NOT exist in Settings
    expect(screen.queryByRole('heading', { level: 2, name: 'Theme' })).not.toBeInTheDocument();
  });
});
