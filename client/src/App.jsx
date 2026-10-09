import { useState, useEffect } from 'react';
import './App.css';

const pad2 = (num) => String(num).padStart(2, '0');

function LiveClock() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return {
      hours: pad2(now.getHours()),
      minutes: pad2(now.getMinutes()),
      seconds: pad2(now.getSeconds()),
      hundredths: pad2(Math.floor(now.getMilliseconds() / 10))
    };
  });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime({
        hours: pad2(now.getHours()),
        minutes: pad2(now.getMinutes()),
        seconds: pad2(now.getSeconds()),
        hundredths: pad2(Math.floor(now.getMilliseconds() / 10))
      });
    };

    updateClock();
    const timer = setInterval(updateClock, 40);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="live-clock"
      title="Current Local Time"
      aria-label={`Current time ${time.hours}:${time.minutes}:${time.seconds}.${time.hundredths}`}
    >
      <span className="clock-digits">{time.hours}</span>
      <span className="clock-colon">:</span>
      <span className="clock-digits">{time.minutes}</span>
      <span className="clock-colon">:</span>
      <span className="clock-digits">{time.seconds}</span>
      <span className="clock-millis">.{time.hundredths}</span>
    </div>
  );
}

const formatDateOnly = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('en-IL', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const formatTimeOnly = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleTimeString('en-IL', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const datePart = date.toLocaleDateString('en-IL', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const timePart = date.toLocaleTimeString('en-IL', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return `${datePart}, ${timePart}`;
};

const formatRelativeTime = (value) => {
  if (!value) return '';
  const now = Date.now();
  const time = new Date(value).getTime();
  const diffMs = now - time;

  if (diffMs < 0) {
    const futureMs = -diffMs;
    const futureSec = Math.floor(futureMs / 1000);
    const futureMin = Math.floor(futureSec / 60);
    const futureHours = Math.floor(futureMin / 60);
    const remMin = futureMin % 60;

    if (futureHours > 0) {
      return `in ${futureHours}h ${remMin > 0 ? `${remMin}m` : ''}`.trim();
    }
    if (futureMin > 0) {
      return `in ${futureMin} min`;
    }
    return 'in less than a min';
  }

  const pastSec = Math.floor(diffMs / 1000);
  const pastMin = Math.floor(pastSec / 60);
  const pastHours = Math.floor(pastMin / 60);
  const pastDays = Math.floor(pastHours / 24);

  if (pastSec < 60) return 'Just now';
  if (pastMin < 60) return `${pastMin} ${pastMin === 1 ? 'minute' : 'minutes'} ago`;
  if (pastHours < 24) return `${pastHours} ${pastHours === 1 ? 'hour' : 'hours'} ago`;
  if (pastDays === 1) return 'Yesterday';
  return `${pastDays} days ago`;
};

const isPast = (value) => {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
};

function InjectionEligibility({ latestLog }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!latestLog) {
    return (
      <div className="eligibility-card eligible">
        <div className="eligibility-icon-wrapper">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="eligibility-content">
          <div className="eligibility-title">Ready to Inject</div>
          <p className="eligibility-message">
            You can inject now. No previous injections have been recorded.
          </p>
        </div>
      </div>
    );
  }

  const target3hMs = new Date(latestLog.notify_3h_at).getTime();
  const diffMs = target3hMs - now;
  const canInject = diffMs < 0;

  if (canInject) {
    return (
      <div className="eligibility-card eligible">
        <div className="eligibility-icon-wrapper">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="eligibility-content">
          <div className="eligibility-title">Ready to Inject</div>
          <p className="eligibility-message">
            You can inject now. More than 3 hours have passed since your last injection.
          </p>
        </div>
      </div>
    );
  }

  const remSec = Math.max(0, Math.floor(diffMs / 1000));
  const remHours = Math.floor(remSec / 3600);
  const remMin = Math.floor((remSec % 3600) / 60);
  const remSeconds = remSec % 60;

  const countdownText = remHours > 0
    ? `${remHours}h ${remMin}m ${remSeconds}s remaining`
    : remMin > 0
      ? `${remMin}m ${remSeconds}s remaining`
      : `${remSeconds}s remaining`;

  return (
    <div className="eligibility-card locked">
      <div className="eligibility-icon-wrapper">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div className="eligibility-content">
        <div className="eligibility-title-row">
          <span className="eligibility-title">Wait Before Injecting</span>
          <span className="eligibility-countdown">{countdownText}</span>
        </div>
        <p className="eligibility-message">
          You cannot inject yet. Please wait until at least 3 hours have passed since your last injection.
        </p>
        <div className="eligibility-time-note">
          Next injection available at <strong>{formatTimeOnly(latestLog.notify_3h_at)}</strong>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'logs' | 'settings'
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});
  const [notification, setNotification] = useState(null);
  const [isLoggedIn] = useState(false); // Auth state placeholder (future login logic)

  // Settings State
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('insuminder_language') || 'en';
  });
  const [telegramBotToken, setTelegramBotToken] = useState(() => {
    return localStorage.getItem('insuminder_telegram_bot_token') || '';
  });
  const [telegramChatId, setTelegramChatId] = useState(() => {
    return localStorage.getItem('insuminder_telegram_chat_id') || '';
  });

  const latestLog = logs.length > 0 ? logs[0] : null;
  const isTelegramConfigured = Boolean(telegramBotToken.trim() && telegramChatId.trim());

  useEffect(() => {
    fetch('/api/logs')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setLogs(data.logs);
        }
      })
      .catch(error => console.error('Error fetching logs:', error));
  }, []);

  // Keyboard navigation: Close nav drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isNavOpen) {
        setIsNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNavOpen]);

  // Auto-dismiss notification after 4.5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleLogInjection = () => {
    const now = new Date();
    const currentMinute = now.toISOString().slice(0, 16);

    // Immediate client-side check to prevent multiple logs in the same minute
    if (logs.length > 0 && logs[0].injected_at && logs[0].injected_at.slice(0, 16) === currentMinute) {
      setNotification({
        type: 'warning',
        message: 'An injection has already been recorded this minute. You can only log once per minute.'
      });
      return;
    }

    fetch('/api/injections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        const injectedTime = formatTimeOnly(now.toISOString());
        setNotification({
          type: 'success',
          message: `Insulin injection logged successfully at ${injectedTime}!`
        });
        fetch('/api/logs')
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              setLogs(data.logs);
            }
          })
          .catch(error => console.error('Error fetching logs:', error));
      } else {
        setNotification({
          type: 'warning',
          message: data.error || 'An injection has already been recorded this minute. You can only log once per minute.'
        });
      }
    })
    .catch(error => {
      console.error('Error logging injection:', error);
      setNotification({
        type: 'warning',
        message: 'Failed to log injection. Please check your connection.'
      });
    });
  };

  const handleSelectLanguage = (langCode) => {
    setLanguage(langCode);
    localStorage.setItem('insuminder_language', langCode);
  };

  const handleSaveTelegramSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('insuminder_telegram_bot_token', telegramBotToken.trim());
    localStorage.setItem('insuminder_telegram_chat_id', telegramChatId.trim());
    setNotification({
      type: 'success',
      message: 'Telegram settings saved successfully!'
    });
  };

  const toggleDate = (dateKey) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: !(prev[dateKey] ?? false)
    }));
  };

  // Group logs by date
  const groupedLogs = logs.reduce((acc, log) => {
    const dateKey = formatDateOnly(log.injected_at);
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(log);
    return acc;
  }, {});

  const dateKeys = Object.keys(groupedLogs);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'logs':
        return 'Injection Logs';
      case 'settings':
        return 'Settings';
      case 'home':
      default:
        return 'InsuMinder';
    }
  };

  return (
    <div className="App">
      {/* Generic Top Header: 1. Hamburger (Left), 2. Title (Center), 3. Back Button (Right, subpages only) */}
      <header className="app-header">
        <div className="header-left">
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setIsNavOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isNavOpen}
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>

        <div className="header-center">
          <h1 className="header-title">{getPageTitle()}</h1>
        </div>

        <div className="header-right">
          {activeTab !== 'home' ? (
            <button
              type="button"
              className="back-btn"
              onClick={() => setActiveTab('home')}
              aria-label="Back to Home"
            >
              <span className="back-arrow">←</span>
            </button>
          ) : (
            <div className="header-spacer" />
          )}
        </div>
      </header>

      {/* Title Divider Line */}
      <hr className="title-divider" />

      {/* Navigation Drawer Backdrop */}
      <div
        className={`nav-backdrop ${isNavOpen ? 'open' : ''}`}
        onClick={() => setIsNavOpen(false)}
        aria-hidden={!isNavOpen}
      />

      {/* Navigation Drawer */}
      <aside
        className={`nav-drawer ${isNavOpen ? 'open' : ''}`}
        role="navigation"
        aria-label="Main Navigation"
        aria-hidden={!isNavOpen}
      >
        <div className="nav-header">
          <h2 className="nav-brand">InsuMinder</h2>
          <button
            type="button"
            className="close-btn"
            onClick={() => setIsNavOpen(false)}
            aria-label="Close navigation menu"
          >
            &times;
          </button>
        </div>

        <nav className="nav-menu">
          <button
            type="button"
            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('home');
              setIsNavOpen(false);
            }}
          >
            <span className="nav-icon" role="img" aria-label="home">🏠</span>
            <span className="nav-label">Home</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('logs');
              setIsNavOpen(false);
            }}
          >
            <span className="nav-icon" role="img" aria-label="logs">📋</span>
            <span className="nav-label">Injection Logs</span>
            {logs.length > 0 && <span className="badge">{logs.length}</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('settings');
              setIsNavOpen(false);
            }}
          >
            <span className="nav-icon" role="img" aria-label="settings">⚙️</span>
            <span className="nav-label">Settings</span>
          </button>
        </nav>

        {/* Bottom of sidebar: Log In / Sign Out button */}
        <div className="nav-footer">
          <button
            type="button"
            className="nav-auth-btn"
            onClick={() => {
              // Authentication logic will be implemented later
            }}
          >
            <span className="nav-icon" role="img" aria-label="auth">
              {isLoggedIn ? '🚪' : '🔐'}
            </span>
            <span className="nav-label">
              {isLoggedIn ? 'Sign Out' : 'Log In'}
            </span>
          </button>
        </div>
      </aside>

      {/* Common Notification Banner */}
      {notification && (
        <div className={`alert-banner alert-${notification.type}`} role="alert">
          <span className="alert-icon">{notification.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="alert-text">{notification.message}</span>
          <button
            type="button"
            className="alert-close-btn"
            onClick={() => setNotification(null)}
            aria-label="Dismiss message"
          >
            &times;
          </button>
        </div>
      )}

      {/* VIEW 1: HOME */}
      {activeTab === 'home' && (
        <section className="tab-view home-view">
          <div className="home-container">
            {/* Real-time Digital Clock */}
            <LiveClock />

            {/* Telegram Configuration Notice Banner */}
            {!isTelegramConfigured && (
              <div
                className="telegram-alert-card"
                onClick={() => setActiveTab('settings')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('settings');
                  }
                }}
              >
                <span className="telegram-alert-icon">⚠️</span>
                <div className="telegram-alert-content">
                  <span className="telegram-alert-text">Telegram not configured.</span>
                  <span className="telegram-alert-action">Go to Settings to set it up.</span>
                </div>
              </div>
            )}

            {/* Big Action Button: Log Injection */}
            <button
              type="button"
              className="log-injection-btn"
              onClick={handleLogInjection}
            >
              <span className="log-injection-plus">+</span>
              <span className="log-injection-title">Log Injection</span>
              <span className="log-injection-subtitle">Record the current time as your injection time</span>
            </button>

            {/* Dashboard Tiles Grid: Total Injections & Last Injection */}
            <div className="stats-grid">
              {/* Tile 1: Total Injections */}
              <div
                className="stat-card"
                onClick={() => setActiveTab('logs')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('logs');
                  }
                }}
                title="View all logs"
              >
                <div className="stat-card-header">
                  <span className="stat-icon-wrapper stat-pulse-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </span>
                </div>
                <div className="stat-label">Total Injections</div>
                <div className="stat-value">{logs.length}</div>
              </div>

              {/* Tile 2: Last Injection */}
              <div
                className="stat-card"
                onClick={() => setActiveTab('logs')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveTab('logs');
                  }
                }}
                title="View injection details"
              >
                <div className="stat-card-header">
                  <span className="stat-icon-wrapper stat-clock-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </span>
                </div>
                <div className="stat-label">Last Injection</div>
                {latestLog ? (
                  <div className="stat-datetime-group">
                    <div className="stat-datetime">{formatDateTime(latestLog.injected_at)}</div>
                    <div className="stat-relative">{formatRelativeTime(latestLog.injected_at)}</div>
                  </div>
                ) : (
                  <div className="stat-datetime-group">
                    <div className="stat-datetime empty">None</div>
                    <div className="stat-relative">No injections yet</div>
                  </div>
                )}
              </div>
            </div>

            {/* Notifications Scheduled Section */}
            <div className="notifications-section">
              <h2 className="section-title">Notifications Scheduled</h2>

              <div className="reminder-cards-list">
                {/* 2-Hour Reminder */}
                <div className="reminder-card">
                  <div className="reminder-icon-wrapper">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div className="reminder-details">
                    <div className="reminder-title-row">
                      <span className="reminder-title">2-Hour Reminder</span>
                      {latestLog && (
                        <span className={`reminder-badge ${isPast(latestLog.notify_2h_at) ? 'badge-past' : 'badge-upcoming'}`}>
                          {isPast(latestLog.notify_2h_at) ? 'Sent' : 'Upcoming'}
                        </span>
                      )}
                    </div>
                    {latestLog ? (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp">{formatDateTime(latestLog.notify_2h_at)}</span>
                        <span className="reminder-relative">({formatRelativeTime(latestLog.notify_2h_at)})</span>
                      </div>
                    ) : (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp empty">—</span>
                        <span className="reminder-relative">(No injections logged yet)</span>
                      </div>
                    )}
                    <p className="reminder-description">
                      You will be reminded 2 hours after injection
                    </p>
                  </div>
                </div>

                {/* 3-Hour Reminder */}
                <div className="reminder-card">
                  <div className="reminder-icon-wrapper">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div className="reminder-details">
                    <div className="reminder-title-row">
                      <span className="reminder-title">3-Hour Reminder</span>
                      {latestLog && (
                        <span className={`reminder-badge ${isPast(latestLog.notify_3h_at) ? 'badge-past' : 'badge-upcoming'}`}>
                          {isPast(latestLog.notify_3h_at) ? 'Sent' : 'Upcoming'}
                        </span>
                      )}
                    </div>
                    {latestLog ? (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp">{formatDateTime(latestLog.notify_3h_at)}</span>
                        <span className="reminder-relative">({formatRelativeTime(latestLog.notify_3h_at)})</span>
                      </div>
                    ) : (
                      <div className="reminder-time-info">
                        <span className="reminder-timestamp empty">—</span>
                        <span className="reminder-relative">(No injections logged yet)</span>
                      </div>
                    )}
                    <p className="reminder-description">
                      You will be reminded 3 hours after injection
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Injection Eligibility Status (Below Notifications Scheduled) */}
            <InjectionEligibility latestLog={latestLog} />
          </div>
        </section>
      )}

      {/* VIEW 2: INJECTION LOGS (Dedicated Page) */}
      {activeTab === 'logs' && (
        <section className="tab-view logs-view">
          <div className="page-content-wrapper">
            {logs.length === 0 ? (
              <div className="empty-logs-container">
                <p className="no-logs">No injections logged yet.</p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => setActiveTab('home')}
                >
                  Go to Home to Log
                </button>
              </div>
            ) : (
              <div className="date-groups-container">
                {dateKeys.map((dateKey, index) => {
                  const dateLogs = groupedLogs[dateKey];
                  const isExpanded = expandedDates[dateKey] ?? (index === 0);

                  return (
                    <div key={dateKey} className="date-group">
                      <button
                        type="button"
                        className="date-group-header"
                        onClick={() => toggleDate(dateKey)}
                        aria-expanded={isExpanded}
                      >
                        <div className="date-group-title">
                          <span className={`date-arrow ${isExpanded ? 'open' : ''}`}>▶</span>
                          <span className="date-text">{dateKey}</span>
                        </div>
                        <span className="date-count-badge">
                          {dateLogs.length} {dateLogs.length === 1 ? 'injection' : 'injections'}
                        </span>
                      </button>

                      {isExpanded && (
                        <ul className="logs-list">
                          {dateLogs.map(log => (
                            <li key={log.id} className="log-item">
                              <div className="log-field">
                                <span className="log-label">Injected:</span>
                                <span className="log-value">{formatTimeOnly(log.injected_at)}</span>
                              </div>
                              <div className="log-field">
                                <span className="log-label">2h Reminder:</span>
                                <span className="log-value">{formatTimeOnly(log.notify_2h_at)}</span>
                              </div>
                              <div className="log-field">
                                <span className="log-label">3h Reminder:</span>
                                <span className="log-value">{formatTimeOnly(log.notify_3h_at)}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* VIEW 3: SETTINGS (Language & Telegram) */}
      {activeTab === 'settings' && (
        <section className="tab-view settings-view">
          <div className="settings-container">
            {/* 1. Language Card */}
            <div className="settings-card">
              <div className="card-header">
                <div className="card-icon-wrapper globe-icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <h2 className="card-title">Language</h2>
              </div>

              <div className="language-options">
                <button
                  type="button"
                  className={`language-btn ${language === 'en' ? 'active' : ''}`}
                  onClick={() => handleSelectLanguage('en')}
                >
                  <span className="language-name">English</span>
                  {language === 'en' && (
                    <span className="check-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className={`language-btn ${language === 'he' ? 'active' : ''}`}
                  onClick={() => handleSelectLanguage('he')}
                >
                  <span className="language-name">עברית</span>
                  {language === 'he' && (
                    <span className="check-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className={`language-btn ${language === 'ru' ? 'active' : ''}`}
                  onClick={() => handleSelectLanguage('ru')}
                >
                  <span className="language-name">Русский</span>
                  {language === 'ru' && (
                    <span className="check-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Telegram Notifications Card */}
            <div className="settings-card">
              <div className="card-header">
                <div className="card-icon-wrapper telegram-icon-wrapper">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
                <div className="card-header-text">
                  <h2 className="card-title">Telegram Notifications</h2>
                  <p className="card-subtitle">Configure your Telegram bot to receive injection reminders</p>
                </div>
              </div>

              <form onSubmit={handleSaveTelegramSettings} className="settings-form">
                <div className="form-group">
                  <label htmlFor="bot-token" className="form-label">Bot Token</label>
                  <input
                    id="bot-token"
                    type="text"
                    className="form-input"
                    placeholder="Enter your Telegram bot token"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="chat-id" className="form-label">Chat ID</label>
                  <input
                    id="chat-id"
                    type="text"
                    className="form-input"
                    placeholder="Enter your Telegram chat ID"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <p className="settings-note">
                  Notifications are sent 2 and 3 hours after each injection via Telegram.
                </p>

                <button type="submit" className="save-btn">
                  <span className="btn-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                  </span>
                  Save
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Application Footer */}
      <footer className="app-footer">
        <p className="footer-copyright">
          &copy; {new Date().getFullYear()} Dovgans
        </p>
      </footer>
    </div>
  );
}

export default App;
