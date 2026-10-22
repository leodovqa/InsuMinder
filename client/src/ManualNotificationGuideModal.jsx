import { useEffect } from 'react';
import { useTranslation } from './i18n';
import useLockBodyScroll from './useLockBodyScroll';
import { downloadAndroidApk, isAndroidApp } from './pwa';

export default function ManualNotificationGuideModal({ isOpen, onClose, onActivated = null }) {
  const { t } = useTranslation();
  const isAndroid = isAndroidApp();

  useLockBodyScroll(Boolean(isOpen));

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirmActivated = () => {
    try {
      localStorage.setItem('insuminder_device_notifications_active', 'true');
    } catch (e) {
      void e;
    }
    if (onActivated) {
      onActivated();
    }
    onClose();
  };

  return (
    <div
      className="modal-overlay manual-guide-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-guide-title"
    >
      <div
        className="modal-card manual-guide-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="manual-guide-header">
          <div className="manual-guide-icon-badge" aria-hidden="true">
            <span className="manual-guide-icon">🔔</span>
          </div>
          <div className="manual-guide-titles">
            <h2 id="manual-guide-title" className="manual-guide-title">
              {t('notificationSettings.manualGuideTitle')}
            </h2>
            <p className="manual-guide-subtitle">
              {t('notificationSettings.manualGuideSubtitle')}
            </p>
          </div>
        </div>

        <div className="manual-guide-body">
          <div className="manual-guide-steps">
            <div className="manual-guide-step-item">
              <span className="step-number" aria-hidden="true">1</span>
              <div className="step-content">
                <p className="step-text">{t('notificationSettings.manualGuideStep1')}</p>
              </div>
            </div>

            <div className="manual-guide-step-item">
              <span className="step-number" aria-hidden="true">2</span>
              <div className="step-content">
                <p className="step-text">{t('notificationSettings.manualGuideStep2')}</p>
              </div>
            </div>

            <div className="manual-guide-step-item">
              <span className="step-number" aria-hidden="true">3</span>
              <div className="step-content">
                <p className="step-text">{t('notificationSettings.manualGuideStep3')}</p>
              </div>
            </div>
          </div>

          {isAndroid && (
            <div className="manual-guide-apk-box">
              <p className="manual-guide-apk-hint">
                {t('notificationSettings.outdatedApkWarning')}
              </p>
              <button
                type="button"
                className="push-action-btn btn-primary"
                onClick={downloadAndroidApk}
              >
                📥 {t('notificationSettings.manualGuideDownloadBtn')}
              </button>
            </div>
          )}
        </div>

        <div className="manual-guide-actions">
          <button
            type="button"
            className="push-action-btn btn-primary manual-guide-activated-btn"
            onClick={handleConfirmActivated}
          >
            ✓ {t('notificationSettings.manualGuideActivatedBtn')}
          </button>
          <button
            type="button"
            className="push-action-btn btn-settings manual-guide-close-btn"
            onClick={onClose}
          >
            {t('notificationSettings.manualGuideCloseBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
