import { useState, useEffect } from 'react';
import { useTranslation } from './i18n';
import { downloadAndroidApk, ANDROID_PACKAGE_INFO } from './pwa';
import useLockBodyScroll from './useLockBodyScroll';

export default function AndroidInstallModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);

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

  const handleDownloadAgain = () => {
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
              <div className="android-title-row">
                <h2 id="android-modal-title" className="android-modal-title">
                  {t('androidModal.title')}
                </h2>
                <span className="android-apk-badge" dir="ltr">APK</span>
              </div>
              <div className="android-modal-badge">
                <span className="badge-check-icon" aria-hidden="true">✓</span>
                <span className="badge-text">{t('androidModal.badge')}</span>
                <span className="android-version-pill" dir="ltr">v{ANDROID_PACKAGE_INFO.version}</span>
              </div>
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
                  href={ANDROID_PACKAGE_INFO.releaseUrl}
                  onClick={handleDownloadAgain}
                  className="android-manual-download-link"
                  download="InsuMinder.apk"
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

            <button
              type="button"
              className="android-verify-toggle-btn"
              onClick={() => setShowSecurityDetails((prev) => !prev)}
              aria-expanded={showSecurityDetails}
            >
              <span className={`verify-toggle-icon ${showSecurityDetails ? 'is-expanded' : ''}`} aria-hidden="true">
                {showSecurityDetails ? '▾' : '▸'}
              </span>
              <span>{t('androidModal.verifyDetailsBtn')}</span>
            </button>

            {showSecurityDetails && (
              <div className="android-verify-details-box">
                <div className="android-verify-item">
                  <span className="verify-item-check" aria-hidden="true">✓</span>
                  <span>{t('androidModal.verifySignature')}</span>
                </div>
                <div className="android-verify-item">
                  <span className="verify-item-check" aria-hidden="true">✓</span>
                  <span>{t('androidModal.verifyPermissions')}</span>
                </div>
                <div className="android-verify-item">
                  <span className="verify-item-check" aria-hidden="true">✓</span>
                  <span>{t('androidModal.verifyChecksum')}</span>
                </div>
                <a
                  href="https://github.com/leodovqa/InsuMinder/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="android-verify-link"
                >
                  {t('androidModal.verifyLink')} ↗
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer android-modal-footer">
          <a
            href={ANDROID_PACKAGE_INFO.releaseUrl}
            onClick={handleDownloadAgain}
            className="android-direct-download-btn"
            download="InsuMinder.apk"
          >
            <svg
              className="download-btn-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
            <span className="download-btn-text">{t('notificationSettings.pwaInstallBtn')}</span>
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
