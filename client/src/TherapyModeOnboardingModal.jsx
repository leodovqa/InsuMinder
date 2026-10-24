import { useState } from 'react';
import { useTranslation } from './i18n';
import useLockBodyScroll from './useLockBodyScroll';

export default function TherapyModeOnboardingModal({
  isOpen,
  onSelectMode,
  isSubmitting = false
}) {
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState(null);

  useLockBodyScroll(Boolean(isOpen));

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedMode || isSubmitting) return;
    onSelectMode(selectedMode);
  };

  return (
    <div
      className="modal-backdrop therapy-onboarding-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="therapy-onboarding-title"
    >
      <div className="modal-content therapy-onboarding-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="therapy-onboarding-header">
          <div className="therapy-header-text">
            <h2 id="therapy-onboarding-title" className="therapy-modal-title">
              {t('therapy.onboardingTitle')}
            </h2>
            <p className="therapy-modal-subtitle">
              {t('therapy.onboardingSubtitle')}
            </p>
          </div>
        </div>

        {/* 2 Side-by-Side Interactive Tiles */}
        <div className="therapy-tiles-grid" role="radiogroup" aria-label={t('therapy.onboardingTitle')}>
          {/* Tile 1: Pen (MDI) */}
          <button
            type="button"
            role="radio"
            aria-checked={selectedMode === 'pen'}
            className={`therapy-tile ${selectedMode === 'pen' ? 'is-selected is-pen' : ''}`}
            onClick={() => setSelectedMode('pen')}
          >
            <div className="therapy-tile-badge-indicator" aria-hidden="true">
              <span className="tile-check-circle">{selectedMode === 'pen' ? '✓' : ''}</span>
            </div>
            <div className="therapy-tile-icon-wrapper">
              <span className="therapy-tile-emoji" role="img" aria-label="Pen injection">💉</span>
            </div>
            <div className="therapy-tile-content">
              <span className="therapy-tile-title">{t('therapy.modePenTitle')}</span>
              <span className="therapy-tile-subtitle">{t('therapy.modePenSubtitle')}</span>
            </div>
          </button>

          {/* Tile 2: Pump / Pod */}
          <button
            type="button"
            role="radio"
            aria-checked={selectedMode === 'pump'}
            className={`therapy-tile ${selectedMode === 'pump' ? 'is-selected is-pump' : ''}`}
            onClick={() => setSelectedMode('pump')}
          >
            <div className="therapy-tile-badge-indicator" aria-hidden="true">
              <span className="tile-check-circle">{selectedMode === 'pump' ? '✓' : ''}</span>
            </div>
            <div className="therapy-tile-icon-wrapper">
              <span className="therapy-tile-emoji" role="img" aria-label="Insulin Pump Pod">📟</span>
            </div>
            <div className="therapy-tile-content">
              <span className="therapy-tile-title">{t('therapy.modePumpTitle')}</span>
              <span className="therapy-tile-subtitle">{t('therapy.modePumpSubtitle')}</span>
            </div>
          </button>
        </div>

        {/* Dynamic Explanation Box Below Tiles */}
        <div className="therapy-description-container">
          {selectedMode === 'pen' && (
            <div className="therapy-description-card pen-desc-card">
              <div className="desc-card-header">
                <span className="desc-icon" aria-hidden="true">💉</span>
                <strong className="desc-title">{t('therapy.modePenTitle')}</strong>
              </div>
              <p className="desc-text">{t('therapy.modePenDesc')}</p>
            </div>
          )}

          {selectedMode === 'pump' && (
            <div className="therapy-description-card pump-desc-card">
              <div className="desc-card-header">
                <span className="desc-icon" aria-hidden="true">📟</span>
                <strong className="desc-title">{t('therapy.modePumpTitle')}</strong>
              </div>
              <p className="desc-text">{t('therapy.modePumpDesc')}</p>
            </div>
          )}

          {!selectedMode && (
            <div className="therapy-description-placeholder">
              <p className="placeholder-text">
                {t('therapy.onboardingSubtitle')}
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="therapy-onboarding-actions">
          <button
            type="button"
            className="therapy-continue-btn primary-btn"
            disabled={!selectedMode || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <span className="btn-loading-content">
                <span className="btn-spinner" aria-hidden="true" />
                <span>{t('common.saving')}</span>
              </span>
            ) : (
              t('therapy.continueBtn')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
