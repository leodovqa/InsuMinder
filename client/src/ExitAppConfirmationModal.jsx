import { useEffect } from 'react';
import { useTranslation } from './i18n';
import useLockBodyScroll from './useLockBodyScroll';

export default function ExitAppConfirmationModal({ isOpen, onClose, onConfirm }) {
  const { t } = useTranslation();

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

  return (
    <div
      className="modal-overlay exit-app-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
    >
      <div
        className="modal-card exit-app-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="exit-modal-header-left">
            <div className="modal-icon-wrapper exit-icon-wrapper" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <h3 id="exit-modal-title" className="modal-title">
              {t('modals.exitAppTitle')}
            </h3>
          </div>
          <button
            type="button"
            className="modal-close-x-btn"
            onClick={onClose}
            aria-label={t('common.closeModal') || 'Close'}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="exit-modal-text">
            {t('modals.exitAppMessage')}
          </p>
        </div>

        <div className="modal-actions exit-app-modal-actions">
          <button
            type="button"
            className="modal-btn cancel-btn exit-cancel-btn"
            onClick={onClose}
          >
            {t('modals.exitAppCancelBtn')}
          </button>
          <button
            type="button"
            className="modal-btn confirm-exit-btn"
            onClick={onConfirm}
          >
            {t('modals.exitAppConfirmBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
