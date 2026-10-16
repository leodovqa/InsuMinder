import { useEffect } from 'react';
import { useTranslation } from './i18n';
import { downloadAndroidApk, ANDROID_PACKAGE_INFO } from './pwa';

export default function AndroidInstallModal({ isOpen, onClose }) {
  const { t } = useTranslation();

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

  const handleDownloadAgain = (e) => {
    e.preventDefault();
    downloadAndroidApk();
  };

  return (
    <div
      className="modal-overlay android-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-modal-title"
    >
      <div
        className="modal-card android-install-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header android-modal-header">
          <div className="android-modal-icon-badge">
            <span className="android-badge-icon" role="img" aria-hidden="true">🤖</span>
            <div className="android-badge-text-col">
              <h2 id="android-modal-title" className="android-modal-title">
                {t('androidModal.title')}
              </h2>
              <span className="android-modal-badge">
                ✓ {t('androidModal.badge')} ({ANDROID_PACKAGE_INFO.version})
              </span>
            </div>
          </div>
          <button
            type="button"
            className="android-modal-close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <div className="android-modal-body">
          {/* Download Notification Banner */}
          <div className="android-download-status-banner">
            <span className="status-pulse-dot" />
            <div className="status-text-block">
              <strong>{t('androidModal.downloadStarted')}</strong>
              <p>
                <a
                  href={ANDROID_PACKAGE_INFO.downloadUrl}
                  onClick={handleDownloadAgain}
                  className="android-manual-download-link"
                >
                  {t('androidModal.downloadManual')}
                </a>
              </p>
            </div>
          </div>

          {/* Step-by-Step Installation Guide */}
          <div className="android-steps-list">
            <div className="android-step-item">
              <div className="android-step-number">1</div>
              <div className="android-step-content">
                <h4 className="android-step-title">{t('androidModal.step1Title')}</h4>
                <p className="android-step-desc">{t('androidModal.step1Desc')}</p>
              </div>
            </div>

            <div className="android-step-item">
              <div className="android-step-number">2</div>
              <div className="android-step-content">
                <h4 className="android-step-title">{t('androidModal.step2Title')}</h4>
                <p className="android-step-desc">{t('androidModal.step2Desc')}</p>
              </div>
            </div>

            <div className="android-step-item">
              <div className="android-step-number">3</div>
              <div className="android-step-content">
                <h4 className="android-step-title">{t('androidModal.step3Title')}</h4>
                <p className="android-step-desc">{t('androidModal.step3Desc')}</p>
              </div>
            </div>
          </div>

          {/* Genuine Guarantee & Live In-App Updates Note */}
          <div className="android-guarantee-box">
            <div className="guarantee-header-row">
              <span className="guarantee-shield-icon" role="img" aria-hidden="true">🛡️</span>
              <strong className="guarantee-title">{t('androidModal.guaranteeTitle')}</strong>
            </div>
            <p className="guarantee-desc">{t('androidModal.guaranteeDesc')}</p>
          </div>
        </div>

        <div className="modal-footer android-modal-footer">
          <a
            href={ANDROID_PACKAGE_INFO.downloadUrl}
            onClick={handleDownloadAgain}
            className="save-btn android-direct-download-btn"
          >
            ⬇️ {t('notificationSettings.pwaInstallBtn')}
          </a>
          <button
            type="button"
            className="android-modal-gotit-btn"
            onClick={onClose}
          >
            {t('androidModal.closeBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
