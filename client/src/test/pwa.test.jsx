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

    expect(screen.getByText(/Android Application \(\.APK Package\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Install InsuMinder directly on your Android phone/i)).toBeInTheDocument();
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

  it('isStandaloneApp correctly identifies standalone display mode and navigator.standalone', () => {
    expect(pwa.isStandaloneApp()).toBe(false);

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    expect(pwa.isStandaloneApp()).toBe(true);

    window.matchMedia = originalMatchMedia;
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
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true
      });
    }
  });

  it('manages stored app version in localStorage', () => {
    localStorage.clear();
    expect(pwa.getStoredAppVersion()).toBe('1.0.0');

    pwa.setStoredAppVersion('1.1.0');
    expect(pwa.getStoredAppVersion()).toBe('1.1.0');
  });

  it('detects available app update when remote version differs from stored version', async () => {
    localStorage.setItem('insuminder_app_version', '1.0.0');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: '1.1.0',
        buildTime: '2026-10-16T15:00:00Z',
        changes: { en: ['New APK live updates', 'Update banner'] }
      })
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      let receivedUpdate = null;
      const unsub = pwa.subscribeToAppUpdates((info) => {
        receivedUpdate = info;
      });

      const updateInfo = await pwa.checkForAppUpdate();
      expect(updateInfo).not.toBeNull();
      expect(updateInfo.updateAvailable).toBe(true);
      expect(updateInfo.currentVersion).toBe('1.0.0');
      expect(updateInfo.newVersion).toBe('1.1.0');
      expect(receivedUpdate).toEqual(updateInfo);

      unsub();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('applyAppUpdate updates stored version and triggers reload', async () => {
    const originalReload = window.location.reload;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      configurable: true,
      writable: true
    });

    try {
      await pwa.applyAppUpdate('1.2.0');
      expect(pwa.getStoredAppVersion()).toBe('1.2.0');
      expect(reloadMock).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: originalReload },
        configurable: true,
        writable: true
      });
    }
  });

  it('exports valid ANDROID_PACKAGE_INFO and APP_CURRENT_CHANGELOG with 3-language parity', () => {
    expect(pwa.ANDROID_PACKAGE_INFO.version).toBe('1.6.0');
    expect(pwa.ANDROID_PACKAGE_INFO.fileName).toBe('InsuMinder.apk');
    expect(pwa.APP_CURRENT_CHANGELOG.en.length).toBeGreaterThan(0);
    expect(pwa.APP_CURRENT_CHANGELOG.he.length).toBeGreaterThan(0);
    expect(pwa.APP_CURRENT_CHANGELOG.ru.length).toBeGreaterThan(0);
  });

  it('calculates versionsBehind from versionHistory and semver accurately', () => {
    localStorage.clear();
    const history = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0'];
    expect(pwa.calculateVersionsBehind('1.2.0', '1.4.0', history)).toBe(2);
    expect(pwa.calculateVersionsBehind('1.2.0', '1.5.0', history)).toBe(3);
    expect(pwa.calculateVersionsBehind('1.4.0', '1.5.0', history)).toBe(1);
    expect(pwa.calculateVersionsBehind('1.5.0', '1.5.0', history)).toBe(0);

    // Patch releases in history do not artificially inflate version difference
    const historyWithPatches = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.3.1', '1.4.0'];
    expect(pwa.calculateVersionsBehind('1.2.0', '1.4.0', historyWithPatches)).toBe(2);

    // Major upgrade (e.g. 1.5.0 -> 2.0.0) is ALWAYS a big update (mandatory, >= 3) even if only 1 milestone difference
    expect(pwa.calculateVersionsBehind('1.5.0', '2.0.0', ['1.5.0', '2.0.0'])).toBeGreaterThanOrEqual(3);

    pwa.recordPostponedUpdate('1.0.1');
    pwa.recordPostponedUpdate('1.0.2');
    expect(pwa.getPostponedUpdatesCount()).toBe(2);

    pwa.clearPostponedUpdates();
    expect(pwa.getPostponedUpdatesCount()).toBe(0);
  });

  it('marks major upgrade (e.g. 1.x -> 2.0.0) as mandatory on Android even if only 1 version ahead', async () => {
    localStorage.setItem('insuminder_app_version', '1.9.0');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: '2.0.0',
        versionHistory: ['1.9.0', '2.0.0'],
        changes: { en: ['Major release 2.0'] }
      })
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, userAgent: 'Mozilla/5.0 InsuMinder-Android/1.0.0' },
      configurable: true,
      writable: true
    });

    try {
      const androidUpdate = await pwa.checkForAppUpdate();
      expect(androidUpdate.updateAvailable).toBe(true);
      expect(androidUpdate.isMandatory).toBe(true);
      expect(androidUpdate.versionsBehind).toBeGreaterThanOrEqual(3);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true
      });
      globalThis.fetch = originalFetch;
    }
  });

  it('marks update as mandatory ONLY on Android when >= 3 updates behind', async () => {
    localStorage.setItem('insuminder_app_version', '1.0.0');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: '1.3.0',
        versionHistory: ['1.0.0', '1.1.0', '1.2.0', '1.3.0'],
        changes: { en: ['Big update'] }
      })
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    // Web environment: isAndroidApp() returns false
    const webUpdate = await pwa.checkForAppUpdate();
    expect(webUpdate.versionsBehind).toBe(3);
    expect(webUpdate.isMandatory).toBe(false);

    // Android environment: simulate Android native user agent
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, userAgent: 'Mozilla/5.0 InsuMinder-Android/1.0.0' },
      configurable: true,
      writable: true
    });

    try {
      const androidUpdate = await pwa.checkForAppUpdate();
      expect(androidUpdate.isMandatory).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true
      });
      globalThis.fetch = originalFetch;
    }
  });
});

