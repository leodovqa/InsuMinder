import { useState, useEffect } from 'react';
import { useTranslation } from './i18n';
import {
  isPushSupported,
  getNotificationPermission,
  getExistingPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  openDeviceNotificationSettings,
  isAndroidApp,
  isStandaloneApp,
  checkIsAppInstalled,
  downloadAndroidApk
} from './pwa';
import { authService } from './authService';

export default function NotificationSettings({
  preferences,
  onUpdatePreferences,
  onDownloadApk,
  initialScope = 'personal',
  onScopeChange = null
}) {
  const { t, language } = useTranslation();
  const [activeScope, setActiveScope] = useState(initialScope || 'personal');
  const [prevInitialScope, setPrevInitialScope] = useState(initialScope);

  if (initialScope !== prevInitialScope) {
    setPrevInitialScope(initialScope);
    if (initialScope && ['personal', 'shared'].includes(initialScope)) {
      setActiveScope(initialScope);
    }
  }

  const handleScopeSelect = (scope) => {
    setActiveScope(scope);
    if (onScopeChange) {
      onScopeChange(scope);
    }
  };

  // Push notification state
  const [pushSupported] = useState(() => isPushSupported());
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [pushFeedback, setPushFeedback] = useState(null);

  const isAndroid = isAndroidApp();
  const isOutdatedApk = isAndroid && typeof window !== 'undefined' && (!window.AndroidBridge || typeof window.AndroidBridge.openNotificationSettings !== 'function' || typeof window.AndroidBridge.requestNotificationPermission !== 'function');

  // PWA install state
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneApp());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkExistingSub() {
      if (isPushSupported()) {
        const sub = await getExistingPushSubscription();
        if (isMounted) {
          const perm = getNotificationPermission();
          setIsSubscribed(Boolean(sub) || (isAndroid && perm === 'granted'));
          setPermission(perm);
        }
      }
      const installed = await checkIsAppInstalled();
      if (isMounted && installed) {
        setIsStandalone(true);
      }
    }
    checkExistingSub();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        const perm = getNotificationPermission();
        setPermission(perm);
        if (perm === 'granted') {
          setIsSubscribed(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    if (typeof window !== 'undefined') {
      window.__onNativeNotificationPermissionResult = async (granted) => {
        if (!isMounted) return;
        setPushLoading(false);
        setPermission(granted ? 'granted' : 'denied');
        if (granted) {
          setIsSubscribed(true);
          const authHeader = authService.getToken() ? `Bearer ${authService.getToken()}` : null;
          await sendTestPush(authHeader, language);
          setPushFeedback({
            text: t('notificationSettings.devicePushActiveSuccess'),
            isError: false
          });
        } else {
          setIsSubscribed(false);
          setPushFeedback({
            text: t('notificationSettings.devicePushDeclinedBanner'),
            isError: true
          });
        }
      };
    }

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (typeof window !== 'undefined') {
        window.__onNativeNotificationPermissionResult = null;
      }
    };
  }, [isAndroid, language, t]);

  const handleTogglePush = async () => {
    setPushLoading(true);
    setPushFeedback(null);
    try {
      const authHeader = authService.getToken() ? `Bearer ${authService.getToken()}` : null;
      if (isSubscribed) {
        const res = await unsubscribeFromPush(authHeader);
        if (res.ok) {
          setIsSubscribed(false);
          setPermission(getNotificationPermission());
        } else {
          setPushFeedback({ text: res.error || 'Failed to unsubscribe.', isError: true });
        }
      } else {
        const res = await subscribeToPush(authHeader, language);
        if (res.isOutdatedApk) {
          setPushLoading(false);
          setPushFeedback({
            text: t('notificationSettings.outdatedApkWarning'),
            isError: true
          });
          return;
        }
        if (res.pendingPrompt) {
          // Native Android OS runtime permission dialog is active; wait for callback
          // Fallback timer: if the native OS suppresses dialogs (e.g. Xiaomi HyperOS/MIUI),
          // ensure the loading spinner is cleared after 2s and device settings can be opened
          setTimeout(() => {
            setPushLoading(false);
            const current = getNotificationPermission();
            if (current !== 'granted') {
              setPermission('denied');
              setPushFeedback({
                text: t('notificationSettings.devicePushDeclinedBanner'),
                isError: true
              });
            }
          }, 2000);
          return;
        }
        const currentPerm = getNotificationPermission();
        setPermission(currentPerm);
        if (res.ok && (currentPerm === 'granted' || !isAndroid)) {
          setIsSubscribed(true);
          setPermission('granted');
          await sendTestPush(authHeader, language);
          setPushFeedback({ text: t('notificationSettings.devicePushActiveSuccess'), isError: false });
        } else if (currentPerm === 'denied') {
          setIsSubscribed(false);
          setPushFeedback({ text: t('notificationSettings.devicePushDeclinedBanner'), isError: true });
        } else {
          setPushFeedback({ text: res.error || 'Failed to enable push notifications.', isError: true });
        }
      }
    } catch (err) {
      setPushFeedback({ text: err.message || 'Push error occurred.', isError: true });
    } finally {
      if (!isAndroid || getNotificationPermission() !== 'default') {
        setPushLoading(false);
      }
    }
  };

  const handleOpenSettings = () => {
    openDeviceNotificationSettings();
  };

  const handleTestPush = async () => {
    setTestPushLoading(true);
    setPushFeedback(null);
    try {
      const authHeader = authService.getToken() ? `Bearer ${authService.getToken()}` : null;
      const res = await sendTestPush(authHeader, language);
      if (res.ok) {
        setPushFeedback({ text: t('notificationSettings.devicePushTestSuccess'), isError: false });
      } else {
        setPushFeedback({ text: res.error || 'Failed to send test push.', isError: true });
      }
    } catch (err) {
      setPushFeedback({ text: err.message || 'Error sending test push.', isError: true });
    } finally {
      setTestPushLoading(false);
    }
  };

  const handleInstallPwa = () => {
    if (onDownloadApk) {
      onDownloadApk();
      return;
    }
    setInstalling(true);
    downloadAndroidApk();
    setTimeout(() => setInstalling(false), 1200);
  };

  const notificationItems = [
    {
      key: 'rem10m',
      icon: '🍽️',
      titleKey: 'rem10mTitle',
      descKey: 'rem10mDesc'
    },
    {
      key: 'rem2h',
      icon: '🩸',
      titleKey: 'rem2hTitle',
      descKey: 'rem2hDesc'
    },
    {
      key: 'rem3h',
      icon: '🎯',
      titleKey: 'rem3hTitle',
      descKey: 'rem3hDesc'
    },
    {
      key: 'basal',
      icon: '🌙',
      titleKey: 'basalTitle',
      descKey: 'basalDesc'
    }
  ];

  const handleToggle = (key) => {
    const scopePrefs = (preferences && preferences[activeScope]) || {};
    const currentVal = scopePrefs[key] !== false;
    const nextVal = !currentVal;

    const updatedPreferences = {
      ...preferences,
      [activeScope]: {
        ...scopePrefs,
        [key]: nextVal
      }
    };

    if (onUpdatePreferences) {
      onUpdatePreferences(updatedPreferences);
    }
  };

  return (
    <section className="tab-view notification-settings-view">
      <div className="notification-settings-container">
        {/* Top Scope & Subtitle Header */}
        <div className="notification-scope-header">
          <p className="notification-view-subtitle">{t('notificationSettings.subtitle')}</p>

          <div
            className="notification-scope-pill"
            role="tablist"
            aria-label={t('notificationSettings.title')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'personal'}
              className={`scope-pill-btn ${activeScope === 'personal' ? 'active' : ''}`}
              onClick={() => handleScopeSelect('personal')}
            >
              <span className="scope-pill-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span className="scope-pill-label">{t('notificationSettings.scopePersonal')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'shared'}
              className={`scope-pill-btn ${activeScope === 'shared' ? 'active' : ''}`}
              onClick={() => handleScopeSelect('shared')}
            >
              <span className="scope-pill-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <span className="scope-pill-label">{t('notificationSettings.scopeShared')}</span>
            </button>
          </div>

          <div className="notification-scope-caption-row">
            <span className="notification-scope-dot" aria-hidden="true" />
            <span className="notification-scope-desc">
              {activeScope === 'personal'
                ? t('notificationSettings.scopePersonalDesc')
                : t('notificationSettings.scopeSharedDesc')}
            </span>
          </div>
        </div>

        {/* List of Notification Toggle Cards */}
        <div
          className="notification-toggle-list"
          role="region"
          aria-label={activeScope === 'personal' ? t('notificationSettings.scopePersonal') : t('notificationSettings.scopeShared')}
        >
          {notificationItems.map((item) => {
            const isEnabled = ((preferences && preferences[activeScope]) || {})[item.key] !== false;
            return (
              <div
                key={item.key}
                className={`notification-toggle-card ${isEnabled ? 'enabled' : 'disabled'}`}
                onClick={() => handleToggle(item.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggle(item.key);
                  }
                }}
              >
                <div className={`notification-card-icon-wrapper ${item.key}`}>
                  <span className="notification-card-icon" role="img" aria-hidden="true">
                    {item.icon}
                  </span>
                </div>

                <div className="notification-card-content">
                  <h3 className="notification-card-title">
                    {t(`notificationSettings.${item.titleKey}`)}
                  </h3>
                  <p className="notification-card-description">
                    {t(`notificationSettings.${item.descKey}`)}
                  </p>
                </div>

                <div className="notification-card-action">
                  <span
                    className={`notification-status-badge ${isEnabled ? 'badge-active' : 'badge-disabled'}`}
                  >
                    {isEnabled
                      ? t('notificationSettings.activeStatus')
                      : t('notificationSettings.disabledStatus')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={t(`notificationSettings.${item.titleKey}`)}
                    className={`toggle-switch ${isEnabled ? 'checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(item.key);
                    }}
                  >
                    <span className="toggle-switch-handle" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Device & Web Push Notifications Card */}
        <div className="device-push-card">
          <div className="device-push-header">
            <div className="device-push-icon-wrapper">
              <span className="device-push-icon" role="img" aria-hidden="true">🔔</span>
            </div>
            <div className="device-push-title-block">
              <div className="device-push-title-row">
                <h3 className="device-push-title">{t('notificationSettings.devicePushSectionTitle')}</h3>
                <span
                  className={`notification-status-badge ${
                    permission === 'denied'
                      ? 'badge-blocked'
                      : (isSubscribed || (isAndroid && permission === 'granted'))
                      ? 'badge-active'
                      : 'badge-disabled'
                  }`}
                >
                  {permission === 'denied'
                    ? (isAndroid ? t('notificationSettings.devicePushBlockedBadgeDevice') : t('notificationSettings.devicePushBlockedBadge'))
                    : (isSubscribed || (isAndroid && permission === 'granted'))
                    ? t('notificationSettings.devicePushEnabledBadge')
                    : t('notificationSettings.devicePushDisabledBadge')}
                </span>
              </div>
              <p className="device-push-subtitle">{t('notificationSettings.devicePushSectionSubtitle')}</p>
            </div>
          </div>

          {!pushSupported ? (
            <div className="device-push-unsupported">
              <p>{t('notificationSettings.devicePushUnsupported')}</p>
            </div>
          ) : (
            <div className="device-push-body">
              {permission === 'denied' && (
                <div className="device-push-blocked-alert">
                  <span className="blocked-alert-icon" aria-hidden="true">⚠️</span>
                  <p className="blocked-alert-text">
                    {isAndroid
                      ? t('notificationSettings.devicePushBlockedHintDevice')
                      : t('notificationSettings.devicePushBlockedHint')}
                  </p>
                </div>
              )}

              {isOutdatedApk && (
                <div className="device-push-blocked-alert" style={{ marginBottom: '12px' }}>
                  <span className="blocked-alert-icon" aria-hidden="true">⚠️</span>
                  <div style={{ flex: 1 }}>
                    <p className="blocked-alert-text">{t('notificationSettings.outdatedApkWarning')}</p>
                    <button
                      type="button"
                      className="push-action-btn btn-primary"
                      onClick={() => (onDownloadApk ? onDownloadApk() : downloadAndroidApk())}
                      style={{ marginTop: '8px' }}
                    >
                      📥 {t('notificationSettings.outdatedApkDownloadBtn')}
                    </button>
                  </div>
                </div>
              )}

              {pushFeedback && (
                <div className={`push-feedback-banner ${pushFeedback.isError ? 'error' : 'success'}`}>
                  <span>{pushFeedback.text}</span>
                </div>
              )}

              <div className="device-push-actions">
                {isAndroid ? (
                  permission === 'granted' ? (
                    <>
                      <button
                        type="button"
                        className="push-action-btn btn-primary"
                        onClick={handleTestPush}
                        disabled={testPushLoading}
                      >
                        {testPushLoading
                          ? t('notificationSettings.devicePushTesting')
                          : t('notificationSettings.devicePushTestBtn')}
                      </button>
                      <button
                        type="button"
                        className="push-action-btn btn-settings" onClick={handleOpenSettings}
                      >
                        ⚙️ {t('notificationSettings.devicePushOpenSettingsBtn')}
                      </button>
                    </>
                  ) : permission === 'denied' ? (
                    <>
                      <button
                        type="button"
                        className="push-action-btn btn-settings"
                        onClick={handleOpenSettings}
                      >
                        ⚙️ {t('notificationSettings.devicePushOpenSettingsBtn')}
                      </button>
                      <button
                        type="button"
                        className="push-action-btn btn-primary"
                        onClick={handleTogglePush}
                        disabled={pushLoading}
                      >
                        {pushLoading
                          ? '...'
                          : t('notificationSettings.devicePushEnableBtn')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="push-action-btn btn-primary"
                        onClick={handleTogglePush}
                        disabled={pushLoading}
                      >
                        {pushLoading
                          ? '...'
                          : t('notificationSettings.devicePushEnableBtn')}
                      </button>
                      <button
                        type="button"
                        className="push-action-btn btn-settings" onClick={handleOpenSettings}
                      >
                        ⚙️ {t('notificationSettings.devicePushOpenSettingsBtn')}
                      </button>
                    </>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      className={`push-action-btn ${isSubscribed ? 'btn-danger-outline' : 'btn-primary'}`}
                      onClick={handleTogglePush}
                      disabled={pushLoading || permission === 'denied'}
                    >
                      {pushLoading
                        ? '...'
                        : isSubscribed
                        ? t('notificationSettings.devicePushDisableBtn')
                        : t('notificationSettings.devicePushEnableBtn')}
                    </button>

                    {isSubscribed && (
                      <button
                        type="button"
                        className="push-action-btn btn-secondary"
                        onClick={handleTestPush}
                        disabled={testPushLoading}
                      >
                        {testPushLoading
                          ? t('notificationSettings.devicePushTesting')
                          : t('notificationSettings.devicePushTestBtn')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Android App & Offline Installation Card (Only shown on web when not installed) */}
        {!isStandalone && (
          <div className="pwa-install-card">
            <div className="pwa-install-header">
              <div className="pwa-install-icon-wrapper">
                <span className="pwa-install-icon" role="img" aria-hidden="true">📱</span>
              </div>
              <div className="pwa-install-title-block">
                <div className="pwa-install-title-row">
                  <h3 className="pwa-install-title">{t('notificationSettings.pwaInstallSectionTitle')}</h3>
                </div>
                <p className="pwa-install-subtitle">{t('notificationSettings.pwaInstallSectionSubtitle')}</p>
              </div>
            </div>

            <div className="pwa-install-actions">
              <button
                type="button"
                className="push-action-btn btn-accent"
                onClick={handleInstallPwa}
                disabled={installing}
              >
                <span className="install-btn-icon" aria-hidden="true">📲</span>
                {installing ? t('notificationSettings.pwaInstalling') : t('notificationSettings.pwaInstallBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
