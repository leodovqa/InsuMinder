import { useState, useEffect } from 'react';
import { useTranslation } from './i18n';
import {
  subscribeToAppUpdates,
  checkForAppUpdate,
  applyAppUpdate,
  recordPostponedUpdate,
  isAndroidApp
} from './pwa';

export default function UpdateBanner() {
  const { t, language } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // 1. Only Android APK shows the update popup modal
    if (!isAndroidApp()) {
      return;
    }

    const isSessionDismissed = (info) => {
      if (!info) return true;
      const isMandatory = Boolean(
        info.isMandatory || (typeof info.versionsBehind === 'number' && info.versionsBehind >= 3)
      );
      if (isMandatory) return false;
      try {
        const dismissedVer = sessionStorage.getItem('insuminder_update_dismissed_version');
        return dismissedVer === info.newVersion;
      } catch {
        return false;
      }
    };

    // 2. Subscribe to push updates from Service Worker or version polling
    const unsubscribe = subscribeToAppUpdates((info) => {
      if (info && info.updateAvailable) {
        setUpdateInfo(info);
        if (isSessionDismissed(info)) {
          setIsDismissed(true);
        } else {
          setIsDismissed(false);
        }
      }
    });

    // 3. Initial check on mount
    checkForAppUpdate();

    // 4. Periodic check every 15 minutes or when tab becomes visible
    const interval = setInterval(checkForAppUpdate, 15 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForAppUpdate();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 5. Reset dismissal on new or re-login event
    const onResetDismiss = () => {
      setIsDismissed(false);
      checkForAppUpdate();
    };
    window.addEventListener('insuminder_update_reset_dismiss', onResetDismiss);

    // 6. Escape key handling (only for non-mandatory updates)
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setUpdateInfo((current) => {
          if (current && !current.isMandatory && !(current.versionsBehind >= 3)) {
            recordPostponedUpdate(current.newVersion);
            try {
              sessionStorage.setItem('insuminder_update_dismissed_version', current.newVersion);
            } catch {
              // ignore session storage errors
            }
            setIsDismissed(true);
          }
          return current;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      unsubscribe();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('insuminder_update_reset_dismiss', onResetDismiss);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Must only run for Android APK
  if (!isAndroidApp()) {
    return null;
  }

  if (!updateInfo || !updateInfo.updateAvailable) {
    return null;
  }

  const isMandatory = Boolean(
    updateInfo.isMandatory ||
    (typeof updateInfo.versionsBehind === 'number' && updateInfo.versionsBehind >= 3)
  );

  // If dismissed in this session and not mandatory, do not render
  if (isDismissed && !isMandatory) {
    return null;
  }

  // Double check session storage for non-mandatory updates
  try {
    if (!isMandatory && sessionStorage.getItem('insuminder_update_dismissed_version') === updateInfo.newVersion) {
      return null;
    }
  } catch {
    // ignore session storage errors
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
    if (isMandatory) return;
    recordPostponedUpdate(updateInfo.newVersion);
    try {
      sessionStorage.setItem('insuminder_update_dismissed_version', updateInfo.newVersion);
    } catch {
      // ignore session storage errors
    }
    setIsDismissed(true);
  };

  const handleBackdropClick = (e) => {
    if (isMandatory) return;
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  };

  return (
    <div
      className={`modal-overlay update-modal-overlay ${isMandatory ? 'update-blocking-overlay' : ''}`}
      role={isMandatory ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby="update-modal-title"
      onClick={handleBackdropClick}
    >
      <div
        className={`modal-card update-modal-card ${isMandatory ? 'update-blocking-modal' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="update-modal-header">
          <div className="update-modal-header-left">
            <span className="update-modal-icon" aria-hidden="true">
              {isMandatory ? '🛑' : '🚀'}
            </span>
            <div className="update-modal-titles">
              <h2 id="update-modal-title" className={isMandatory ? 'update-blocking-title' : 'update-modal-title'}>
                {isMandatory ? t('appUpdate.mandatoryTitle') : t('appUpdate.title')}
              </h2>
              <span className={isMandatory ? 'update-blocking-version-pill' : 'update-version-tag'}>
                v{updateInfo.newVersion}
              </span>
            </div>
          </div>
          {!isMandatory && (
            <button
              type="button"
              className="update-close-btn"
              onClick={handleDismiss}
              aria-label={t('appUpdate.dismiss')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="update-modal-body">
          {isMandatory && (
            <p className="update-blocking-desc">
              {t('appUpdate.mandatoryDesc', { count: updateInfo.versionsBehind || 3 })}
            </p>
          )}

          {changesList.length > 0 && (
            <div className={`update-banner-body ${isMandatory ? 'update-blocking-body' : 'update-modal-changelog'}`}>
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
        </div>

        <div className="update-modal-actions">
          <button
            type="button"
            className={`btn-update-now ${isMandatory ? 'btn-blocking-update' : ''}`}
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
          {!isMandatory && (
            <button
              type="button"
              className="btn-update-later"
              onClick={handleDismiss}
              disabled={isUpdating}
            >
              {t('appUpdate.updateLater')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
