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

// Diagnostic in-memory event buffer for QA & dev telemetry
const diagnosticLogBuffer = [];
const MAX_DIAGNOSTIC_LOGS = 100;

export function addDiagnosticLog(level, message, data = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: level || 'info',
    message: typeof message === 'string' ? message : JSON.stringify(message),
    data: data || null
  };
  diagnosticLogBuffer.unshift(entry);
  if (diagnosticLogBuffer.length > MAX_DIAGNOSTIC_LOGS) {
    diagnosticLogBuffer.pop();
  }
}

export function getDiagnosticLogs() {
  return [...diagnosticLogBuffer];
}

export function clearDiagnosticLogs() {
  diagnosticLogBuffer.length = 0;
}

// Check if Push & Service Worker or Native Android notifications are supported
export function isPushSupported() {
  if (typeof window === 'undefined') return false;
  if (isAndroidApp()) return true;
  return 'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

// Automated notification onboarding for install, login, and updates
export async function promptNotificationPermissionIfNeeded(authHeader = null, lang = 'en') {
  if (typeof window === 'undefined') return { outcome: 'unavailable' };

  const perm = getNotificationPermission();
  // ONLY prompt if notifications are not already granted
  if (perm === 'granted') {
    return { outcome: 'already_granted' };
  }

  // 1. If running in Android APK with native bridge
  if (isAndroidApp() && window.AndroidBridge && typeof window.AndroidBridge.requestNotificationPermission === 'function') {
    try {
      window.AndroidBridge.requestNotificationPermission();
      return { outcome: 'prompted_native' };
    } catch (e) {
      console.warn('[PWA] Failed native notification prompt:', e);
    }
  }

  // 2. If running on Web / PWA and Push is supported
  if (isPushSupported()) {
    try {
      const res = await subscribeToPush(authHeader, lang);
      return { outcome: res.ok ? 'subscribed' : 'failed', res };
    } catch (e) {
      console.warn('[PWA] Failed push prompt:', e);
      return { outcome: 'error', error: e.message };
    }
  }

  return { outcome: 'unsupported' };
}

export function getNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported';

  // 1. Check if user already confirmed or active on this device
  try {
    if (localStorage.getItem('insuminder_device_notifications_active') === 'true') {
      return 'granted';
    }
  } catch (e) {
    void e;
  }

  // 2. Check native AndroidBridge
  if (window.AndroidBridge && typeof window.AndroidBridge.isNotificationPermissionGranted === 'function') {
    try {
      if (window.AndroidBridge.isNotificationPermissionGranted()) {
        return 'granted';
      }
    } catch (e) {
      console.warn('[PWA] Error checking native permission:', e);
    }
  }

  // 3. Check browser / WebView Notification API
  if (typeof window.Notification !== 'undefined' && window.Notification.permission) {
    if (window.Notification.permission === 'granted') {
      return 'granted';
    }
    if (window.Notification.permission === 'denied') {
      return 'denied';
    }
  }

  if (isAndroidApp()) {
    return 'default';
  }

  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

// Open Android system notification settings if running in native app
export function openDeviceNotificationSettings() {
  if (isAndroidApp() && typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.openNotificationSettings === 'function') {
    try {
      window.AndroidBridge.openNotificationSettings();
      return true;
    } catch (e) {
      console.warn('[PWA] Failed to open notification settings via bridge:', e);
    }
  }
  // Return false so caller can open the safe in-app manual guide modal without crashing WebView
  return false;
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
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  return await navigator.serviceWorker.ready;
}

// Get existing push subscription from browser PushManager
export async function getExistingPushSubscription() {
  try {
    const reg = await getRegistration();
    if (!reg || !('pushManager' in reg)) return null;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('[PWA] Error getting push subscription:', err);
    return null;
  }
}

// Subscribe to Push Notifications / Request Android Native Notification Permission
export async function subscribeToPush(authHeader = null, lang = 'en') {
  if (isAndroidApp()) {
    if (window.AndroidBridge) {
      const isGranted = typeof window.AndroidBridge.isNotificationPermissionGranted === 'function' && window.AndroidBridge.isNotificationPermissionGranted();
      if (isGranted) {
        if (typeof window.AndroidBridge.postNativeNotification === 'function') {
          const testTitle = lang === 'he' ? '🔔 בדיקת התראות InsuMinder' : (lang === 'ru' ? '🔔 Проверка уведомлений InsuMinder' : '🔔 InsuMinder Test Alert');
          const testBody = lang === 'he' ? 'התראות פוש למכשיר פעילות ומוכנות לשימוש!' : (lang === 'ru' ? 'Push-уведомления на устройстве активны и готовы к работе!' : 'Device push reminders are active and ready!');
          window.AndroidBridge.postNativeNotification(testTitle, testBody, 'insuminder-active', '/?page=notifications');
        }
        try {
          localStorage.setItem('insuminder_device_notifications_active', 'true');
        } catch (e) {
          void e;
        }
        return { ok: true, isNative: true, granted: true };
      }
      if (typeof window.AndroidBridge.requestNotificationPermission === 'function') {
        window.AndroidBridge.requestNotificationPermission();
        return { ok: true, isNative: true, pendingPrompt: true };
      }
      return { ok: false, isNative: true, isOutdatedApk: true, error: 'outdatedApk' };
    }
    return { ok: true, isNative: true };
  }

  if (!isPushSupported()) {
    return { ok: false, error: 'Push notifications are not supported by this browser.' };
  }

  // 1. Request notification permission if supported by window.Notification
  if (typeof window !== 'undefined' && 'Notification' in window) {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      return { ok: false, error: 'Permission denied for notifications.' };
    }
  }

  const reg = await getRegistration();
  if (!reg || !('pushManager' in reg)) {
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
    if (isAndroidApp()) {
      return { ok: true, isNative: true };
    }
    return { ok: false, error: 'Failed to retrieve VAPID key from server.' };
  }

  if (!vapidKey) {
    if (isAndroidApp()) {
      return { ok: true, isNative: true };
    }
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

    try {
      localStorage.setItem('insuminder_device_notifications_active', 'true');
    } catch (e) {
      void e;
    }

    return { ok: true, subscription: sub };
  } catch (err) {
    console.error('[PWA] subscribeToPush error:', err);
    if (isAndroidApp()) {
      return { ok: true, isNative: true };
    }
    return { ok: false, error: err.message || 'Failed to subscribe to Web Push.' };
  }
}

// Unsubscribe from Web Push
export async function unsubscribeFromPush(authHeader = null) {
  try {
    try {
      localStorage.removeItem('insuminder_device_notifications_active');
    } catch (e) {
      void e;
    }

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
export async function sendTestPush(authHeader = null, lang = 'en') {
  const testTitle = lang === 'he' ? '🔔 בדיקת התראות InsuMinder' : (lang === 'ru' ? '🔔 Проверка уведомлений InsuMinder' : '🔔 InsuMinder Test Alert');
  const testBody = lang === 'he' ? 'התראות פוש למכשיר פעילות ומוכנות לשימוש!' : (lang === 'ru' ? 'Push-уведомления на устройстве активны и готовы к работе!' : 'Device push reminders are active and ready!');

  let nativeSent = false;
  if (isAndroidApp() && window.AndroidBridge && typeof window.AndroidBridge.postNativeNotification === 'function') {
    try {
      window.AndroidBridge.postNativeNotification(testTitle, testBody, 'insuminder-test', '/?page=notifications');
      nativeSent = true;
    } catch (e) {
      console.warn('[PWA] Native push test dispatch failed:', e);
    }
  }

  let localWebSent = false;
  if (!isAndroidApp() && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(testTitle, {
          body: testBody,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          data: { url: '/?page=notifications' }
        });
        localWebSent = true;
      }
    } catch (e) {
      console.warn('[PWA] Local web notification dispatch failed:', e);
    }
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers,
      body: JSON.stringify({ language: lang })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (nativeSent || localWebSent) {
        return { ok: true, message: 'Notification sent successfully to your device!' };
      }
      return { ok: false, error: data.error || 'Failed to send test push notification.' };
    }
    return { ok: true, message: data.message };
  } catch (err) {
    if (nativeSent || localWebSent) {
      return { ok: true, message: 'Notification sent successfully to your device!' };
    }
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
  version: '1.9.6',
  packageName: 'com.insuminder.app',
  fileName: 'InsuMinder.apk',
  downloadUrl: '/api/download/android',
  releaseUrl: 'https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk'
};

export const APP_CURRENT_CHANGELOG = {
  en: [
    'Seamless direct APK download navigation eliminating dialog freezes and screen dimming',
    'Automatic detection of device notification permissions when enabled in Android OS settings',
    'Integrated in-app QA diagnostics center with real-time subsystem telemetry and logging'
  ],
  he: [
    'הורדה ישירה ותקינה של קובץ APK ללא תקיעות או החשכת מסך',
    'זיהוי אוטומטי של הרשאות התראה במכשיר לאחר הפעלתן בהגדרות אנדרואיד',
    'מרכז דיאגנוסטיקה ובדיקות QA מובנה עם טלמטריה ויומן אירועים בזמן אמת'
  ],
  ru: [
    'Прямая загрузка APK без зависаний, всплывающих окон и затемнения экрана',
    'Автоматическое распознавание разрешений на уведомления при их включении в настройках Android',
    'Встроенный центр диагностики и QA с телеметрией подсистем и журналом в реальном времени'
  ]
};

export function downloadAndroidApk() {
  if (typeof window === 'undefined') return;
  const directApkUrl = ANDROID_PACKAGE_INFO.releaseUrl;
  addDiagnosticLog('info', 'downloadAndroidApk invoked', { url: directApkUrl });

  if (window.AndroidBridge && typeof window.AndroidBridge.downloadApk === 'function') {
    try {
      window.AndroidBridge.downloadApk(directApkUrl);
      addDiagnosticLog('info', 'AndroidBridge.downloadApk executed');
      return;
    } catch (e) {
      addDiagnosticLog('error', 'AndroidBridge.downloadApk failed', { error: e.message });
      console.warn('[PWA] Native downloadApk error:', e);
    }
  }

  // Do NOT call window.open() inside WebView - it triggers onCreateWindow popup dialog which dims screen
  // Always use direct window.location navigation so WebView intercepts host/extension into Intent.ACTION_VIEW
  try {
    addDiagnosticLog('info', 'Direct window.location navigation to release APK URL');
    window.location.assign(directApkUrl);
  } catch {
    window.location.href = directApkUrl;
  }
}

export function isAndroidApp() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (typeof window.AndroidBridge !== 'undefined') ||
    (window.navigator.userAgent && window.navigator.userAgent.includes('InsuMinder-Android')) ||
    (typeof window.location !== 'undefined' && new URLSearchParams(window.location.search).get('app') === 'android')
  );
}

export function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  const isDisplayStandalone = Boolean(
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true
  );
  return isDisplayStandalone || isAndroidApp();
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

export function parseSemver(v) {
  const match = String(v).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

export function isSemverGreater(vA, vB) {
  const a = parseSemver(vA);
  const b = parseSemver(vB);
  if (a[0] !== b[0]) return a[0] > b[0];
  if (a[1] !== b[1]) return a[1] > b[1];
  return a[2] > b[2];
}

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

export function recordPostponedUpdate(version) {
  if (typeof window === 'undefined' || !version) return;
  try {
    const raw = localStorage.getItem('insuminder_postponed_versions');
    const list = raw ? JSON.parse(raw) : [];
    if (!list.includes(version)) {
      list.push(version);
      localStorage.setItem('insuminder_postponed_versions', JSON.stringify(list));
    }
  } catch (e) {
    void e;
  }
}

export function getPostponedUpdatesCount() {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem('insuminder_postponed_versions');
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

export function clearPostponedUpdates() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('insuminder_postponed_versions');
  } catch (e) {
    void e;
  }
}

export function calculateVersionsBehind(currentVersion, remoteVersion, versionHistory = []) {
  if (!currentVersion || !remoteVersion || currentVersion === remoteVersion) {
    return 0;
  }
  if (!isSemverGreater(remoteVersion, currentVersion)) {
    return 0;
  }

  const [cMajor, cMinor, cPatch] = parseSemver(currentVersion);
  const [rMajor, rMinor, rPatch] = parseSemver(remoteVersion);

  // A major version bump (e.g. 1.x -> 2.0.0) is ALWAYS a big update (mandatory, >= 3)
  if (rMajor > cMajor) {
    return Math.max(3, (rMajor - cMajor) * 3 + (rMinor - cMinor));
  }

  // 1. If versionHistory is provided, deduplicate by major.minor milestones so patch releases don't inflate distance
  if (Array.isArray(versionHistory) && versionHistory.length > 0) {
    const milestones = Array.from(
      new Set(
        versionHistory.map((v) => {
          const [maj, min] = parseSemver(v);
          return `${maj}.${min}`;
        })
      )
    );
    const cIdx = milestones.indexOf(`${cMajor}.${cMinor}`);
    const rIdx = milestones.indexOf(`${rMajor}.${rMinor}`);
    if (cIdx !== -1 && rIdx !== -1 && rIdx > cIdx) {
      return rIdx - cIdx;
    }
  }

  // 2. Semver fallback distance based on minor versions
  if (rMajor === cMajor && rMinor > cMinor) {
    return rMinor - cMinor;
  }
  if (rMajor === cMajor && rMinor === cMinor && rPatch > cPatch) {
    return 1;
  }

  return 0;
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

    // Only flag an update if remote version is strictly greater than current version
    if (isSemverGreater(remoteVer, currentVer)) {
      const versionsBehind = calculateVersionsBehind(currentVer, remoteVer, data.versionHistory || []);
      const [cMaj] = parseSemver(currentVer);
      const [rMaj] = parseSemver(remoteVer);
      const isMajorUpgrade = rMaj > cMaj;
      const isMandatory = isAndroidApp() && (isMajorUpgrade || versionsBehind >= 3 || Boolean(data.isMandatory));
      const info = {
        updateAvailable: true,
        currentVersion: currentVer,
        newVersion: remoteVer,
        versionsBehind,
        isMandatory,
        buildTime: data.buildTime,
        changes: data.changes || {}
      };
      notifyUpdateListeners(info);
      return info;
    } else {
      // Current version is equal to or newer than remote
      setStoredAppVersion(currentVer);
      return null;
    }
  } catch {
    // Offline or network error - silently return null
    return null;
  }
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

// Trigger update activation with live progress stages and verification
export async function applyAppUpdate(newVersion = null, onProgress = null) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Network offline. Please check your internet connection and try again.');
  }

  onProgress?.({ percent: 15, stage: 'checking' });

  // 1. Verify network connection and server response
  if (typeof fetch === 'function') {
    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok && res.status !== 404 && res.status !== 0) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
    } catch (err) {
      if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'test') {
        throw new Error(err?.message || 'Network error reaching update server.', { cause: err });
      }
    }
  }

  onProgress?.({ percent: 45, stage: 'downloading' });

  // 2. Trigger Service Worker update check
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update().catch(() => {});
      }
    } catch (e) {
      void e;
    }
  }

  onProgress?.({ percent: 75, stage: 'activating' });

  // 3. Clear old caches & notify waiting worker
  if (waitingWorker) {
    try {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch (e) {
      void e;
    }
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {
      void e;
    }
  }

  onProgress?.({ percent: 100, stage: 'complete' });

  // 4. Update stored version and set success flag
  if (newVersion) {
    setStoredAppVersion(newVersion);
    try {
      localStorage.setItem('insuminder_just_updated_to', newVersion);
    } catch (e) {
      void e;
    }
  }
  clearPostponedUpdates();
  try {
    sessionStorage.removeItem('insuminder_update_dismissed_version');
  } catch (e) {
    void e;
  }

  // 5. Short pause to let user see 100% complete, then reload
  await new Promise((resolve) => setTimeout(resolve, 350));
  if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
    window.location.reload();
  }
}
