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

    it('sends updated profile to /api/auth/profile and saves session', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          user: { id: 10, email: 'verified@med.com', name: 'John Doe', firstName: 'John', lastName: 'Doe', phone: '+12345' }
        })
      });

      const res = await authService.updateProfile({ firstName: 'John', lastName: 'Doe', phone: '+12345' });
      expect(res.success).toBe(true);
      expect(authService.getCurrentUser()?.name).toBe('John Doe');
      expect(authService.getCurrentUser()?.firstName).toBe('John');
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
      fireEvent.click(screen.getByRole('button', { name: /Verify Code & Continue/i }));

      await waitFor(() => {
        expect(screen.getByText('Verification code has expired. Please enter your email and password to start a new verification process.')).toBeInTheDocument();
      });
    });

    it('advances to Step 3 (Profile setup) upon verifying code and finishes registration on profile submit', async () => {
      const onSuccessMock = vi.fn();
      globalThis.fetch = vi.fn()
        // 1st fetch: verify code checkOnly
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            success: true,
            verified: true
          })
        })
        // 2nd fetch: complete registration
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            success: true,
            token: 'valid-session-jwt',
            user: { id: 5, email: 'patient@clinic.com', name: 'Jane Doe', firstName: 'Jane', lastName: 'Doe', phone: '+12025550100' }
          })
        });

      render(<AuthModal isOpen={true} initialMode="verify" onClose={vi.fn()} onSuccess={onSuccessMock} />);

      fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '456789' } });
      fireEvent.click(screen.getByRole('button', { name: /Verify Code & Continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/Complete Your Profile/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument();
      });

      // Fill in profile
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Jane' } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Doe' } });
      fireEvent.change(screen.getByLabelText(/Phone Number/i), { target: { value: '+1-202-555-0100' } });

      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));

      await waitFor(() => {
        expect(onSuccessMock).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'patient@clinic.com',
            name: 'Jane Doe',
            firstName: 'Jane',
            lastName: 'Doe'
          })
        );
      });
    });

    it('disables Complete Registration button if First Name or Last Name is empty', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          verified: true
        })
      });

      render(<AuthModal isOpen={true} initialMode="verify" onClose={vi.fn()} onSuccess={vi.fn()} />);

      fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '456789' } });
      fireEvent.click(screen.getByRole('button', { name: /Verify Code & Continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/Complete Your Profile/i)).toBeInTheDocument();
      });

      const completeBtn = screen.getByRole('button', { name: /Complete Registration/i });
      expect(completeBtn).toBeDisabled();

      // Enter only First Name
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Leo' } });
      expect(completeBtn).toBeDisabled();

      // Enter Last Name
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Test' } });
      expect(completeBtn).not.toBeDisabled();
    });

    it('renders Test Name and Test Last Name placeholders, fixed plus prefix, and auto-detects flag for +1 (340)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          verified: true
        })
      });

      render(<AuthModal isOpen={true} initialMode="verify" onClose={vi.fn()} onSuccess={vi.fn()} />);

      fireEvent.change(screen.getByPlaceholderText('123456'), { target: { value: '456789' } });
      fireEvent.click(screen.getByRole('button', { name: /Verify Code & Continue/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('e.g. Test Name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. Test Last Name')).toBeInTheDocument();
        expect(screen.getByText('+')).toBeInTheDocument();
      });

      // Default state: globe icon before any input
      expect(screen.getByText('🌐')).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: /VI/i })).not.toBeInTheDocument();

      const phoneInput = screen.getByLabelText(/Phone Number/i);
      const firstNameInput = screen.getByLabelText(/First Name/i);
      const lastNameInput = screen.getByLabelText(/Last Name/i);
      const completeBtn = screen.getByRole('button', { name: /Complete Registration/i });

      fireEvent.change(firstNameInput, { target: { value: 'Test' } });
      fireEvent.change(lastNameInput, { target: { value: 'User' } });

      // 1. Only numeric digits allowed: typing symbols and letters strips them
      fireEvent.change(phoneInput, { target: { value: 'abc+1 (340) 555-1234' } });
      expect(phoneInput.value).toBe('13405551234');

      const flagImg = document.querySelector('.phone-flag-icon');
      expect(flagImg).toBeInTheDocument();
      expect(flagImg.getAttribute('src')).toBe('/flags/VI.svg');
      // Verify ONLY flag is shown, no text
      expect(screen.queryByText(/Virgin Islands/i)).not.toBeInTheDocument();
      // Valid number has no error
      expect(screen.queryByText('Invalid phone number')).not.toBeInTheDocument();
      expect(completeBtn).not.toBeDisabled();

      // 2. Typing an incomplete/invalid number shows red border & "Invalid phone number" error
      fireEvent.change(phoneInput, { target: { value: '1340' } });
      expect(screen.getByText('Invalid phone number')).toBeInTheDocument();
      expect(document.querySelector('.phone-input-container')).toHaveClass('phone-error');
      expect(phoneInput).toHaveClass('phone-input-invalid');
      expect(completeBtn).toBeDisabled();

      // 3. Changing to a valid UK phone clears error
      fireEvent.change(phoneInput, { target: { value: '44 7911 123456' } });
      expect(phoneInput.value).toBe('447911123456');
      expect(document.querySelector('.phone-flag-icon')?.getAttribute('src')).toBe('/flags/GB.svg');
      expect(screen.queryByText('Invalid phone number')).not.toBeInTheDocument();
      expect(document.querySelector('.phone-input-container')).not.toHaveClass('phone-error');
      expect(completeBtn).not.toBeDisabled();

      // 4. Changing to invalid Israel phone (such as 9721235315 from user screenshot) shows error
      fireEvent.change(phoneInput, { target: { value: '9721235315' } });
      expect(screen.getByText('Invalid phone number')).toBeInTheDocument();
      expect(document.querySelector('.phone-input-container')).toHaveClass('phone-error');
      expect(phoneInput).toHaveClass('phone-input-invalid');
      expect(completeBtn).toBeDisabled();

      // 5. Completing with a real valid Israel mobile phone (052-765-4321 -> 972527654321) clears error
      fireEvent.change(phoneInput, { target: { value: '972 52 7654321' } });
      expect(phoneInput.value).toBe('972527654321');
      expect(document.querySelector('.phone-flag-icon')?.getAttribute('src')).toBe('/flags/IL.svg');
      expect(screen.queryByText('Invalid phone number')).not.toBeInTheDocument();
      expect(document.querySelector('.phone-input-container')).not.toHaveClass('phone-error');
      expect(completeBtn).not.toBeDisabled();

      // 6. Clearing input (optional field) clears error and leaves button enabled
      fireEvent.change(phoneInput, { target: { value: '' } });
      expect(screen.queryByText('Invalid phone number')).not.toBeInTheDocument();
      expect(document.querySelector('.phone-input-container')).not.toHaveClass('phone-error');
      expect(completeBtn).not.toBeDisabled();
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

    it('preserves email and password when clicking Back to Email or top-left back button, and clears on exit', async () => {
      render(<AuthModal isOpen={true} initialMode="register" onClose={vi.fn()} onSuccess={vi.fn()} />);

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);
      fireEvent.change(emailInput, { target: { value: 'keepme@clinic.org' } });
      fireEvent.change(passInput, { target: { value: 'Secret123!' } });

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true })
      });

      fireEvent.click(screen.getByRole('button', { name: /Continue & Send Code/i }));

      await waitFor(() => {
        expect(screen.getByText(/Verify Email/i)).toBeInTheDocument();
      });

      // Verify top-left back button is visible
      const topLeftBackBtn = screen.getByLabelText(/Back to email and password/i);
      expect(topLeftBackBtn).toBeInTheDocument();

      // Click top-left back button
      fireEvent.click(topLeftBackBtn);

      // Now back on register screen - email and password MUST be preserved
      expect(screen.getByRole('heading', { name: /Create InsuMinder Account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i).value).toBe('keepme@clinic.org');
      expect(screen.getByLabelText(/Password/i).value).toBe('Secret123!');
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

    it('displays first and last name in nav drawer instead of email username prefix when user registers', async () => {
      authService.setSession('valid-user-token', {
        id: 100,
        email: 'leotest2@grr.la',
        name: 'Leo Test',
        firstName: 'Leo',
        lastName: 'Test'
      });

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              user: {
                id: 100,
                email: 'leotest2@grr.la',
                name: 'Leo Test',
                firstName: 'Leo',
                lastName: 'Test',
                shareCode: 'INSU-TEST01'
              }
            })
          });
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

      const hamburgerBtn = screen.getByRole('button', { name: /Open navigation menu/i });
      fireEvent.click(hamburgerBtn);

      // Verify that Leo Test is displayed, not leotest2
      expect(screen.getByText('Leo Test')).toBeInTheDocument();
      expect(screen.queryByText('leotest2')).not.toBeInTheDocument();
      expect(screen.getByText('leotest2@grr.la')).toBeInTheDocument();
      expect(screen.getByText('L')).toBeInTheDocument();
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
