import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../App';
import { authService } from '../authService';
import * as pwa from '../pwa';

describe('App Component - Home & Logs UI Tests', () => {
  const mockLogs = [
    {
      id: 2,
      injected_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      notify_10m_at: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      notify_2h_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      notify_3h_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status_10m_sent: 1,
      status_2h_sent: 0,
      status_3h_sent: 0
    },
    {
      id: 1,
      injected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (1h gap => rapid dose)
      notify_10m_at: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      notify_2h_at: new Date(Date.now()).toISOString(),
      notify_3h_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status_10m_sent: 1,
      status_2h_sent: 0,
      status_3h_sent: 0
    }
  ];

  const mockUser = { id: 1, email: 'patient@health.org', name: 'Test Patient' };

  beforeEach(() => {
    localStorage.clear();
    authService.setSession('test-token', mockUser);
    window.history.pushState({}, '', '/');

    globalThis.fetch = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/auth/me') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, user: mockUser })
        });
      }
      if (url === '/api/auth/profile') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, user: mockUser })
        });
      }
      if (url === '/api/logs') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, logs: mockLogs })
        });
      }
      if (url === '/api/settings') {
        if (options && options.method === 'POST') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, settings: { telegramBotToken: '', telegramChatId: '' } })
        });
      }
      if (url === '/api/telegram-configs') {
        if (options && options.method === 'POST') {
          const body = JSON.parse(options.body);
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              config: {
                id: 101,
                name: body.name || `Chat (${body.chatId})`,
                botToken: body.botToken,
                chatId: body.chatId,
                isDefault: true
              }
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, configs: [] })
        });
      }
      if (typeof url === 'string' && url.includes('/api/telegram-configs/') && options && (options.method === 'PUT' || options.method === 'DELETE')) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true })
        });
      }
      if (url === '/api/telegram/test') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, message: 'Test message sent successfully!' })
        });
      }
      if (url.startsWith('/version.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            version: '1.0.0',
            buildTime: '2026-10-16T15:00:00Z',
            changes: { en: [] }
          })
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  afterEach(() => {
    authService.clearSession();
    vi.restoreAllMocks();
  });

  describe('Home Page UI', () => {
    it('renders the Live Clock display', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTitle('Current Local Time')).toBeInTheDocument();
      });
    });

    it('displays Telegram alert card when Telegram is unconfigured', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Telegram not configured/i)).toBeInTheDocument();
        expect(screen.getByText(/Go to Settings to set it up/i)).toBeInTheDocument();
      });
    });

    it('hides Telegram alert card when Telegram is configured', async () => {
      localStorage.setItem('insuminder_telegram_bot_token', '123456:ABC-DEF');
      localStorage.setItem('insuminder_telegram_chat_id', '987654321');

      render(<App />);

      await waitFor(() => {
        expect(screen.queryByText(/Telegram not configured/i)).not.toBeInTheDocument();
      });
    });

    it('renders the Log Injection primary button', async () => {
      render(<App />);

      await waitFor(() => {
        const btn = document.querySelector('.log-injection-btn');
        expect(btn).toBeInTheDocument();
      });
    });

    it('displays dashboard tiles for Daily Injections and Last Injection', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Daily Injections')).toBeInTheDocument();
        expect(screen.getByText('Last Injection')).toBeInTheDocument();
      });
    });

    it('scopes Daily Injections tile and sidebar badge to today while Weekly Injections shows week total', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const multiDayLogs = [
        {
          id: 3,
          injected_at: new Date().toISOString(), // today
          notify_10m_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          notify_2h_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          notify_3h_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          status_10m_sent: 0,
          status_2h_sent: 0,
          status_3h_sent: 0
        },
        {
          id: 2,
          injected_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // today
          notify_10m_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          notify_2h_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
          notify_3h_at: new Date(Date.now() + 150 * 60 * 1000).toISOString(),
          status_10m_sent: 1,
          status_2h_sent: 0,
          status_3h_sent: 0
        },
        {
          id: 1,
          injected_at: yesterday.toISOString(), // yesterday
          notify_10m_at: new Date(yesterday.getTime() + 10 * 60 * 1000).toISOString(),
          notify_2h_at: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          notify_3h_at: new Date(yesterday.getTime() + 3 * 60 * 60 * 1000).toISOString(),
          status_10m_sent: 1,
          status_2h_sent: 1,
          status_3h_sent: 1
        }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, logs: multiDayLogs })
          });
        }
        if (url === '/api/settings') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, settings: {} })
          });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, configs: [] })
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      // Daily Injections tile on Home shows 2 (only doses from today)
      await waitFor(() => {
        expect(screen.getByText('Daily Injections')).toBeInTheDocument();
      });

      // Sidebar badge shows 2 (daily count), not 3 (total)
      await waitFor(() => {
        const sidebarBadge = document.querySelector('.nav-item .badge');
        expect(sidebarBadge).toHaveTextContent('2');
      });

      // Navigate to logs: verify top Total Injections banner is gone and weekly chart is present
      const dailyCard = screen.getByTitle('View daily logs');
      fireEvent.click(dailyCard);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Injection Logs' })).toBeInTheDocument();
        expect(screen.queryByText('Total Injections')).not.toBeInTheDocument();
        expect(screen.getByText('Weekly Injections')).toBeInTheDocument();
        expect(screen.getByText('week total')).toBeInTheDocument();
      });
    });

    it('renders 10-Minute Meal, 2-Hour, and 3-Hour Scheduled Notifications cards', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Notifications Scheduled')).toBeInTheDocument();
        expect(screen.getByText('10-Minute Meal Reminder')).toBeInTheDocument();
        expect(screen.getByText('2-Hour Reminder')).toBeInTheDocument();
        expect(screen.getByText('3-Hour Reminder')).toBeInTheDocument();
      });
    });

    it('displays the 3-Hour Injection Eligibility card with lock countdown when under 3h', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Wait Before Injecting/i)).toBeInTheDocument();
        expect(screen.getByText(/You cannot inject yet/i)).toBeInTheDocument();
      });
    });

    it('displays Ready to Inject when no injections exist or > 3h have passed', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, logs: [] })
          });
        }
        if (url === '/api/settings') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, settings: {} })
          });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, configs: [] })
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Ready to Inject/i)).toBeInTheDocument();
        expect(screen.getByText(/You can inject now\. No previous injections have been recorded\./i)).toBeInTheDocument();
      });
    });

    it('displays the Android app installation banner on home page and dismisses when close button is clicked', async () => {
      localStorage.removeItem('insuminder_home_pwa_dismissed');

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Download InsuMinder for Android/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Download APK/i })).toBeInTheDocument();
      });

      const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
      expect(dismissBtn).toBeInTheDocument();

      fireEvent.click(dismissBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Download InsuMinder for Android/i)).not.toBeInTheDocument();
      });
      expect(localStorage.getItem('insuminder_home_pwa_dismissed')).toBe('true');
    });
  });

  describe('Dedicated URL Parameter Routing', () => {
    it('directly renders Injection Logs page when URL is /?page=logs', async () => {
      window.history.pushState({}, '', '/?page=logs');

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Injection Logs' })).toBeInTheDocument();
        expect(screen.getByText('Weekly Injections')).toBeInTheDocument();
      });
    });

    it('directly renders App Settings page when URL is /?page=settings', async () => {
      window.history.pushState({}, '', '/?page=settings');

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'App Settings' })).toBeInTheDocument();
        expect(screen.getByText('Telegram Notifications')).toBeInTheDocument();
      });
    });

    it('directly renders Notification Settings page when URL is /?page=notifications', async () => {
      window.history.pushState({}, '', '/?page=notifications');

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Notification Settings' })).toBeInTheDocument();
        expect(screen.getByText('10-Minute Meal Reminder')).toBeInTheDocument();
        expect(screen.getByText('2-Hour Glucose Check')).toBeInTheDocument();
        expect(screen.getByText('3-Hour Safe Window')).toBeInTheDocument();
        expect(screen.getByText('Daily Basal Reminder')).toBeInTheDocument();
      });
    });

    it('updates URL to /?page=logs when navigating to Injection Logs from Home', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Daily Injections')).toBeInTheDocument();
      });

      const dailyCard = screen.getByTitle('View daily logs');
      fireEvent.click(dailyCard);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Injection Logs' })).toBeInTheDocument();
        expect(window.location.search).toContain('page=logs');
      });
    });

    it('cleans URL and returns to Home when clicking Back button', async () => {
      window.history.pushState({}, '', '/?page=logs');

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Injection Logs' })).toBeInTheDocument();
      });

      const backBtn = screen.getByRole('button', { name: 'Back to Home' });
      fireEvent.click(backBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'InsuMinder' })).toBeInTheDocument();
        expect(window.location.search).not.toContain('page=logs');
      });
    });

    it('responds to browser popstate (back/forward) events', async () => {
      render(<App />);

      // Simulate browser history navigation to logs
      window.history.pushState({}, '', '/?page=logs');
      fireEvent(window, new PopStateEvent('popstate'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Injection Logs' })).toBeInTheDocument();
      });

      // Simulate browser history back to home
      window.history.pushState({}, '', '/');
      fireEvent(window, new PopStateEvent('popstate'));

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'InsuMinder' })).toBeInTheDocument();
      });
    });
  });

  describe('Injection Logs Page UI Components', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/?page=logs');
    });

    it('renders Latest Injection tile with reminder pills and toggle accordion', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/10m Meal Reminder:/i)).toBeInTheDocument();
        expect(screen.getByText(/2-Hour Reminder:/i)).toBeInTheDocument();
        expect(screen.getByText(/3-Hour Reminder:/i)).toBeInTheDocument();
      });

      // Expand accordion
      const header = screen.getByTitle('Latest Injection');
      fireEvent.click(header);

      await waitFor(() => {
        expect(screen.getByText('10m Meal Target:')).toBeInTheDocument();
        expect(screen.getByText('2h Target Time:')).toBeInTheDocument();
        expect(screen.getByText('3h Target Time:')).toBeInTheDocument();
      });
    });

    it('displays "Sent" only when status_sent is 1, and "Not Sent" with error tooltip on delivery failure', async () => {
      const pastTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const statusMockLogs = [
        {
          id: 99,
          injected_at: pastTime,
          notify_10m_at: new Date(Date.now() - 3.8 * 60 * 60 * 1000).toISOString(),
          notify_2h_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          notify_3h_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          status_10m_sent: 1,
          status_2h_sent: 1,
          status_3h_sent: 0,
          error_3h: 'Bad Request: chat not found'
        }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, logs: statusMockLogs })
          });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, configs: [{ id: 1, name: 'Main', botToken: 'tok', chatId: '123', isDefault: true }] })
          });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      // On Logs tab: 10m and 2h are Sent, 3h is Not Sent
      await waitFor(() => {
        expect(screen.getByText('10m Meal Reminder: Sent')).toBeInTheDocument();
        expect(screen.getByText('2-Hour Reminder: Sent')).toBeInTheDocument();
        const failedPill = screen.getByText('3-Hour Reminder: Not Sent');
        expect(failedPill).toBeInTheDocument();
        expect(failedPill.closest('.latest-reminder-pill')).toHaveAttribute('title', expect.stringContaining('bot token or chat ID'));
      });

      // Navigate back to Home tab via back button
      const backBtn = screen.getByRole('button', { name: /back to home/i });
      fireEvent.click(backBtn);

      // On Home tab: check badges and tooltips
      await waitFor(() => {
        const sentBadges = screen.getAllByText('Sent');
        expect(sentBadges).toHaveLength(2);
        expect(sentBadges[0]).toHaveAttribute('title', 'Reminder delivered to Telegram.');

        const notSentBadge = screen.getByText('Not Sent');
        expect(notSentBadge).toBeInTheDocument();
        expect(notSentBadge).toHaveAttribute('title', expect.stringContaining('bot token or chat ID'));
      });

      // Click Not Sent button to open details modal
      const notSentBtn = screen.getByText('Not Sent');
      fireEvent.click(notSentBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 3, name: '3-Hour Reminder' })).toBeInTheDocument();
        expect(screen.getByText('Telegram Configuration Issue')).toBeInTheDocument();
        expect(screen.getByText(/bot token or chat ID is invalid, missing, or could not be found/i)).toBeInTheDocument();
      });

      // Close modal using Close button
      const closeBtn = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByRole('heading', { level: 3, name: '3-Hour Reminder' })).not.toBeInTheDocument();
      });

      // Click 10-Minute Meal Reminder Sent button to open details modal
      const mealSentBtn = screen.getByRole('button', { name: /10-Minute Meal Reminder: Sent/i });
      fireEvent.click(mealSentBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 3, name: '10-Minute Meal Reminder' })).toBeInTheDocument();
        expect(screen.getByText(/Sent successfully to your configured Telegram destination/i)).toBeInTheDocument();
      });

      // Close modal using top-right '×' button
      const closeXBtn = screen.getByRole('button', { name: 'Close modal' });
      fireEvent.click(closeXBtn);

      await waitFor(() => {
        expect(screen.queryByRole('heading', { level: 3, name: '10-Minute Meal Reminder' })).not.toBeInTheDocument();
      });
    });

    it('renders Israeli Calendar Weekly Injections chart (Sun-Sat) with week navigation', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Weekly Injections')).toBeInTheDocument();
        // Check days of Israeli week
        expect(screen.getByText('Sun')).toBeInTheDocument();
        expect(screen.getByText('Mon')).toBeInTheDocument();
        expect(screen.getByText('Tue')).toBeInTheDocument();
        expect(screen.getByText('Wed')).toBeInTheDocument();
        expect(screen.getByText('Thu')).toBeInTheDocument();
        expect(screen.getByText('Fri')).toBeInTheDocument();
        expect(screen.getByText('Sat')).toBeInTheDocument();
      });

      // Test navigation controls
      const nextWeekBtn = screen.getByRole('button', { name: 'Next Week' });
      fireEvent.click(nextWeekBtn);

      const prevWeekBtn = screen.getByRole('button', { name: 'Previous Week' });
      fireEvent.click(prevWeekBtn);
    });

    it('displays Rapid Injection Trend warning for doses logged under 3 hours', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Rapid Injection Trend')).toBeInTheDocument();
        expect(screen.getByText(/recorded today less than 3 hours after a prior injection/i)).toBeInTheDocument();
        expect(screen.getByText(/after prior dose/i)).toBeInTheDocument();
      });
    });

    it('displays default safe view in Rapid Injection Trend if rapid doses were from yesterday', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayLog1 = {
        id: 101,
        injected_at: new Date(yesterday.getTime() - 60 * 60 * 1000).toISOString(),
        notify_10m_at: new Date(yesterday.getTime() - 50 * 60 * 1000).toISOString(),
        notify_2h_at: new Date(yesterday.getTime() + 60 * 60 * 1000).toISOString(),
        notify_3h_at: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        status_10m_sent: 1,
        status_2h_sent: 1,
        status_3h_sent: 1
      };
      const yesterdayLog2 = {
        id: 102,
        injected_at: yesterday.toISOString(), // 1h gap => rapid dose yesterday
        notify_10m_at: new Date(yesterday.getTime() + 10 * 60 * 1000).toISOString(),
        notify_2h_at: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        notify_3h_at: new Date(yesterday.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        status_10m_sent: 1,
        status_2h_sent: 1,
        status_3h_sent: 1
      };

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, logs: [yesterdayLog2, yesterdayLog1] })
          });
        }
        if (url === '/api/settings') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, settings: {} })
          });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, configs: [] })
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Rapid Injection Trend')).toBeInTheDocument();
        expect(screen.getByText(/All recorded injections today have maintained the recommended 3\+ hour spacing/i)).toBeInTheDocument();
        expect(screen.queryByText(/recorded today less than 3 hours/i)).not.toBeInTheDocument();
      });
    });

    it('displays Today\'s Injections daily list', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Today's Injections")).toBeInTheDocument();
      });
    });

    it('renders empty state when no injections are recorded at all', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, logs: [] })
          });
        }
        if (url === '/api/settings') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, settings: {} })
          });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, configs: [] })
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('No injections logged yet.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go to Home to Log' })).toBeInTheDocument();
      });
    });
  });

  describe('Settings Page UI & Telegram Integration', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/?page=settings');
    });

    it('renders Telegram settings form and language options', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Telegram Notifications')).toBeInTheDocument();
        expect(screen.getByLabelText(/Bot Token/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Chat ID/i)).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /Save/i }).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('button', { name: /Send Test Notification/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /עברית/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Русский/i })).toBeInTheDocument();
      });
    });

    it('disables Send Test Notification when Bot Token or Chat ID is empty', async () => {
      render(<App />);

      await waitFor(() => {
        const testBtn = screen.getByRole('button', { name: /Send Test Notification/i });
        expect(testBtn).toBeDisabled();
      });
    });

    it('enables Send Test Notification and sends test message when fields are populated', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Bot Token/i)).toBeInTheDocument();
      });

      const tokenInput = screen.getByLabelText(/Bot Token/i);
      const chatIdInput = screen.getByLabelText(/Chat ID/i);
      const testBtn = screen.getByRole('button', { name: /Send Test Notification/i });

      fireEvent.change(tokenInput, { target: { value: '12345:TOKEN' } });
      fireEvent.change(chatIdInput, { target: { value: '98765432' } });

      expect(testBtn).not.toBeDisabled();
      fireEvent.click(testBtn);

      await waitFor(() => {
        expect(screen.getByText(/Test notification sent! Check your Telegram chat./i)).toBeInTheDocument();
      });
    });

    it('submits and saves Telegram settings to the backend and clears inputs', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Bot Token/i)).toBeInTheDocument();
      });

      const labelInput = screen.getByLabelText(/Configuration Name/i);
      const tokenInput = screen.getByLabelText(/Bot Token/i);
      const chatIdInput = screen.getByLabelText(/Chat ID/i);
      const saveBtn = screen.getByRole('button', { name: /Save & Set as Default/i });

      fireEvent.change(labelInput, { target: { value: 'My Phone' } });
      fireEvent.change(tokenInput, { target: { value: '12345:NEW_TOKEN' } });
      fireEvent.change(chatIdInput, { target: { value: '98765432' } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Telegram configuration saved and set as default!/i)).toBeInTheDocument();
      });

      // Inputs must be cleared immediately after saving
      expect(labelInput.value).toBe('');
      expect(tokenInput.value).toBe('');
      expect(chatIdInput.value).toBe('');
    });

    it('keeps form inputs empty upon page refresh/remount even when default configs exist', async () => {
      const mockSavedConfigs = [
        { id: 1, name: 'Personal Bot', botToken: '1111:TOKEN_A', chatId: '12345678', isDefault: true }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: mockLogs }) });
        }
        if (url === '/api/settings') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, settings: {} }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: mockSavedConfigs }) });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      // Simulate existing cache in localStorage
      localStorage.setItem('insuminder_telegram_configs', JSON.stringify(mockSavedConfigs));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Saved Configurations')).toBeInTheDocument();
        expect(screen.getByText('Personal Bot')).toBeInTheDocument();
      });

      const labelInput = screen.getByLabelText(/Configuration Name/i);
      const tokenInput = screen.getByLabelText(/Bot Token/i);
      const chatIdInput = screen.getByLabelText(/Chat ID/i);

      // Verify input fields remain empty, not repopulated with default config credentials
      expect(labelInput.value).toBe('');
      expect(tokenInput.value).toBe('');
      expect(chatIdInput.value).toBe('');
    });

    it('displays error notification when test telegram call fails', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, logs: mockLogs })
          });
        }
        if (url === '/api/settings') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, settings: {} })
          });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: true, configs: [] })
          });
        }
        if (url === '/api/telegram/test') {
          return Promise.resolve({
            json: () => Promise.resolve({ success: false, error: 'Unauthorized: invalid bot token' })
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Bot Token/i)).toBeInTheDocument();
      });

      const tokenInput = screen.getByLabelText(/Bot Token/i);
      const chatIdInput = screen.getByLabelText(/Chat ID/i);
      const testBtn = screen.getByRole('button', { name: /Send Test Notification/i });

      fireEvent.change(tokenInput, { target: { value: 'bad:token' } });
      fireEvent.change(chatIdInput, { target: { value: 'bad_chat' } });
      fireEvent.click(testBtn);

      await waitFor(() => {
        expect(screen.getByText(/Telegram test failed: Unauthorized: invalid bot token/i)).toBeInTheDocument();
      });
    });

    it('renders saved configurations list with radio buttons and default badge', async () => {
      const mockConfigs = [
        { id: 1, name: 'Personal Bot', botToken: '1111:TOKEN_A', chatId: '12345678', isDefault: true },
        { id: 2, name: 'Channel Alerts', botToken: '2222:TOKEN_B', chatId: '-1004304245048', isDefault: false }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: mockLogs }) });
        }
        if (url === '/api/settings') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, settings: {} }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: mockConfigs }) });
        }
        if (url === '/api/telegram-configs/2/default' && options && options.method === 'PUT') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Saved Configurations')).toBeInTheDocument();
        expect(screen.getByText('Personal Bot')).toBeInTheDocument();
        expect(screen.getByText('Channel Alerts')).toBeInTheDocument();
        expect(screen.getByText('DEFAULT')).toBeInTheDocument();
      });

      // Switch default to config 2
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();

      fireEvent.click(radios[1]);

      await waitFor(() => {
        expect(screen.getByText(/Default notification destination updated!/i)).toBeInTheDocument();
      });
    });

    it('opens delete confirmation modal when clicking delete and allows canceling or confirming', async () => {
      const mockConfigs = [
        { id: 1, name: 'Personal Bot', botToken: '1111:TOKEN_A', chatId: '12345678', isDefault: true }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: mockLogs }) });
        }
        if (url === '/api/settings') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, settings: {} }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: mockConfigs }) });
        }
        if (url === '/api/telegram-configs/1' && options && options.method === 'DELETE') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Personal Bot')).toBeInTheDocument();
      });

      // Click delete button
      const deleteBtn = screen.getByRole('button', { name: /Delete Personal Bot/i });
      fireEvent.click(deleteBtn);

      // Verify modal is shown
      await waitFor(() => {
        expect(screen.getByText('Delete Telegram Configuration?')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete Configuration' })).toBeInTheDocument();
      });

      // Cancel closes modal
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByText('Delete Telegram Configuration?')).not.toBeInTheDocument();
      });

      // Open modal again and confirm delete
      fireEvent.click(screen.getByRole('button', { name: /Delete Personal Bot/i }));
      await waitFor(() => {
        expect(screen.getByText('Delete Telegram Configuration?')).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole('button', { name: 'Delete Configuration' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/Configuration "Personal Bot" deleted successfully\./i)).toBeInTheDocument();
      });
    });

    it('renders unnamed config with single Chat ID and DEFAULT badge right next to it', async () => {
      const mockConfigs = [
        { id: 1, name: 'Chat (-4304245048)', botToken: '12345:TOKEN', chatId: '-4304245048', isDefault: true }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: mockLogs }) });
        }
        if (url === '/api/settings') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, settings: {} }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: mockConfigs }) });
        }
        if (url === '/api/telegram-configs/1' && options && options.method === 'DELETE') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Saved Configurations')).toBeInTheDocument();
        expect(screen.getByText('-4304245048')).toBeInTheDocument();
        expect(screen.getByText('DEFAULT')).toBeInTheDocument();
      });

      // Verify Chat ID is not duplicated in card
      const chatTexts = screen.getAllByText(/-4304245048/);
      expect(chatTexts).toHaveLength(1);

      // Verify delete button and modal text without duplicate
      const deleteBtn = screen.getByRole('button', { name: /Delete configuration for -4304245048/i });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete configuration for chat/i)).toBeInTheDocument();
      });
    });

    it('renders an active toggle switch instead of test button for saved configs, and toggles config status', async () => {
      let toggledBody = null;
      const mockConfigs = [
        { id: 10, name: 'Main Bot', botToken: '12345:TOKEN', chatId: '-4304245048', isDefault: true, isActive: true }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url, options) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: mockLogs }) });
        }
        if (url === '/api/settings') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, settings: {} }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: mockConfigs }) });
        }
        if (url === '/api/telegram-configs/10/toggle' && options && options.method === 'PUT') {
          toggledBody = JSON.parse(options.body);
          return Promise.resolve({ json: () => Promise.resolve({ success: true, config: { ...mockConfigs[0], isActive: toggledBody.isActive } }) });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Saved Configurations')).toBeInTheDocument();
        expect(screen.getByText('Main Bot')).toBeInTheDocument();
      });

      // Assert row test button does NOT exist
      const configItem = screen.getByText('Main Bot').closest('li');
      expect(configItem).toBeInTheDocument();
      expect(within(configItem).queryByRole('button', { name: /^Test$/i })).not.toBeInTheDocument();

      // Assert toggle switch exists and is checked (active)
      const toggleSwitch = within(configItem).getByRole('switch');
      expect(toggleSwitch).toBeInTheDocument();
      expect(toggleSwitch).toHaveAttribute('aria-checked', 'true');

      // Click toggle switch to turn OFF
      fireEvent.click(toggleSwitch);

      await waitFor(() => {
        expect(toggledBody).toEqual({ isActive: false });
      });
    });
  });

  describe('Basal Insulin & 24h Time Schedule UI', () => {
    it('renders Basal Insulin Schedule card in Settings with 24-hour time picker and Save button', async () => {
      window.history.pushState({}, '', '/?page=settings');
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [] }) });
        if (url === '/api/settings') return Promise.resolve({ json: () => Promise.resolve({ success: true, settings: {} }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Basal Insulin Time')).toBeInTheDocument();
        expect(screen.getByText(/Scheduled daily time when nighttime Basal option becomes available/i)).toBeInTheDocument();
        // Time picker button
        expect(screen.getByRole('button', { name: /Time: 20:00/i })).toBeInTheDocument();
        // Save button for basal time
        expect(document.querySelector('.basal-save-btn')).toBeInTheDocument();
      });
    });

    it('renders split Bolus and Basal buttons when after basal time and basal not logged today', async () => {
      // User with basal_time 00:00 so it is guaranteed to be after basal time
      const nightUser = { id: 1, email: 'patient@health.org', name: 'Test Patient', basalTime: '00:00' };
      authService.setSession('test-token', nightUser);
      window.history.pushState({}, '', '/');

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: nightUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [] }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Bolus Insulin')).toBeInTheDocument();
        expect(screen.getByText('Basal Insulin')).toBeInTheDocument();
      });
    });

    it('renders single Log Injection button when before basal time', async () => {
      // User with basal_time 23:59 (almost end of day, practically always before)
      const daytimeUser = { id: 1, email: 'patient@health.org', name: 'Test Patient', basalTime: '23:59' };
      authService.setSession('test-token', daytimeUser);
      window.history.pushState({}, '', '/');

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: daytimeUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [] }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Log Injection')).toBeInTheDocument();
        expect(screen.queryByText('Log Basal Insulin')).not.toBeInTheDocument();
      });
    });

    it('reverts split button to single button after basal insulin has been logged today', async () => {
      const nightUser = { id: 1, email: 'patient@health.org', name: 'Test Patient', basalTime: '00:00' };
      authService.setSession('test-token', nightUser);
      window.history.pushState({}, '', '/');

      // Logs include a basal log today
      const logsWithBasal = [
        {
          id: 5,
          injected_at: new Date().toISOString(),
          type: 'basal',
          notify_10m_at: new Date().toISOString(),
          notify_2h_at: new Date().toISOString(),
          notify_3h_at: new Date().toISOString()
        }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: nightUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: logsWithBasal }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Log Injection/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Log Basal Insulin/i })).not.toBeInTheDocument();
      });
    });

    it('renders Bolus and Basal metric chips and stacked bar chart on Injection Logs tab', async () => {
      window.history.pushState({}, '', '/?page=logs');
      const testLogs = [
        { id: 10, injected_at: new Date().toISOString(), type: 'bolus' },
        { id: 11, injected_at: new Date().toISOString(), type: 'basal' }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: testLogs }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Bolus this week:')).toBeInTheDocument();
        expect(screen.getByText('Basal this week:')).toBeInTheDocument();
        expect(document.querySelector('.bar-segment-basal')).toBeInTheDocument();
        expect(document.querySelector('.bar-segment-bolus')).toBeInTheDocument();
      });
    });
  });

  describe('Early Bolus Injection Guard & Gray Button', () => {
    it('applies btn-gray class to Bolus button when less than 3 hours passed since last bolus injection', async () => {
      window.history.pushState({}, '', '/');
      const recentLogs = [
        {
          id: 101,
          injected_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
          type: 'bolus',
          notify_3h_at: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString()
        }
      ];

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: recentLogs }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        const btn = document.querySelector('.log-injection-btn');
        expect(btn).toBeInTheDocument();
        expect(btn.classList.contains('btn-gray')).toBe(true);
      });
    });

    it('opens early injection confirmation modal when clicking gray Bolus button, and dismisses on No', async () => {
      window.history.pushState({}, '', '/');
      const recentLogs = [
        {
          id: 102,
          injected_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          type: 'bolus',
          notify_3h_at: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString()
        }
      ];

      let injectionCalled = false;
      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: recentLogs }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        if (url === '/api/injections' && opts?.method === 'POST') {
          injectionCalled = true;
          return Promise.resolve({ json: () => Promise.resolve({ success: true, id: 103 }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /(?:Log Injection|Bolus)/i });
        expect(btn.classList.contains('btn-gray')).toBe(true);
      });

      const bolusBtn = screen.getByRole('button', { name: /(?:Log Injection|Bolus)/i });
      fireEvent.click(bolusBtn);

      // Confirmation modal should be visible
      expect(await screen.findByText('Early Injection Confirmation')).toBeInTheDocument();
      expect(screen.getByText(/Less than 3 hours have passed since your previous injection/i)).toBeInTheDocument();

      // Click "No" button
      const noBtn = screen.getByRole('button', { name: /^No$/i });
      fireEvent.click(noBtn);

      // Modal closes and no injection was posted
      await waitFor(() => {
        expect(screen.queryByText('Early Injection Confirmation')).not.toBeInTheDocument();
      });
      expect(injectionCalled).toBe(false);
    });

    it('logs injection and closes modal when confirming Yes in early injection modal', async () => {
      window.history.pushState({}, '', '/');
      const recentLogs = [
        {
          id: 104,
          injected_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          type: 'bolus',
          notify_3h_at: new Date(Date.now() + 2.25 * 60 * 60 * 1000).toISOString()
        }
      ];

      let injectionCalled = false;
      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: recentLogs }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        if (url === '/api/injections' && opts?.method === 'POST') {
          injectionCalled = true;
          return Promise.resolve({ json: () => Promise.resolve({ success: true, id: 105 }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /(?:Log Injection|Bolus)/i });
        expect(btn.classList.contains('btn-gray')).toBe(true);
      });

      const bolusBtn = screen.getByRole('button', { name: /(?:Log Injection|Bolus)/i });
      fireEvent.click(bolusBtn);

      expect(await screen.findByText('Early Injection Confirmation')).toBeInTheDocument();

      // Click "Yes" button
      const yesBtn = screen.getByRole('button', { name: /^Yes$/i });
      fireEvent.click(yesBtn);

      await waitFor(() => {
        expect(injectionCalled).toBe(true);
        expect(screen.queryByText('Early Injection Confirmation')).not.toBeInTheDocument();
      });
    });

    it('does not apply btn-gray to Basal button in split mode and Basal injects directly', async () => {
      const nightUser = { id: 1, email: 'patient@health.org', name: 'Test Patient', basalTime: '00:00' };
      authService.setSession('test-token', nightUser);
      window.history.pushState({}, '', '/');

      // Recent bolus injection logged 10m ago
      const recentBolus = [
        {
          id: 201,
          injected_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          type: 'bolus',
          notify_3h_at: new Date(Date.now() + 2.8 * 60 * 60 * 1000).toISOString()
        }
      ];

      let injectionPayload = null;
      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: nightUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: recentBolus }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        if (url === '/api/injections' && opts?.method === 'POST') {
          injectionPayload = JSON.parse(opts.body);
          return Promise.resolve({ json: () => Promise.resolve({ success: true, id: 202 }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      // Wait for split buttons
      const basalBtn = await screen.findByRole('button', { name: /Basal Insulin/i });
      const bolusSplitBtn = screen.getByRole('button', { name: /Bolus Insulin/i });

      // Wait for async logs fetch to update bolus eligibility (Bolus becomes gray, Basal is NOT gray)
      await waitFor(() => {
        expect(bolusSplitBtn.classList.contains('btn-gray')).toBe(true);
      });
      expect(basalBtn.classList.contains('btn-gray')).toBe(false);

      // Clicking Basal logs directly without opening early modal
      fireEvent.click(basalBtn);

      await waitFor(() => {
        expect(injectionPayload).toEqual({ type: 'basal' });
        expect(screen.queryByText('Early Injection Confirmation')).not.toBeInTheDocument();
      });
    });
  });

  describe('Local Dev Notification Queue Clearing Button', () => {
    it('renders dev-clear-queue-btn on home tab in local dev environment and clears queue', async () => {
      let clearCalled = false;
      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url === '/api/auth/me') return Promise.resolve({ json: () => Promise.resolve({ success: true, user: mockUser }) });
        if (url === '/api/logs') return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: mockLogs }) });
        if (url === '/api/telegram-configs') return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        if (url === '/api/dev/clear-notifications' && opts?.method === 'POST') {
          clearCalled = true;
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, message: 'Queue cleared' }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      const devClearBtn = await screen.findByRole('button', { name: /Clear pending notification queue/i });
      expect(devClearBtn).toBeInTheDocument();
      expect(devClearBtn.classList.contains('dev-clear-queue-btn')).toBe(true);

      fireEvent.click(devClearBtn);

      await waitFor(() => {
        expect(clearCalled).toBe(true);
        expect(screen.getByText(/Notification queue cleared/i)).toBeInTheDocument();
      });
    });
  });

  describe('Notification Preferences & Settings UI', () => {
    it('allows toggling individual reminders, switches scopes, and updates localStorage', async () => {
      window.history.pushState({}, '', '/?page=notifications');
      localStorage.removeItem('insuminder_notification_prefs');

      render(<App />);

      await screen.findByRole('heading', { level: 1, name: 'Notification Settings' });

      // Find switch for 10-Minute Meal Reminder
      const mealSwitch = screen.getByRole('switch', { name: '10-Minute Meal Reminder' });
      expect(mealSwitch).toHaveAttribute('aria-checked', 'true');

      // Click to toggle off
      fireEvent.click(mealSwitch);

      await waitFor(() => {
        expect(mealSwitch).toHaveAttribute('aria-checked', 'false');
        const stored = JSON.parse(localStorage.getItem('insuminder_notification_prefs') || '{}');
        expect(stored.personal?.rem10m).toBe(false);
      });

      // Switch to Shared Data scope
      const sharedTabBtn = screen.getByRole('tab', { name: /Shared Data/i });
      fireEvent.click(sharedTabBtn);

      const sharedMealSwitch = screen.getByRole('switch', { name: '10-Minute Meal Reminder' });
      expect(sharedMealSwitch).toHaveAttribute('aria-checked', 'true');

      // Toggle off in shared scope
      fireEvent.click(sharedMealSwitch);
      await waitFor(() => {
        expect(sharedMealSwitch).toHaveAttribute('aria-checked', 'false');
        const stored = JSON.parse(localStorage.getItem('insuminder_notification_prefs') || '{}');
        expect(stored.shared?.rem10m).toBe(false);
      });
    });

    it('shows disabled status pill when reminder is disabled in settings, and opens modal with shortcut button', async () => {
      localStorage.setItem('insuminder_notification_prefs', JSON.stringify({
        personal: { rem10m: true, rem2h: false, rem3h: true, basal: true },
        shared: { rem10m: true, rem2h: true, rem3h: true, basal: true }
      }));
      window.history.pushState({}, '', '/');

      render(<App />);

      // Wait for home page to render
      await screen.findByText('Daily Injections');

      // Check the latest reminder pill for 2h reminder
      const disabledBadge = await screen.findByRole('button', { name: /2-Hour Reminder: Disabled in settings/i });
      expect(disabledBadge).toBeInTheDocument();
      expect(disabledBadge.textContent).toContain('Disabled in settings');

      // Click the disabled pill to open modal
      fireEvent.click(disabledBadge);

      // Verify modal content
      expect(await screen.findByRole('heading', { level: 3, name: '2-Hour Reminder' })).toBeInTheDocument();
      expect(screen.getByText('This reminder is disabled in Notification Settings and will not be sent.')).toBeInTheDocument();

      // Click shortcut button to jump to Notification Settings
      const shortcutBtn = screen.getByRole('button', { name: /Open Notification Settings/i });
      fireEvent.click(shortcutBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Notification Settings' })).toBeInTheDocument();
        expect(window.location.search).toContain('page=notifications');
      });
    });
  });

  describe('Android App Installation Multi-Placement & Hiding on Web', () => {
    beforeEach(() => {
      localStorage.clear();
      window.history.pushState({}, '', '/');
    });

    afterEach(() => {
      localStorage.clear();
      vi.restoreAllMocks();
    });

    it('renders Android installation button in sidebar, banner at bottom of mainpage, and card in settings when on web', async () => {
      render(<App />);

      // 1. Mainpage bottom banner
      expect(await screen.findByText('Download InsuMinder for Android')).toBeInTheDocument();
      expect(screen.getByText(/Download the clean, verified Android app/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Download APK/i })).toBeInTheDocument();

      // 2. Sidebar Navigation Drawer button
      expect(screen.getByRole('button', { name: /Download Android App/i, hidden: true })).toBeInTheDocument();

      // 3. Navigate to Settings Tab
      const settingsNavBtn = screen.getByRole('button', { name: /App Settings/i, hidden: true });
      fireEvent.click(settingsNavBtn);

      // Verify Android installation card in Settings
      expect(await screen.findByRole('heading', { level: 2, name: /Download Android App/i })).toBeInTheDocument();
    });

    it('dismisses the mainpage Android banner when clicking dismiss button', async () => {
      render(<App />);

      expect(await screen.findByText('Download InsuMinder for Android')).toBeInTheDocument();
      const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
      fireEvent.click(dismissBtn);

      await waitFor(() => {
        expect(screen.queryByText('Download InsuMinder for Android')).not.toBeInTheDocument();
      });
      expect(localStorage.getItem('insuminder_home_pwa_dismissed')).toBe('true');
    });

    it('opens Android APK download modal when clicking download button', async () => {
      render(<App />);

      const downloadBtn = await screen.findByRole('button', { name: /Download APK/i });
      fireEvent.click(downloadBtn);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /InsuMinder for Android/i })).toBeInTheDocument();
      expect(screen.getByText(/Download Started/i)).toBeInTheDocument();

      // Dismiss modal
      const gotItBtn = screen.getByRole('button', { name: 'Got It' });
      fireEvent.click(gotItBtn);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('hides all Android installation buttons and cards when app is already installed or standalone', async () => {
      vi.spyOn(pwa, 'isStandaloneApp').mockReturnValue(true);

      render(<App />);

      await screen.findByRole('heading', { level: 1, name: 'InsuMinder' });

      // Assert banner on mainpage is hidden
      expect(screen.queryByText('Download InsuMinder for Android')).not.toBeInTheDocument();

      // Assert sidebar install button is hidden
      expect(screen.queryByRole('button', { name: /Download Android App/i, hidden: true })).not.toBeInTheDocument();

      // Navigate to Settings
      const settingsNavBtn = screen.getByRole('button', { name: /App Settings/i, hidden: true });
      fireEvent.click(settingsNavBtn);

      await waitFor(() => {
        expect(screen.getByText('Language')).toBeInTheDocument();
      });

    });
  });

  describe('App Versioning & About Card UI', () => {
    it('displays app version in the footer, nav drawer, and About card in Settings', async () => {
      render(<App />);

      // 1. Verify app footer version
      expect(screen.getByText(/Dovgans • InsuMinder v1\.2\.0/i)).toBeInTheDocument();

      // 2. Verify sidebar nav drawer version
      expect(screen.getByText('InsuMinder v1.2.0')).toBeInTheDocument();

      // 3. Navigate to Settings Tab
      const settingsNavBtn = screen.getByRole('button', { name: /App Settings/i, hidden: true });
      fireEvent.click(settingsNavBtn);

      // Verify About InsuMinder card
      expect(await screen.findByRole('heading', { level: 2, name: /About InsuMinder/i })).toBeInTheDocument();
      expect(screen.getByText('v1.2.0')).toBeInTheDocument();
      expect(screen.getByText('Up to Date')).toBeInTheDocument();

      // Verify "What's New in this Version" button and expandable highlights
      const whatsNewBtn = screen.getByRole('button', { name: /What's New in this Version/i });
      fireEvent.click(whatsNewBtn);

      expect(screen.getByText(/Native 1-Tap Google Sign-In/i)).toBeInTheDocument();

      // Verify "Check for Updates" button
      const checkUpdatesBtn = screen.getByRole('button', { name: /Check for Updates/i });
      fireEvent.click(checkUpdatesBtn);

      const feedbackElements = await screen.findAllByText('You are on the latest version of InsuMinder.');
      expect(feedbackElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});

