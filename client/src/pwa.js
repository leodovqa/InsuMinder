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
    initServiceWorkerUpdateWatcher(reg);
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

export const ANDROID_PACKAGE_INFO = {
  version: '1.1.0',
  packageName: 'com.insuminder.app',
  fileName: 'InsuMinder.apk',
  downloadUrl: '/api/download/android',
  releaseUrl: 'https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk'
};

export const APP_CURRENT_CHANGELOG = {
  en: [
    'Native Android APK app support with seamless in-app live updates',
    'Interactive Update notification with "What\'s New" highlights',
    'Enhanced clinical reminder delivery and offline reliability'
  ],
  he: [
    'תמיכה מלאה באפליקציית אנדרואיד (.APK) מקורית עם עדכונים חיים באפליקציה',
    'התראת עדכון אינטראקטיבית עם פירוט תמציתי של מה שהשתנה',
    'מסירת תזכורות קליניות משופרת ואמינות מלאה במצב לא מקוון'
  ],
  ru: [
    'Нативная поддержка приложения Android (.APK) с живыми обновлениями',
    'Интерактивное уведомление об обновлении со списком изменений',
    'Улучшенная доставка клинических напоминаний и офлайн-режим'
  ]
};

export function downloadAndroidApk() {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = ANDROID_PACKAGE_INFO.downloadUrl;
  document.body.appendChild(iframe);
  setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch (e) {
      void e;
    }
  }, 30000);
}

export function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  const isDisplayStandalone = Boolean(
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  );
  const isAndroidNativeApp = Boolean(
    (window.navigator.userAgent && window.navigator.userAgent.includes('InsuMinder-Android')) ||
    (typeof window.location !== 'undefined' && new URLSearchParams(window.location.search).get('app') === 'android')
  );
  return isDisplayStandalone || isAndroidNativeApp;
}

export async function checkIsAppInstalled() {
  if (isStandaloneApp()) return true;
  // If running in browser on web, clean up any legacy false-positive flags
  try {
    localStorage.removeItem('insuminder_app_installed');
  } catch (e) {
    void e;
  }
  if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
    try {
      const related = await navigator.getInstalledRelatedApps();
      if (Array.isArray(related) && related.length > 0) {
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
      sessionStorage.setItem('insuminder_app_just_installed', 'true');
    } else {
      sessionStorage.removeItem('insuminder_app_just_installed');
      localStorage.removeItem('insuminder_app_installed');
    }
  } catch (e) {
    void e;
  }
}

// In-App Updates Management
let updateListeners = new Set();
let pendingUpdateInfo = null;
let waitingWorker = null;

export const DEFAULT_APP_VERSION = '1.0.0';

export function getStoredAppVersion() {
  if (typeof window === 'undefined') return DEFAULT_APP_VERSION;
  try {
    return localStorage.getItem('insuminder_app_version') || DEFAULT_APP_VERSION;
  } catch {
    return DEFAULT_APP_VERSION;
  }
}

export function setStoredAppVersion(version) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('insuminder_app_version', version);
  } catch (e) {
    void e;
  }
}

export function subscribeToAppUpdates(callback) {
  updateListeners.add(callback);
  if (pendingUpdateInfo) {
    callback(pendingUpdateInfo);
  }
  return () => updateListeners.delete(callback);
}

function notifyUpdateListeners(info) {
  pendingUpdateInfo = info;
  updateListeners.forEach((fn) => {
    try {
      fn(info);
    } catch (e) {
      console.warn('[PWA] Update listener error:', e);
    }
  });
}

// Fetch version metadata and check if an update is available
export async function checkForAppUpdate() {
  if (typeof window === 'undefined') return null;

  try {
    const currentVer = getStoredAppVersion();
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const remoteVer = data.version || currentVer;

    // First run initialization: if no stored version, store remoteVer
    if (!localStorage.getItem('insuminder_app_version')) {
      setStoredAppVersion(remoteVer);
      return null;
    }

    if (remoteVer !== currentVer) {
      const info = {
        updateAvailable: true,
        currentVersion: currentVer,
        newVersion: remoteVer,
        buildTime: data.buildTime,
        changes: data.changes || {}
      };
      notifyUpdateListeners(info);
      return info;
    }
  } catch {
    // Offline or network error - silently return null
    return null;
  }
  return null;
}

// Hook Service Worker lifecycle to detect updates
export function initServiceWorkerUpdateWatcher(registration) {
  if (!registration || typeof window === 'undefined') return;

  // 1. If a worker is already waiting, trigger update immediately
  if (registration.waiting) {
    waitingWorker = registration.waiting;
    checkForAppUpdate();
  }

  // 2. Listen for newly installing worker transitioning to waiting
  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
        waitingWorker = installingWorker;
        checkForAppUpdate();
      }
    });
  });

  // 3. When controller changes (after SKIP_WAITING), reload window
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Trigger update activation
export async function applyAppUpdate(newVersion = null) {
  if (newVersion) {
    setStoredAppVersion(newVersion);
  }

  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    // If not waiting on SW, clear runtime caches and reload
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        void e;
      }
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}


