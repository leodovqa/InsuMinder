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
          <h3 id="exit-modal-title" className="modal-title">
            {t('modals.exitAppTitle')}
          </h3>
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
