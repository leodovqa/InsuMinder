import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationSettings from '../NotificationSettings';
import { LanguageProvider } from '../i18n';

function renderNotificationSettings(props = {}) {
  const defaultProps = {
    preferences: {
      personal: {
        rem10m: true,
        rem2h: true,
        rem3h: false,
        basal: true
      },
      shared: {
        rem10m: true,
        rem2h: false,
        rem3h: false,
        basal: false
      }
    },
    onUpdatePreferences: vi.fn(),
    ...props
  };

  const utils = render(
    <LanguageProvider>
      <NotificationSettings {...defaultProps} />
    </LanguageProvider>
  );

  return { ...utils, ...defaultProps };
}

describe('NotificationSettings Component', () => {
  it('renders all four notification toggle cards with appropriate initial states', () => {
    renderNotificationSettings();

    // Check title keys exist
    expect(screen.getByText('10-Minute Meal Reminder')).toBeInTheDocument();
    expect(screen.getByText('2-Hour Glucose Check')).toBeInTheDocument();
    expect(screen.getByText('3-Hour Safe Window')).toBeInTheDocument();
    expect(screen.getByText('Daily Basal Reminder')).toBeInTheDocument();

    // In personal scope, rem3h is false, others are true
    const activeBadges = screen.getAllByText('Active');
    const disabledBadges = screen.getAllByText('Disabled');

    expect(activeBadges).toHaveLength(3);
    expect(disabledBadges).toHaveLength(1);
  });

  it('switches between My Data and Shared Data scopes', () => {
    renderNotificationSettings();

    const sharedTab = screen.getByRole('tab', { name: /Shared Data/i });
    expect(sharedTab).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(sharedTab);
    expect(sharedTab).toHaveAttribute('aria-selected', 'true');

    // In shared scope, rem10m is true, rem2h/rem3h/basal are false
    const activeBadges = screen.getAllByText('Active');
    const disabledBadges = screen.getAllByText('Disabled');

    expect(activeBadges).toHaveLength(1);
    expect(disabledBadges).toHaveLength(3);
  });

  it('triggers onUpdatePreferences when toggle switch is clicked', () => {
    const onUpdatePreferences = vi.fn();
    renderNotificationSettings({ onUpdatePreferences });

    // Click the toggle button for rem10m (which is currently true)
    const switchBtn = screen.getByRole('switch', { name: '10-Minute Meal Reminder' });
    fireEvent.click(switchBtn);

    expect(onUpdatePreferences).toHaveBeenCalledTimes(1);
    expect(onUpdatePreferences).toHaveBeenCalledWith({
      personal: {
        rem10m: false,
        rem2h: true,
        rem3h: false,
        basal: true
      },
      shared: {
        rem10m: true,
        rem2h: false,
        rem3h: false,
        basal: false
      }
    });
  });

  it('triggers onUpdatePreferences when entire card is clicked (tactile card UX)', () => {
    const onUpdatePreferences = vi.fn();
    renderNotificationSettings({ onUpdatePreferences });

    // The entire card for 3-Hour Safe Window (currently false) is clicked
    const safeWindowCard = screen.getByText('3-Hour Safe Window').closest('.notification-toggle-card');
    expect(safeWindowCard).toBeInTheDocument();

    fireEvent.click(safeWindowCard);

    expect(onUpdatePreferences).toHaveBeenCalledTimes(1);
    expect(onUpdatePreferences).toHaveBeenCalledWith({
      personal: {
        rem10m: true,
        rem2h: true,
        rem3h: true,
        basal: true
      },
      shared: {
        rem10m: true,
        rem2h: false,
        rem3h: false,
        basal: false
      }
    });
  });

  it('supports keyboard navigation via Enter and Space keys on cards', () => {
    const onUpdatePreferences = vi.fn();
    renderNotificationSettings({ onUpdatePreferences });

    const basalCard = screen.getByText('Daily Basal Reminder').closest('.notification-toggle-card');
    expect(basalCard).toBeInTheDocument();

    // Press Enter
    fireEvent.keyDown(basalCard, { key: 'Enter' });
    expect(onUpdatePreferences).toHaveBeenCalledTimes(1);

    // Press Space
    fireEvent.keyDown(basalCard, { key: ' ' });
    expect(onUpdatePreferences).toHaveBeenCalledTimes(2);
  });

  it('renders device push card and triggers test notification', async () => {
    // Mock Android bridge
    window.AndroidBridge = {
      isNativeAndroid: () => true,
      isNotificationPermissionGranted: () => true,
      postNativeNotification: vi.fn(),
      requestNotificationPermission: vi.fn()
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Test notification sent!' })
    });

    renderNotificationSettings();

    expect(screen.getByText('Device & Web Push Notifications')).toBeInTheDocument();

    const testBtn = screen.getByRole('button', { name: /Send Test Push/i });
    expect(testBtn).toBeInTheDocument();

    fireEvent.click(testBtn);

    expect(window.AndroidBridge.postNativeNotification).toHaveBeenCalledWith(
      expect.stringContaining('InsuMinder Test Alert'),
      expect.stringContaining('Device push reminders are active'),
      'insuminder-test',
      '/?action=basal'
    );

    delete window.AndroidBridge;
  });
});

