import { useState, useEffect } from 'react';
import { useTranslation } from './i18n';
import {
  subscribeToAppUpdates,
  checkForAppUpdate,
  applyAppUpdate
} from './pwa';

export default function UpdateBanner() {
  const { t, language } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // 1. Subscribe to push updates from Service Worker or version polling
    const unsubscribe = subscribeToAppUpdates((info) => {
      if (info && info.updateAvailable) {
        setUpdateInfo(info);
      }
    });

    // 2. Initial check on mount
    checkForAppUpdate();

    // 3. Periodic check every 15 minutes or when tab becomes visible
    const interval = setInterval(checkForAppUpdate, 15 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForAppUpdate();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubscribe();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  if (!updateInfo || !updateInfo.updateAvailable || isDismissed) {
    return null;
  }

  const rawChanges = updateInfo.changes || {};
  const changesList = Array.isArray(rawChanges[language]) && rawChanges[language].length > 0
    ? rawChanges[language]
    : Array.isArray(rawChanges.en)
      ? rawChanges.en
      : [];

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await applyAppUpdate(updateInfo.newVersion);
    } catch (e) {
      console.error('[UpdateBanner] Failed to apply update:', e);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <aside
      className="app-update-banner"
      role="region"
      aria-label={t('appUpdate.title')}
    >
      <div className="update-banner-container">
        <div className="update-banner-header">
          <div className="update-badge-wrapper">
            <span className="update-rocket-icon" aria-hidden="true">🚀</span>
            <span className="update-title">{t('appUpdate.title')}</span>
            <span className="update-version-tag">v{updateInfo.newVersion}</span>
          </div>
          <button
            type="button"
            className="update-close-btn"
            onClick={handleDismiss}
            aria-label={t('appUpdate.dismiss')}
          >
            ✕
          </button>
        </div>

        {changesList.length > 0 && (
          <div className="update-banner-body">
            <p className="update-whats-new-label">{t('appUpdate.whatsNew')}</p>
            <ul className="update-changes-list">
              {changesList.map((item, idx) => (
                <li key={idx} className="update-change-item">
                  <span className="update-bullet" aria-hidden="true">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="update-banner-actions">
          <button
            type="button"
            className="btn-update-now"
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <span className="update-spinner" aria-hidden="true"></span>
                <span>{t('appUpdate.updating')}</span>
              </>
            ) : (
              t('appUpdate.updateNow')
            )}
          </button>
          <button
            type="button"
            className="btn-update-later"
            onClick={handleDismiss}
            disabled={isUpdating}
          >
            {t('appUpdate.updateLater')}
          </button>
        </div>
      </div>
    </aside>
  );
}
