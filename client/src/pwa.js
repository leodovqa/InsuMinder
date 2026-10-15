// client/src/pwa.js - Service Worker, Web Push & PWA installation helper

let deferredPrompt = null;
const installPromptListeners = new Set();

// Convert base64 URL safe to Uint8Array for applicationServerKey
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if Push & Service Worker are supported
export function isPushSupported() {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

// Get current browser permission state ('default' | 'granted' | 'denied' | 'unsupported')
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

// Register service worker
export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[PWA] Service Worker registration failed:', err);
    return null;
  }
}

// Get active Service Worker registration
export async function getRegistration() {
  if (!isPushSupported()) return null;
  return await navigator.serviceWorker.ready;
}

// Get existing push subscription from browser PushManager
export async function getExistingPushSubscription() {
  try {
    const reg = await getRegistration();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('[PWA] Error getting push subscription:', err);
    return null;
  }
}

// Subscribe to Web Push
export async function subscribeToPush(authHeader = null) {
  if (!isPushSupported()) {
    return { ok: false, error: 'Push notifications are not supported by this browser.' };
  }

  // 1. Request notification permission
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return { ok: false, error: 'Permission denied for notifications.' };
  }

  const reg = await getRegistration();
  if (!reg) {
    return { ok: false, error: 'Service Worker not ready.' };
  }

  // 2. Fetch VAPID public key
  let vapidKey;
  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    vapidKey = data.publicKey;
  } catch {
    return { ok: false, error: 'Failed to retrieve VAPID key from server.' };
  }

  if (!vapidKey) {
    return { ok: false, error: 'Empty VAPID key received.' };
  }

  // 3. Subscribe with PushManager
  try {
    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    // 4. Send subscription to server
    const headers = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const subJson = sub.toJSON();
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription: subJson,
        userAgent: navigator.userAgent
      })
    });

    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) {
      return { ok: false, error: saveData.error || 'Failed to save push subscription on server.' };
    }

    return { ok: true, subscription: sub };
  } catch (err) {
    console.error('[PWA] subscribeToPush error:', err);
    return { ok: false, error: err.message || 'Failed to subscribe to Web Push.' };
  }
}

// Unsubscribe from Web Push
export async function unsubscribeFromPush(authHeader = null) {
  try {
    const existing = await getExistingPushSubscription();
    if (!existing) {
      return { ok: true };
    }

    // Inform server
    const headers = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({ endpoint: existing.endpoint })
    }).catch(() => {});

    // Unsubscribe locally
    await existing.unsubscribe();
    return { ok: true };
  } catch (err) {
    console.error('[PWA] unsubscribeFromPush error:', err);
    return { ok: false, error: err.message || 'Failed to unsubscribe.' };
  }
}

// Send a test push notification to this device
export async function sendTestPush(authHeader = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'Failed to send test push notification.' };
    }
    return { ok: true, message: data.message };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error triggering test push.' };
  }
}

// Setup PWA install prompt listeners
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default mini-infobar or banner so we can offer our own UI button
    e.preventDefault();
    deferredPrompt = e;
    installPromptListeners.forEach((fn) => fn(deferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    try {
      localStorage.setItem('insuminder_app_installed', 'true');
    } catch (e) {
      void e;
    }
    installPromptListeners.forEach((fn) => fn(null));
    console.log('[PWA] InsuMinder was installed successfully.');
  });
}

export function subscribeToInstallPrompt(callback) {
  installPromptListeners.add(callback);
  callback(deferredPrompt);
  return () => installPromptListeners.delete(callback);
}

export async function promptPwaInstall() {
  if (!deferredPrompt) {
    return { outcome: 'unavailable' };
  }
  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      try {
        localStorage.setItem('insuminder_app_installed', 'true');
      } catch (e) {
        void e;
      }
    }
    deferredPrompt = null;
    installPromptListeners.forEach((fn) => fn(null));
    return { outcome };
  } catch (err) {
    console.warn('[PWA] prompt error:', err);
    return { outcome: 'error', error: err.message };
  }
}

export function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  const isDisplayStandalone = Boolean(
    (window.matchMedia && (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches
    )) ||
    window.navigator.standalone === true ||
    (typeof document !== 'undefined' && document.referrer && document.referrer.includes('android-app://'))
  );
  if (isDisplayStandalone) {
    try {
      localStorage.setItem('insuminder_app_installed', 'true');
    } catch (e) {
      void e;
    }
    return true;
  }
  try {
    if (localStorage.getItem('insuminder_app_installed') === 'true') {
      return true;
    }
  } catch (e) {
    void e;
  }
  return false;
}

export async function checkIsAppInstalled() {
  if (isStandaloneApp()) return true;
  if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
    try {
      const related = await navigator.getInstalledRelatedApps();
      if (Array.isArray(related) && related.length > 0) {
        try {
          localStorage.setItem('insuminder_app_installed', 'true');
        } catch (e) {
          void e;
        }
        return true;
      }
    } catch (e) {
      void e;
    }
  }
  return false;
}

export function markAppInstalled(installed = true) {
  try {
    if (installed) {
      localStorage.setItem('insuminder_app_installed', 'true');
    } else {
      localStorage.removeItem('insuminder_app_installed');
    }
  } catch (e) {
    void e;
  }
}


