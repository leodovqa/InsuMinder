import { useState, useEffect } from 'react';
import { useTranslation } from './i18n';
import {
  isPushSupported,
  getNotificationPermission,
  getExistingPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  isStandaloneApp,
  checkIsAppInstalled,
  downloadAndroidApk
} from './pwa';
import { authService } from './authService';

export default function NotificationSettings({
  preferences,
  onUpdatePreferences,
  onDownloadApk
}) {
  const { t } = useTranslation();
  const [activeScope, setActiveScope] = useState('personal'); // 'personal' | 'shared'

  // Push notification state
  const [pushSupported] = useState(() => isPushSupported());
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [pushFeedback, setPushFeedback] = useState(null);

  // PWA install state
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneApp());
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkExistingSub() {
      if (isPushSupported()) {
        const sub = await getExistingPushSubscription();
        if (isMounted) {
          setIsSubscribed(Boolean(sub));
          setPermission(getNotificationPermission());
        }
      }
      const installed = await checkIsAppInstalled();
      if (isMounted && installed) {
        setIsStandalone(true);
      }
    }
    checkExistingSub();

    return () => {
      isMounted = false;
    };
  }, []);

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
        const res = await subscribeToPush(authHeader);
        setPermission(getNotificationPermission());
        if (res.ok) {
          setIsSubscribed(true);
          setPushFeedback({ text: t('notificationSettings.devicePushTestSuccess'), isError: false });
        } else {
          setPushFeedback({ text: res.error || 'Failed to enable push notifications.', isError: true });
        }
      }
    } catch (err) {
      setPushFeedback({ text: err.message || 'Push error occurred.', isError: true });
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    setTestPushLoading(true);
    setPushFeedback(null);
    try {
      const authHeader = authService.getToken() ? `Bearer ${authService.getToken()}` : null;
      const res = await sendTestPush(authHeader);
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
              onClick={() => setActiveScope('personal')}
            >
              <span className="scope-pill-icon" role="img" aria-hidden="true">👤</span>
              <span className="scope-pill-label">{t('notificationSettings.scopePersonal')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'shared'}
              className={`scope-pill-btn ${activeScope === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveScope('shared')}
            >
              <span className="scope-pill-icon" role="img" aria-hidden="true">👥</span>
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
                  <div className="notification-card-header-row">
                    <h3 className="notification-card-title">
                      {t(`notificationSettings.${item.titleKey}`)}
                    </h3>
                    <span
                      className={`notification-status-badge ${isEnabled ? 'badge-active' : 'badge-disabled'}`}
                    >
                      {isEnabled
                        ? t('notificationSettings.activeStatus')
                        : t('notificationSettings.disabledStatus')}
                    </span>
                  </div>
                  <p className="notification-card-description">
                    {t(`notificationSettings.${item.descKey}`)}
                  </p>
                </div>

                <div className="notification-card-action">
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
                      : isSubscribed
                      ? 'badge-active'
                      : 'badge-disabled'
                  }`}
                >
                  {permission === 'denied'
                    ? t('notificationSettings.devicePushBlockedBadge')
                    : isSubscribed
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
                  <p className="blocked-alert-text">{t('notificationSettings.devicePushBlockedHint')}</p>
                </div>
              )}

              {pushFeedback && (
                <div className={`push-feedback-banner ${pushFeedback.isError ? 'error' : 'success'}`}>
                  <span>{pushFeedback.text}</span>
                </div>
              )}

              <div className="device-push-actions">
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
