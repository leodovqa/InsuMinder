import { useState, useEffect } from 'react';
import { useTranslation } from './i18n';
import useLockBodyScroll from './useLockBodyScroll';
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
  const [progress, setProgress] = useState({ percent: 0, stage: '' });
  const [updateError, setUpdateError] = useState(null);

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

    // 6. Direct trigger from Settings card to open modal and run update with progress bar
    const onTriggerUpdateFlow = (e) => {
      setIsDismissed(false);
      try {
        sessionStorage.removeItem('insuminder_update_dismissed_version');
      } catch {
        // ignore storage errors
      }
      const targetVersion = e?.detail?.version;
      setUpdateInfo((curr) => {
        const ver = targetVersion || curr?.newVersion;
        if (ver) {
          setIsUpdating(true);
          setUpdateError(null);
          setProgress({ percent: 15, stage: 'checking' });
          applyAppUpdate(ver, (p) => setProgress(p)).catch((err) => {
            console.error('[UpdateBanner] Failed to apply update from trigger:', err);
            setIsUpdating(false);
            setUpdateError(err?.message || t('appUpdate.errorNetwork'));
          });
        }
        return curr;
      });
    };
    window.addEventListener('insuminder_trigger_update_flow', onTriggerUpdateFlow);

    // 7. Escape key handling (only for non-mandatory updates)
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isUpdating) {
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
      window.removeEventListener('insuminder_trigger_update_flow', onTriggerUpdateFlow);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isUpdating, t]);

  // Compute visibility
  const isMandatory = Boolean(
    updateInfo && (
      updateInfo.isMandatory ||
      (typeof updateInfo.versionsBehind === 'number' && updateInfo.versionsBehind >= 3)
    )
  );

  const isSessionDismissed = Boolean(
    !isMandatory &&
    updateInfo &&
    (() => {
      try {
        return sessionStorage.getItem('insuminder_update_dismissed_version') === updateInfo.newVersion;
      } catch {
        return false;
      }
    })()
  );

  const isModalOpen = Boolean(
    isAndroidApp() &&
    updateInfo &&
    updateInfo.updateAvailable &&
    !isDismissed &&
    !isSessionDismissed
  );

  // Strictly lock background body scrolling while update modal is open
  useLockBodyScroll(isModalOpen);

  if (!isModalOpen) {
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
    setUpdateError(null);
    setProgress({ percent: 15, stage: 'checking' });
    try {
      await applyAppUpdate(updateInfo.newVersion, (p) => setProgress(p));
    } catch (e) {
      console.error('[UpdateBanner] Failed to apply update:', e);
      setIsUpdating(false);
      setUpdateError(e?.message || t('appUpdate.errorNetwork'));
    }
  };

  const handleDismiss = () => {
    if (isMandatory || isUpdating) return;
    recordPostponedUpdate(updateInfo.newVersion);
    try {
      sessionStorage.setItem('insuminder_update_dismissed_version', updateInfo.newVersion);
    } catch {
      // ignore session storage errors
    }
    setIsDismissed(true);
  };

  const handleBackdropClick = (e) => {
    if (isMandatory || isUpdating) return;
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
          {!isMandatory && !isUpdating && (
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

          {changesList.length > 0 && !isUpdating && (
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

          {/* Real-time Update Progress Bar & Stage Feedback */}
          {isUpdating && (
            <div className="update-progress-container" role="region" aria-label={t('appUpdate.updating')}>
              <div className="update-progress-bar-track">
                <div
                  className="update-progress-bar-fill"
                  style={{ width: `${progress.percent}%` }}
                  role="progressbar"
                  aria-valuenow={progress.percent}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
              <div className="update-progress-meta">
                <span className="update-progress-stage">
                  {progress.stage === 'checking' && t('appUpdate.stageChecking')}
                  {progress.stage === 'downloading' && t('appUpdate.stageDownloading')}
                  {progress.stage === 'activating' && t('appUpdate.stageActivating')}
                  {progress.stage === 'complete' && t('appUpdate.stageComplete')}
                  {!progress.stage && t('appUpdate.updating')}
                </span>
                <span className="update-progress-percent">{progress.percent}%</span>
              </div>
            </div>
          )}

          {/* Error & Retry Banner */}
          {updateError && (
            <div className="update-error-container" role="alert">
              <div className="update-error-header">
                <span className="update-error-icon" aria-hidden="true">⚠️</span>
                <strong className="update-error-title">{t('appUpdate.errorTitle')}</strong>
              </div>
              <p className="update-error-msg">{updateError}</p>
              <button
                type="button"
                className="btn-update-retry"
                onClick={handleUpdate}
              >
                {t('appUpdate.retry')}
              </button>
            </div>
          )}
        </div>

        <div className="update-modal-actions">
          {!isUpdating && (
            <>
              <button
                type="button"
                className={`btn-update-now ${isMandatory ? 'btn-blocking-update' : ''}`}
                onClick={handleUpdate}
              >
                {t('appUpdate.updateNow')}
              </button>
              {!isMandatory && (
                <button
                  type="button"
                  className="btn-update-later"
                  onClick={handleDismiss}
                >
                  {t('appUpdate.updateLater')}
                </button>
              )}
            </>
          )}
          {isUpdating && (
            <div className="update-in-progress-badge">
              <span className="update-spinner" aria-hidden="true"></span>
              <span>{t('appUpdate.updating')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
