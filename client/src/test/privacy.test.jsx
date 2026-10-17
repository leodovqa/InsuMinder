import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrivacyModal from '../PrivacyModal';
import AuthModal from '../AuthModal';
import App from '../App';
import { authService } from '../authService';

describe('Medical Privacy Agreement & In-App Consent Flow (v1.7.0)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    document.body.className = '';
    document.body.style.overflow = '';
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    document.body.className = '';
    document.body.style.overflow = '';
  });

  describe('PrivacyModal Component Specifications', () => {
    it('renders all 5 clinical data protection sections in full with no external URL redirects', () => {
      render(
        <PrivacyModal
          isOpen={true}
          requireConsent={false}
          onClose={vi.fn()}
        />
      );

      // Modal Title & Subtitle
      expect(screen.getByRole('heading', { level: 2, name: /Privacy Agreement & Data Protection/i })).toBeInTheDocument();
      expect(screen.getByText(/How InsuMinder safeguards and respects your diabetes health data/i)).toBeInTheDocument();

      // Highlight Box
      expect(screen.getByText(/Your Data Stays Yours/i)).toBeInTheDocument();
      expect(screen.getByText(/InsuMinder does not sell, broker, or transmit your diabetes logs to third-party advertisers or data brokers/i)).toBeInTheDocument();

      // All 5 sections
      expect(screen.getByRole('heading', { level: 3, name: /1\. Personal Data Ownership & Confidentiality/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /2\. Third-Party Services & Zero Tracking/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /3\. Medical & Clinical Disclaimer/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /4\. Future Healthcare & Insurance Compliance/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /5\. Data Export & Deletion Rights/i })).toBeInTheDocument();

      // Explicit no-sale guarantee text
      expect(screen.getByText(/InsuMinder will never sell, rent, monetize, or trade your medical data/i)).toBeInTheDocument();
    });

    it('operates in voluntary view mode: shows Close buttons and fires onClose', () => {
      const handleClose = vi.fn();
      render(
        <PrivacyModal
          isOpen={true}
          requireConsent={false}
          onClose={handleClose}
        />
      );

      // Close button in header
      const topCloseBtn = screen.getByRole('button', { name: /Close modal/i });
      expect(topCloseBtn).toBeInTheDocument();

      // Close button in footer
      const bottomCloseBtn = screen.getByRole('button', { name: /^Close$/i });
      expect(bottomCloseBtn).toBeInTheDocument();

      // Consent action buttons should NOT be present
      expect(screen.queryByRole('button', { name: /I Agree & Continue/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Decline & Sign Out/i })).not.toBeInTheDocument();

      // Clicking bottom close button triggers onClose
      fireEvent.click(bottomCloseBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Clicking backdrop in voluntary mode also triggers onClose
      const backdrop = document.querySelector('.privacy-modal-backdrop');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop);
      expect(handleClose).toHaveBeenCalledTimes(2);
    });

    it('operates in mandatory consent mode: renders action banner, disables dismissal, and triggers consent / decline', () => {
      const handleClose = vi.fn();
      const handleConsent = vi.fn();
      const handleDecline = vi.fn();

      render(
        <PrivacyModal
          isOpen={true}
          requireConsent={true}
          onClose={handleClose}
          onConsent={handleConsent}
          onDecline={handleDecline}
        />
      );

      // Mandatory banner is present
      expect(screen.getByText(/Please review and accept our privacy terms to continue using InsuMinder/i)).toBeInTheDocument();
      expect(screen.getByText(/We value your medical privacy/i)).toBeInTheDocument();

      // Close 'x' button in header MUST NOT be rendered
      expect(screen.queryByRole('button', { name: /Close modal/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Close$/i })).not.toBeInTheDocument();

      // Backdrop click MUST NOT close the modal in mandatory consent mode
      const backdrop = document.querySelector('.privacy-modal-backdrop');
      fireEvent.click(backdrop);
      expect(handleClose).not.toHaveBeenCalled();

      // Both mandatory action buttons are present
      const consentBtn = screen.getByRole('button', { name: /I Agree & Continue/i });
      const declineBtn = screen.getByRole('button', { name: /Decline & Sign Out/i });
      expect(consentBtn).toBeInTheDocument();
      expect(declineBtn).toBeInTheDocument();

      // Clicking consent triggers onConsent
      fireEvent.click(consentBtn);
      expect(handleConsent).toHaveBeenCalledTimes(1);

      // Clicking decline triggers onDecline
      fireEvent.click(declineBtn);
      expect(handleDecline).toHaveBeenCalledTimes(1);
    });

    it('enforces universal modal scroll locking when open and releases when closed (Rule 11)', () => {
      const { rerender } = render(
        <PrivacyModal
          isOpen={true}
          requireConsent={false}
          onClose={vi.fn()}
        />
      );

      expect(document.body.classList.contains('modal-open')).toBe(true);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <PrivacyModal
          isOpen={false}
          requireConsent={false}
          onClose={vi.fn()}
        />
      );

      expect(document.body.classList.contains('modal-open')).toBe(false);
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Auth Registration Privacy Consent Integration', () => {
    it('disables registration submit until privacy checkbox is checked, and allows in-app policy review', async () => {
      render(
        <AuthModal
          isOpen={true}
          initialMode="register"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);
      const submitBtn = screen.getByRole('button', { name: /Continue & Send Code/i });
      const privacyCheckbox = screen.getByRole('checkbox');

      fireEvent.change(emailInput, { target: { value: 'newuser@clinic.org' } });
      fireEvent.change(passInput, { target: { value: 'Password123!' } });

      // Checkbox is initially unchecked, submit button is disabled
      expect(privacyCheckbox).not.toBeChecked();
      expect(submitBtn).toBeDisabled();

      // Clicking Review Privacy Agreement button opens PrivacyModal in-app
      const reviewBtn = screen.getByRole('button', { name: /Review Privacy Agreement/i });
      expect(reviewBtn).toBeInTheDocument();
      fireEvent.click(reviewBtn);

      // Privacy modal overlay appears on top without leaving the auth flow
      expect(await screen.findByRole('heading', { level: 2, name: /Privacy Agreement & Data Protection/i })).toBeInTheDocument();

      // Close the privacy viewer
      const closeBtn = screen.getByRole('button', { name: /^Close$/i });
      fireEvent.click(closeBtn);

      // Back on register screen, user checks the checkbox
      fireEvent.click(privacyCheckbox);
      expect(privacyCheckbox).toBeChecked();
      expect(submitBtn).toBeEnabled();
    });
  });

  describe('App-Level Mandatory Privacy Consent & Settings View', () => {
    it('displays mandatory PrivacyModal for logged-in user without privacyAcceptedAt, and accepting updates session', async () => {
      authService.setSession('token-without-privacy', {
        id: 77,
        email: 'unconsented.patient@domain.com',
        name: 'Patient Unconsented',
        privacyAcceptedAt: null
      });

      globalThis.fetch = vi.fn().mockImplementation((url, opts) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              user: {
                id: 77,
                email: 'unconsented.patient@domain.com',
                name: 'Patient Unconsented',
                privacyAcceptedAt: null
              }
            })
          });
        }
        if (url === '/api/auth/privacy-accept' && opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              user: {
                id: 77,
                email: 'unconsented.patient@domain.com',
                name: 'Patient Unconsented',
                privacyAcceptedAt: '2026-10-17T16:00:00Z'
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

      // Mandatory PrivacyModal MUST be displayed
      expect(await screen.findByText(/Please review and accept our privacy terms to continue using InsuMinder/i)).toBeInTheDocument();

      const acceptBtn = screen.getByRole('button', { name: /I Agree & Continue/i });
      expect(acceptBtn).toBeInTheDocument();

      // User accepts the agreement
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Please review and accept our privacy terms to continue using InsuMinder/i)).not.toBeInTheDocument();
      });

      // User session should now have privacyAcceptedAt recorded
      const currentUser = authService.getCurrentUser();
      expect(currentUser.privacyAcceptedAt).toBeTruthy();
    });

    it('declining mandatory privacy agreement signs out the user safely', async () => {
      authService.setSession('token-without-privacy', {
        id: 88,
        email: 'declining.patient@domain.com',
        name: 'Patient Declining',
        privacyAcceptedAt: null
      });

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              user: {
                id: 88,
                email: 'declining.patient@domain.com',
                name: 'Patient Declining',
                privacyAcceptedAt: null
              }
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

      expect(await screen.findByText(/Please review and accept our privacy terms to continue using InsuMinder/i)).toBeInTheDocument();

      const declineBtn = screen.getByRole('button', { name: /Decline & Sign Out/i });
      fireEvent.click(declineBtn);

      await waitFor(() => {
        expect(authService.getToken()).toBeNull();
        expect(screen.getByText('You have been signed out.')).toBeInTheDocument();
      });
    });

    it('renders Privacy & Data Protection card in Settings tab and allows in-app review', async () => {
      window.history.pushState({}, '', '/?page=settings');

      authService.setSession('token-accepted', {
        id: 99,
        email: 'consented.patient@domain.com',
        name: 'Patient Consented',
        privacyAcceptedAt: '2026-10-17T12:00:00Z'
      });

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') {
          return Promise.resolve({
            json: () => Promise.resolve({
              success: true,
              user: {
                id: 99,
                email: 'consented.patient@domain.com',
                name: 'Patient Consented',
                privacyAcceptedAt: '2026-10-17T12:00:00Z'
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

      // Find Privacy & Data Protection card in Settings tab
      expect(await screen.findByRole('heading', { level: 2, name: /Privacy & Data Protection/i })).toBeInTheDocument();
      expect(screen.getByText(/Accepted on/i)).toBeInTheDocument();

      // Open PrivacyModal from Settings card
      const reviewFullBtn = screen.getByRole('button', { name: /View Privacy Agreement/i });
      fireEvent.click(reviewFullBtn);

      // Verify PrivacyModal opened
      expect(await screen.findByRole('heading', { level: 2, name: /Privacy Agreement & Data Protection/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Close$/i })).toBeInTheDocument();

      window.history.pushState({}, '', '/');
    });
  });
});
