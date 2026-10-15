import { useState } from 'react';
import { useTranslation } from './i18n';

export default function NotificationSettings({
  preferences,
  onUpdatePreferences
}) {
  const { t } = useTranslation();
  const [activeScope, setActiveScope] = useState('personal'); // 'personal' | 'shared'

  const notificationItems = [
    {
      key: 'rem10m',
      icon: '🍽️',
      titleKey: 'rem10mTitle',
      descKey: 'rem10mDesc'
    },
    {
      key: 'rem2h',
      icon: '🩸',
      titleKey: 'rem2hTitle',
      descKey: 'rem2hDesc'
    },
    {
      key: 'rem3h',
      icon: '🎯',
      titleKey: 'rem3hTitle',
      descKey: 'rem3hDesc'
    },
    {
      key: 'basal',
      icon: '🌙',
      titleKey: 'basalTitle',
      descKey: 'basalDesc'
    }
  ];

  const handleToggle = (key) => {
    const scopePrefs = preferences[activeScope] || {};
    const currentVal = scopePrefs[key] !== false;
    const nextVal = !currentVal;

    const updatedPreferences = {
      ...preferences,
      [activeScope]: {
        ...scopePrefs,
        [key]: nextVal
      }
    };

    if (onUpdatePreferences) {
      onUpdatePreferences(updatedPreferences);
    }
  };

  return (
    <section className="tab-view notification-settings-view">
      <div className="notification-settings-container">
        {/* Top Scope & Subtitle Header */}
        <div className="notification-scope-header">
          <p className="notification-view-subtitle">{t('notificationSettings.subtitle')}</p>

          <div
            className="notification-scope-pill"
            role="tablist"
            aria-label={t('notificationSettings.title')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'personal'}
              className={`scope-pill-btn ${activeScope === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveScope('personal')}
            >
              <span className="scope-pill-icon" role="img" aria-hidden="true">👤</span>
              <span className="scope-pill-label">{t('notificationSettings.scopePersonal')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'shared'}
              className={`scope-pill-btn ${activeScope === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveScope('shared')}
            >
              <span className="scope-pill-icon" role="img" aria-hidden="true">👥</span>
              <span className="scope-pill-label">{t('notificationSettings.scopeShared')}</span>
            </button>
          </div>

          <div className="notification-scope-caption-row">
            <span className="notification-scope-dot" aria-hidden="true" />
            <span className="notification-scope-desc">
              {activeScope === 'personal'
                ? t('notificationSettings.scopePersonalDesc')
                : t('notificationSettings.scopeSharedDesc')}
            </span>
          </div>
        </div>

        {/* List of Notification Toggle Cards */}
        <div
          className="notification-toggle-list"
          role="region"
          aria-label={activeScope === 'personal' ? t('notificationSettings.scopePersonal') : t('notificationSettings.scopeShared')}
        >
          {notificationItems.map((item) => {
            const isEnabled = (preferences[activeScope] || {})[item.key] !== false;
            return (
              <div
                key={item.key}
                className={`notification-toggle-card ${isEnabled ? 'enabled' : 'disabled'}`}
                onClick={() => handleToggle(item.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggle(item.key);
                  }
                }}
              >
                <div className={`notification-card-icon-wrapper ${item.key}`}>
                  <span className="notification-card-icon" role="img" aria-hidden="true">
                    {item.icon}
                  </span>
                </div>

                <div className="notification-card-content">
                  <div className="notification-card-header-row">
                    <h3 className="notification-card-title">
                      {t(`notificationSettings.${item.titleKey}`)}
                    </h3>
                    <span
                      className={`notification-status-badge ${isEnabled ? 'badge-active' : 'badge-disabled'}`}
                    >
                      {isEnabled
                        ? t('notificationSettings.activeStatus')
                        : t('notificationSettings.disabledStatus')}
                    </span>
                  </div>
                  <p className="notification-card-description">
                    {t(`notificationSettings.${item.descKey}`)}
                  </p>
                </div>

                <div className="notification-card-action">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={t(`notificationSettings.${item.titleKey}`)}
                    className={`toggle-switch ${isEnabled ? 'checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(item.key);
                    }}
                  >
                    <span className="toggle-switch-handle" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
