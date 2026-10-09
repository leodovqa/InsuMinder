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

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/logs') {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, logs: mockLogs })
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
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('No injections logged yet.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Go to Home to Log' })).toBeInTheDocument();
      });
    });
  });
});
