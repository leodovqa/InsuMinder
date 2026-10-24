import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TherapyModeOnboardingModal from '../TherapyModeOnboardingModal';
import NotificationSettings from '../NotificationSettings';
import { LanguageProvider } from '../i18n';
import { authService } from '../authService';

const renderWithLang = (ui) => {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
};

describe('Therapy Modes (Pens vs Pump/Pod Flow) Specifications (v2.0.0)', () => {
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

  describe('TherapyModeOnboardingModal Component', () => {
    it('renders with both options unselected and Continue button disabled by default', () => {
      renderWithLang(
        <TherapyModeOnboardingModal
          isOpen={true}
          onSelectMode={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { level: 2, name: /Choose Your Delivery Method/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Select your daily injection flow so InsuMinder customizes your reminders and tracking/i)[0]).toBeInTheDocument();

      const penOption = screen.getByRole('radio', { name: /Insulin Pens \(MDI\)/i });
      const pumpOption = screen.getByRole('radio', { name: /Insulin Pump \/ Pod/i });
      expect(penOption).toBeInTheDocument();
      expect(pumpOption).toBeInTheDocument();
      expect(penOption).toHaveAttribute('aria-checked', 'false');
      expect(pumpOption).toHaveAttribute('aria-checked', 'false');

      const continueBtn = screen.getByRole('button', { name: /Get Started/i });
      expect(continueBtn).toBeDisabled();
    });

    it('selects Pen tile on click, displays Pen description, and enables Continue button', () => {
      const handleSelect = vi.fn();
      renderWithLang(
        <TherapyModeOnboardingModal
          isOpen={true}
          onSelectMode={handleSelect}
        />
      );

      const penOption = screen.getByRole('radio', { name: /Insulin Pens \(MDI\)/i });
      fireEvent.click(penOption);

      expect(penOption).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByText(/Ideal for manual pen injections/i)).toBeInTheDocument();
      expect(screen.getByText(/up to 10 bolus logs per day/i)).toBeInTheDocument();

      const continueBtn = screen.getByRole('button', { name: /Get Started/i });
      expect(continueBtn).not.toBeDisabled();

      fireEvent.click(continueBtn);
      expect(handleSelect).toHaveBeenCalledWith('pen');
    });

    it('switches to Pump tile on click, updates description to Pump, and triggers callback with "pump"', () => {
      const handleSelect = vi.fn();
      renderWithLang(
        <TherapyModeOnboardingModal
          isOpen={true}
          onSelectMode={handleSelect}
        />
      );

      const penOption = screen.getByRole('radio', { name: /Insulin Pens \(MDI\)/i });
      const pumpOption = screen.getByRole('radio', { name: /Insulin Pump \/ Pod/i });

      // First click pen
      fireEvent.click(penOption);
      expect(screen.getByText(/Ideal for manual pen injections/i)).toBeInTheDocument();

      // Switch to pump
      fireEvent.click(pumpOption);
      expect(pumpOption).toHaveAttribute('aria-checked', 'true');
      expect(penOption).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByText(/Tailored for Omnipod, patch pumps, or tubed pumps/i)).toBeInTheDocument();
      expect(screen.getByText(/up to 20 bolus logs per day/i)).toBeInTheDocument();

      const continueBtn = screen.getByRole('button', { name: /Get Started/i });
      fireEvent.click(continueBtn);
      expect(handleSelect).toHaveBeenCalledWith('pump');
    });

    it('does not render when isOpen is false', () => {
      const { container } = renderWithLang(
        <TherapyModeOnboardingModal
          isOpen={false}
          onSelectMode={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('NotificationSettings in Pump Mode', () => {
    it('omits basal reminder toggle when in pump mode', () => {
      renderWithLang(
        <NotificationSettings
          therapyMode="pump"
          preferences={{ personal: { rem10m: true, rem2h: true, rem3h: true, basal: true } }}
          onUpdatePreferences={vi.fn()}
        />
      );

      // Meal and check reminders are present
      expect(screen.getByText(/10-Minute Meal Reminder/i)).toBeInTheDocument();
      expect(screen.getByText(/2-Hour Glucose Check/i)).toBeInTheDocument();
      expect(screen.getByText(/3-Hour Safe Window/i)).toBeInTheDocument();

      // Basal reminder toggle is removed
      expect(screen.queryByText(/Daily Basal Reminder/i)).not.toBeInTheDocument();
    });

    it('includes basal reminder toggle when in pen mode', () => {
      renderWithLang(
        <NotificationSettings
          therapyMode="pen"
          preferences={{ personal: { rem10m: true, rem2h: true, rem3h: true, basal: true } }}
          onUpdatePreferences={vi.fn()}
        />
      );

      expect(screen.getByText(/Daily Basal Reminder/i)).toBeInTheDocument();
    });
  });

  describe('authService therapyMode helpers', () => {
    it('setTherapyMode updates optimistic user in session immediately', async () => {
      const initialUser = { id: 101, email: 'test@example.com', therapyMode: 'pen' };
      authService.setSession('fake-token', initialUser);

      // Mock fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          user: { ...initialUser, therapyMode: 'pump' }
        })
      });

      const updated = await authService.setTherapyMode('pump');
      expect(updated.therapyMode).toBe('pump');
      expect(authService.getCurrentUser().therapyMode).toBe('pump');
    });
  });
});
