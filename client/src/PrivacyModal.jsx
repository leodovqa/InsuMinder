import { useTranslation } from './i18n';
import useLockBodyScroll from './useLockBodyScroll';

export default function PrivacyModal({
  isOpen,
  requireConsent = false,
  onClose,
  onAccept,
  onConsent,
  onDecline,
  isSubmitting = false
}) {
  const { t } = useTranslation();
  useLockBodyScroll(Boolean(isOpen));

  const handleAccept = onAccept || onConsent;

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !requireConsent && onClose) {
      onClose();
    }
  };

  return (
    <div
      className={`modal-backdrop privacy-modal-backdrop ${requireConsent ? 'mandatory-consent' : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <div className="modal-content privacy-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="privacy-modal-header">
          <div className="privacy-header-text">
            <h2 id="privacy-modal-title" className="privacy-modal-title">
              {requireConsent ? t('privacy.mandatoryTitle') : t('privacy.modalTitle')}
            </h2>
            <p className="privacy-modal-subtitle">
              {requireConsent ? t('privacy.mandatorySubtitle') : t('privacy.modalSubtitle')}
            </p>
          </div>
          {!requireConsent && onClose && (
            <button
              type="button"
              className="close-btn privacy-close-btn"
              onClick={onClose}
              aria-label={t('common.closeModal')}
            >
              &times;
            </button>
          )}
        </div>

        {/* Mandatory Action Alert Banner */}
        {requireConsent && (
          <div className="privacy-mandatory-alert" role="alert">
            <p>{t('privacy.mandatoryNotice')}</p>
          </div>
        )}

        {/* Highlight Banner */}
        <div className="privacy-highlight-box">
          <div className="privacy-highlight-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>{t('privacy.bannerHeadline')}</span>
          </div>
          <p className="privacy-highlight-text">
            {t('privacy.bannerText')}
          </p>
        </div>

        {/* Scrollable Policy Body */}
        <div className="privacy-scroll-body" tabIndex={0} role="region" aria-label={t('privacy.modalTitle')}>
          <div className="privacy-policy-section">
            <h3 className="privacy-section-title">{t('privacy.sec1Title')}</h3>
            <p className="privacy-section-body">{t('privacy.sec1Body')}</p>
          </div>

          <div className="privacy-policy-section">
            <h3 className="privacy-section-title">{t('privacy.sec2Title')}</h3>
            <p className="privacy-section-body">{t('privacy.sec2Body')}</p>
          </div>

          <div className="privacy-policy-section">
            <h3 className="privacy-section-title">{t('privacy.sec3Title')}</h3>
            <p className="privacy-section-body">{t('privacy.sec3Body')}</p>
          </div>

          <div className="privacy-policy-section">
            <h3 className="privacy-section-title">{t('privacy.sec4Title')}</h3>
            <p className="privacy-section-body">{t('privacy.sec4Body')}</p>
          </div>

          <div className="privacy-policy-section">
            <h3 className="privacy-section-title">{t('privacy.sec5Title')}</h3>
            <p className="privacy-section-body">{t('privacy.sec5Body')}</p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="privacy-modal-actions">
          {requireConsent ? (
            <div className="privacy-consent-actions">
              <button
                type="button"
                className="primary-btn privacy-accept-btn"
                onClick={handleAccept}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>{t('privacy.accepting')}</span>
                  </span>
                ) : (
                  t('privacy.acceptAndContinue')
                )}
              </button>
              {onDecline && (
                <button
                  type="button"
                  className="secondary-btn privacy-decline-btn"
                  onClick={onDecline}
                  disabled={isSubmitting}
                >
                  {t('privacy.declineAndSignOut')}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="primary-btn privacy-close-action-btn"
              onClick={onClose}
            >
              {t('privacy.close')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
