import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '../App';
import AuthModal from '../AuthModal';
import { authService } from '../authService';

describe('Authentication & User Experience Tests', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('authService Unit Tests', () => {
    it('stores, retrieves and clears session tokens and user data', () => {
      expect(authService.getToken()).toBeNull();
      expect(authService.getCurrentUser()).toBeNull();

      const mockUser = { id: 1, email: 'patient@example.com' };
      authService.setSession('test-token-123', mockUser);

      expect(authService.getToken()).toBe('test-token-123');
      expect(authService.getCurrentUser()).toEqual(mockUser);
      expect(authService.getAuthHeaders()['Authorization']).toBe('Bearer test-token-123');

      authService.clearSession();
      expect(authService.getToken()).toBeNull();
      expect(authService.getCurrentUser()).toBeNull();
      expect(authService.getAuthHeaders()['Authorization']).toBeUndefined();
    });

    it('sends credentials to /api/auth/login and stores session on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          token: 'jwt-like-token',
          user: { id: 42, email: 'user@med.com' }
        })
      });

      const res = await authService.login('user@med.com', 'SecurePass123!');
      expect(res.success).toBe(true);
      expect(authService.getToken()).toBe('jwt-like-token');
      expect(authService.getCurrentUser()?.email).toBe('user@med.com');
    });

    it('sends verification code to /api/auth/verify and sets session', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          token: 'verified-token',
          user: { id: 10, email: 'verified@med.com' }
        })
      });

      const res = await authService.verify('verified@med.com', '654321');
      expect(res.success).toBe(true);
      expect(authService.getToken()).toBe('verified-token');
    });
  });

  describe('AuthModal Component Tests', () => {
    it('renders Sign In and Sign Up tabs and Google authentication button', () => {
      render(<AuthModal isOpen={true} initialMode="login" onClose={vi.fn()} onSuccess={vi.fn()} />);

      expect(screen.getByRole('heading', { name: /Sign In to InsuMinder/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Sign In' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Sign Up' })).toBeInTheDocument();
    });

    it('displays exact error message when email is invalid or cannot receive emails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: false,
          error: 'This email does not exist or cannot receive emails. Please use another one.'
        })
      });

      render(<AuthModal isOpen={true} initialMode="register" onClose={vi.fn()} onSuccess={vi.fn()} />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);
      const submitBtn = screen.getByRole('button', { name: /Continue & Send Code/i });

      fireEvent.change(emailInput, { target: { value: 'invalid@nonexistent.domain' } });
      fireEvent.change(passInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('This email does not exist or cannot receive emails. Please use another one.')).toBeInTheDocument();
      });
    });

    it('advances to Step 2 with 6-digit code input and 10:00 countdown timer upon successful registration dispatch', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          message: 'Verification code sent to your email.'
        })
      });

      render(<AuthModal isOpen={true} initialMode="register" onClose={vi.fn()} onSuccess={vi.fn()} />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);
      const submitBtn = screen.getByRole('button', { name: /Continue & Send Code/i });

      fireEvent.change(emailInput, { target: { value: 'patient@clinic.com' } });
      fireEvent.change(passInput, { target: { value: 'ValidPass123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Verify Email/i)).toBeInTheDocument();
        expect(screen.getByText(/6-Digit Verification Code/i)).toBeInTheDocument();
        expect(screen.getByText(/Code expires in/i)).toBeInTheDocument();
        expect(screen.getByText('10:00')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
      });
    });

    it('displays exact expiration message when verification code expires after 10 minutes on countdown timer', () => {
      vi.useFakeTimers();

      render(<AuthModal isOpen={true} initialMode="verify" onClose={vi.fn()} onSuccess={vi.fn()} />);

      expect(screen.getByText('10:00')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(601 * 1000);
      });

      expect(screen.getByText('Verification code has expired. Please enter your email and password to start a new verification process.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start New Process/i })).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('displays exact expiration message when server rejects expired code', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: false,
          error: 'Verification code has expired. Please enter your email and password to start a new verification process.'
        })
      });

      render(<AuthModal isOpen={true} initialMode="verify" onClose={vi.fn()} onSuccess={vi.fn()} />);

      fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: /Verify & Complete Sign Up/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification code has expired. Please enter your email and password to start a new verification process.')).toBeInTheDocument();
      });
    });

    it('completes verification and invokes onSuccess when valid 6-digit code is submitted', async () => {
      const onSuccessMock = vi.fn();
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          token: 'valid-session-jwt',
          user: { id: 5, email: 'patient@clinic.com' }
        })
      });

      render(<AuthModal isOpen={true} initialMode="verify" onClose={vi.fn()} onSuccess={onSuccessMock} />);

      fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '456789' } });
      fireEvent.click(screen.getByRole('button', { name: /Verify & Complete Sign Up/i }));

      await waitFor(() => {
        expect(onSuccessMock).toHaveBeenCalledWith(expect.objectContaining({ email: 'patient@clinic.com' }));
      });
    });

    it('performs Google authentication when Continue with Google is clicked', async () => {
      const onSuccessMock = vi.fn();
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          token: 'google-session-jwt',
          user: { id: 7, email: 'google.user@example.com', name: 'Google User' }
        })
      });

      render(<AuthModal isOpen={true} initialMode="login" onClose={vi.fn()} onSuccess={onSuccessMock} />);

      const googleBtn = screen.getByRole('button', { name: /Continue with Google/i });
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(onSuccessMock).toHaveBeenCalledWith(expect.objectContaining({ email: 'google.user@example.com' }));
      });
    });

    it('does not close AuthModal on backdrop click, only when X button is clicked', () => {
      const onCloseMock = vi.fn();
      render(<AuthModal isOpen={true} initialMode="login" onClose={onCloseMock} onSuccess={vi.fn()} />);

      // Click on backdrop outside modal container
      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);
      expect(onCloseMock).not.toHaveBeenCalled();

      // Click on X button
      const closeBtn = screen.getByRole('button', { name: /Close authentication modal/i });
      fireEvent.click(closeBtn);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('clears inputs when switching between Sign In and Sign Up tabs', () => {
      render(<AuthModal isOpen={true} initialMode="login" onClose={vi.fn()} onSuccess={vi.fn()} />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);

      fireEvent.change(emailInput, { target: { value: 'patient@example.com' } });
      fireEvent.change(passInput, { target: { value: 'Secret123' } });
      expect(emailInput.value).toBe('patient@example.com');
      expect(passInput.value).toBe('Secret123');

      // Switch to Sign Up tab
      const signUpTab = screen.getByRole('tab', { name: /Sign Up/i });
      fireEvent.click(signUpTab);

      expect(emailInput.value).toBe('');
      expect(passInput.value).toBe('');
    });

    it('clears inputs when clicking Back to Email / Change Address from verification screen', () => {
      render(<AuthModal isOpen={true} initialMode="verify" onClose={vi.fn()} onSuccess={vi.fn()} />);

      const codeInput = screen.getByPlaceholderText('123456');
      fireEvent.change(codeInput, { target: { value: '123456' } });
      expect(codeInput.value).toBe('123456');

      const backBtn = screen.getByRole('button', { name: /Back to Email/i });
      fireEvent.click(backBtn);

      expect(screen.getByRole('heading', { name: /Create InsuMinder Account/i })).toBeInTheDocument();
      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);
      expect(emailInput.value).toBe('');
      expect(passInput.value).toBe('');
    });

    it('clears inputs when browser back navigation or page restore events occur', () => {
      render(<AuthModal isOpen={true} initialMode="login" onClose={vi.fn()} onSuccess={vi.fn()} />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);

      fireEvent.change(emailInput, { target: { value: 'user@clinic.org' } });
      fireEvent.change(passInput, { target: { value: 'ClinicPass123' } });

      // Trigger popstate (browser back)
      act(() => {
        window.dispatchEvent(new Event('popstate'));
      });
      expect(emailInput.value).toBe('');
      expect(passInput.value).toBe('');

      // Retype and trigger pageshow (page refresh / bfcache restore)
      fireEvent.change(emailInput, { target: { value: 'user2@clinic.org' } });
      fireEvent.change(passInput, { target: { value: 'ClinicPass456' } });
      act(() => {
        window.dispatchEvent(new Event('pageshow'));
      });
      expect(emailInput.value).toBe('');
      expect(passInput.value).toBe('');
    });

    it('clears inputs when modal closes and reopens', () => {
      const { rerender } = render(<AuthModal isOpen={true} initialMode="login" onClose={vi.fn()} onSuccess={vi.fn()} />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);

      fireEvent.change(emailInput, { target: { value: 'reopen@test.com' } });
      fireEvent.change(passInput, { target: { value: 'Reopen123' } });

      // Close modal
      rerender(<AuthModal isOpen={false} initialMode="login" onClose={vi.fn()} onSuccess={vi.fn()} />);

      // Reopen modal
      rerender(<AuthModal isOpen={true} initialMode="login" onClose={vi.fn()} onSuccess={vi.fn()} />);
      const freshEmailInput = screen.getByLabelText(/Email Address/i);
      const freshPassInput = screen.getByLabelText(/Password/i);
      expect(freshEmailInput.value).toBe('');
      expect(freshPassInput.value).toBe('');
    });
  });

  describe('Logged-Out App Experience & Scoped Access', () => {
    it('disables the Log Injection button and shows warning banner when logged out', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [] }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        const logBtn = screen.getByRole('button', { name: /Log Injection/i });
        expect(logBtn).toBeInTheDocument();
        expect(logBtn).toBeDisabled();
      });

      // Modern hero banner is displayed
      expect(screen.getByText('Sign In or Sign Up')).toBeInTheDocument();
      expect(screen.getByText(/record your injections and manage your reminders/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument();

      // Clinical / personal data tiles and notifications are strictly hidden when logged out
      expect(screen.queryByText(/Daily Injections/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Last Injection/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Notifications Scheduled/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Ready to Inject/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Telegram not configured/i)).not.toBeInTheDocument();
    });

    it('opens AuthModal when clicking Sign In or Sign Up on the warning banner', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [] }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/manage your reminders/i)).toBeInTheDocument();
      });

      const signInBtn = screen.getByRole('button', { name: 'Sign In' });
      fireEvent.click(signInBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Sign In to InsuMinder/i })).toBeInTheDocument();
      });
    });

    it('displays user profile in sidebar and enables Log Injection when logged in, and signs out cleanly', async () => {
      authService.setSession('valid-user-token', {
        id: 99,
        email: 'authenticated.patient@domain.com',
        name: 'Patient Jane'
      });

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              user: { id: 99, email: 'authenticated.patient@domain.com', name: 'Patient Jane' }
            })
          });
        }
        if (url === '/api/auth/logout') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
        }
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [] }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      // Button is enabled and warning banner is absent
      await waitFor(() => {
        const logBtn = screen.getByRole('button', { name: /Log Injection/i });
        expect(logBtn).toBeEnabled();
        expect(screen.queryByText(/manage your reminders/i)).not.toBeInTheDocument();
      });

      // Open navigation drawer to view user badge and sign out button
      const hamburgerBtn = screen.getByRole('button', { name: /Open navigation menu/i });
      fireEvent.click(hamburgerBtn);

      // User details visible in nav drawer
      expect(screen.getByText('Patient Jane')).toBeInTheDocument();
      expect(screen.getByText('authenticated.patient@domain.com')).toBeInTheDocument();

      // Sign out
      const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
      fireEvent.click(signOutBtn);

      await waitFor(() => {
        expect(screen.getByText('You have been signed out.')).toBeInTheDocument();
        const logBtn = screen.getByRole('button', { name: /Log Injection/i });
        expect(logBtn).toBeDisabled();
        expect(screen.getByText(/manage your reminders/i)).toBeInTheDocument();
      });
    });

    it('displays locked-state card when navigating to Injection Logs while signed out', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [] }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      // Open drawer and click Injection Logs
      const hamburgerBtn = screen.getByRole('button', { name: /Open navigation menu/i });
      fireEvent.click(hamburgerBtn);

      const logsNavItem = screen.getByRole('button', { name: /Injection Logs/i });
      fireEvent.click(logsNavItem);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Account Required/i })).toBeInTheDocument();
        expect(screen.getByText(/Please sign in or create an account to view your injection history, daily logs, and weekly trends\./i)).toBeInTheDocument();
      });

      // Clicking Sign In in the locked card opens AuthModal
      const cardSignInBtn = screen.getByRole('button', { name: 'Sign In' });
      fireEvent.click(cardSignInBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Sign In to InsuMinder/i })).toBeInTheDocument();
      });
    });

    it('displays locked notice for Telegram notifications in Settings while signed out', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/logs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, logs: [] }) });
        }
        if (url === '/api/telegram-configs') {
          return Promise.resolve({ json: () => Promise.resolve({ success: true, configs: [] }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ success: true }) });
      });

      render(<App />);

      // Open drawer and click Settings
      const hamburgerBtn = screen.getByRole('button', { name: /Open navigation menu/i });
      fireEvent.click(hamburgerBtn);

      const settingsNavItem = screen.getByRole('button', { name: /Settings/i });
      fireEvent.click(settingsNavItem);

      await waitFor(() => {
        expect(screen.getByText(/Please sign in or create an account to configure Telegram notification destinations/i)).toBeInTheDocument();
      });
    });
  });
});
