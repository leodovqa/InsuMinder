import { useEffect } from 'react';
import { useTranslation } from './i18n';
import useLockBodyScroll from './useLockBodyScroll';
import { APP_CURRENT_CHANGELOG } from './pwa';

export default function UpdateSuccessModal({ version, onClose }) {
  const { t, language } = useTranslation();

  // Strictly lock background body scrolling while success modal is open
  useLockBodyScroll(Boolean(version));

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!version) return null;

  const rawChanges = APP_CURRENT_CHANGELOG || {};
  const changesList = Array.isArray(rawChanges[language]) && rawChanges[language].length > 0
    ? rawChanges[language]
    : Array.isArray(rawChanges.en)
      ? rawChanges.en
      : [];

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay update-success-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-success-title"
      onClick={handleBackdropClick}
    >
      <div className="modal-card update-success-card" onClick={(e) => e.stopPropagation()}>
        <div className="update-success-header">
          <div className="update-success-icon-badge" aria-hidden="true">
            <span className="update-success-emoji">🎉</span>
          </div>
          <div className="update-success-titles">
            <h2 id="update-success-title" className="update-success-title">
              {t('appUpdate.successTitle')}
            </h2>
            <span className="update-success-version-pill">
              v{version}
            </span>
          </div>
        </div>

        <div className="update-success-body">
          <p className="update-success-desc">
            {t('appUpdate.successDesc')}
          </p>

          {changesList.length > 0 && (
            <div className="update-success-changelog">
              <p className="update-success-changelog-title">{t('appUpdate.whatsNew')}</p>
              <ul className="update-success-changes-list">
                {changesList.map((item, idx) => (
                  <li key={idx} className="update-success-change-item">
                    <span className="update-success-bullet" aria-hidden="true">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="update-success-actions">
          <button
            type="button"
            className="btn-update-success-continue"
            onClick={onClose}
          >
            <span>{t('appUpdate.continueBtn')}</span>
            <span className="update-success-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

