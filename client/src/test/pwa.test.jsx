import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationSettings from '../NotificationSettings';
import { LanguageProvider } from '../i18n';
import * as pwa from '../pwa';

describe('PWA & Web Push Client Helper Tests', () => {
  it('correctly converts base64 URL safe string to Uint8Array with urlBase64ToUint8Array', () => {
    const testBase64Url = 'BNACDjD1nn2PsLMW8wXHd24MFshk1rHd72u-_NC28fa9nepN7SJTsBmAGaI1ooxPvTv-lOYuQrkxE2z7iVwUJHs';
    const arr = pwa.urlBase64ToUint8Array(testBase64Url);
    expect(arr).toBeInstanceOf(Uint8Array);
    expect(arr.length).toBe(65);
    expect(arr[0]).toBe(0x04); // Uncompressed EC point prefix
  });

  it('detects push notification support via isPushSupported', () => {
    const supported = pwa.isPushSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('fetches notification permission via getNotificationPermission', () => {
    const perm = pwa.getNotificationPermission();
    expect(['default', 'granted', 'denied', 'unsupported']).toContain(perm);
  });
});

describe('NotificationSettings Web Push & PWA Integration', () => {
  const originalFetch = globalThis.fetch;
  const originalNotification = globalThis.Notification;

  beforeEach(() => {
    vi.spyOn(pwa, 'isPushSupported').mockReturnValue(true);
    globalThis.Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted')
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.Notification = originalNotification;
    vi.restoreAllMocks();
  });

  it('renders the Device & Web Push card with status and action buttons', () => {
    render(
      <LanguageProvider>
        <NotificationSettings preferences={{ personal: {}, shared: {} }} onUpdatePreferences={() => {}} />
      </LanguageProvider>
    );

    expect(screen.getByText('Device & Web Push Notifications')).toBeInTheDocument();
    expect(screen.getByText(/Receive real-time alerts on your Android device or browser/i)).toBeInTheDocument();
    expect(screen.getByText('Not Subscribed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enable Push on this Device/i })).toBeInTheDocument();
  });

  it('renders the Android App & Offline Installation section', () => {
    render(
      <LanguageProvider>
        <NotificationSettings preferences={{ personal: {}, shared: {} }} onUpdatePreferences={() => {}} />
      </LanguageProvider>
    );

    expect(screen.getByText('Android App & Offline Installation')).toBeInTheDocument();
    expect(screen.getByText(/Install InsuMinder as a standalone app on your Android device/i)).toBeInTheDocument();
  });

  it('subscribes to push notifications and displays active status upon successful enablement', async () => {
    const mockSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
        keys: { p256dh: 'mock-p256', auth: 'mock-auth' }
      })
    };

    vi.spyOn(pwa, 'isPushSupported').mockReturnValue(true);
    vi.spyOn(pwa, 'getExistingPushSubscription').mockResolvedValue(null);
    vi.spyOn(pwa, 'subscribeToPush').mockResolvedValue({
      ok: true,
      subscription: mockSubscription
    });

    render(
      <LanguageProvider>
        <NotificationSettings preferences={{ personal: {}, shared: {} }} onUpdatePreferences={() => {}} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not Subscribed')).toBeInTheDocument();
    });

    const enableBtn = screen.getByRole('button', { name: /Enable Push on this Device/i });
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(screen.getByText('Push Active')).toBeInTheDocument();
    });

    // When active, "Disable Push" and "Send Test Push" buttons are shown
    expect(screen.getByRole('button', { name: /Disable Push on this Device/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Test Push/i })).toBeInTheDocument();
  });

  it('triggers test push delivery when Send Test Push is clicked', async () => {
    vi.spyOn(pwa, 'isPushSupported').mockReturnValue(true);
    vi.spyOn(pwa, 'getExistingPushSubscription').mockResolvedValue({
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint'
    });
    const sendTestSpy = vi.spyOn(pwa, 'sendTestPush').mockResolvedValue({
      ok: true,
      message: 'Test notification sent.'
    });

    render(
      <LanguageProvider>
        <NotificationSettings preferences={{ personal: {}, shared: {} }} onUpdatePreferences={() => {}} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Push Active')).toBeInTheDocument();
    });

    const testBtn = screen.getByRole('button', { name: /Send Test Push/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(sendTestSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Test notification sent! Check your notification tray/i)).toBeInTheDocument();
    });
  });

  it('hides the installation card when running in standalone mode or already installed', () => {
    vi.spyOn(pwa, 'isStandaloneApp').mockReturnValue(true);

    render(
      <LanguageProvider>
        <NotificationSettings preferences={{ personal: {}, shared: {} }} onUpdatePreferences={() => {}} />
      </LanguageProvider>
    );

    expect(screen.queryByText('Android App & Offline Installation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Install App on Android/i })).not.toBeInTheDocument();
  });
});

describe('PWA Installation Detection & Persistence Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('isStandaloneApp correctly identifies standalone display mode and localStorage', () => {
    expect(pwa.isStandaloneApp()).toBe(false);

    pwa.markAppInstalled(true);
    expect(pwa.isStandaloneApp()).toBe(true);

    pwa.markAppInstalled(false);
    expect(pwa.isStandaloneApp()).toBe(false);
  });

  it('checkIsAppInstalled checks getInstalledRelatedApps when available', async () => {
    const originalNavigator = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          ...originalNavigator,
          getInstalledRelatedApps: vi.fn().mockResolvedValue([{ platform: 'play', id: 'com.insuminder.app' }])
        },
        configurable: true,
        writable: true
      });

      const installed = await pwa.checkIsAppInstalled();
      expect(installed).toBe(true);
      expect(localStorage.getItem('insuminder_app_installed')).toBe('true');
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true
      });
    }
  });
});

