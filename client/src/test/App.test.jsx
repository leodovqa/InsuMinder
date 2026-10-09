import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

describe('App Component - Home & Logs UI Tests', () => {
  const mockLogs = [
    {
      id: 2,
      injected_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      notify_2h_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      notify_3h_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 1,
      injected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago (1h gap => rapid dose)
      notify_2h_at: new Date(Date.now()).toISOString(),
      notify_3h_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    }
  ];

  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');

    globalThis.fetch = vi.fn().mockImplementation((url, options) => {
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
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  afterEach(() => {
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
        expect(screen.getByRole('button', { name: /Log Injection/i })).toBeInTheDocument();
      });
    });

    it('displays dashboard tiles for Total Injections and Last Injection', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Total Injections')).toBeInTheDocument();
        expect(screen.getByText('Last Injection')).toBeInTheDocument();
      });
    });

    it('renders 2-Hour and 3-Hour Scheduled Notifications cards', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Notifications Scheduled')).toBeInTheDocument();
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

    it('directly renders Settings page when URL is /?page=settings', async () => {
      window.history.pushState({}, '', '/?page=settings');

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
        expect(screen.getByText('Telegram Notifications')).toBeInTheDocument();
      });
    });

    it('updates URL to /?page=logs when navigating to Injection Logs from Home', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Total Injections')).toBeInTheDocument();
      });

      const totalCard = screen.getByTitle('View all logs');
      fireEvent.click(totalCard);

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
        expect(screen.getByText(/2-Hour Reminder:/i)).toBeInTheDocument();
        expect(screen.getByText(/3-Hour Reminder:/i)).toBeInTheDocument();
      });

      // Expand accordion
      const header = screen.getByTitle('Latest Injection');
      fireEvent.click(header);

      await waitFor(() => {
        expect(screen.getByText('2h Target Time:')).toBeInTheDocument();
        expect(screen.getByText('3h Target Time:')).toBeInTheDocument();
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
        expect(screen.getByText(/recorded less than 3 hours after a prior injection/i)).toBeInTheDocument();
        expect(screen.getByText(/after prior dose/i)).toBeInTheDocument();
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
        expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Send Test Notification/i })).toBeInTheDocument();
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

    it('submits and saves Telegram settings to the backend', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Bot Token/i)).toBeInTheDocument();
      });

      const tokenInput = screen.getByLabelText(/Bot Token/i);
      const chatIdInput = screen.getByLabelText(/Chat ID/i);
      const saveBtn = screen.getByRole('button', { name: /Save & Set as Default/i });

      fireEvent.change(tokenInput, { target: { value: '12345:NEW_TOKEN' } });
      fireEvent.change(chatIdInput, { target: { value: '98765432' } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Telegram configuration saved and set as default!/i)).toBeInTheDocument();
      });
    });

    it('displays error notification when test telegram call fails', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url) => {
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
  });
});
