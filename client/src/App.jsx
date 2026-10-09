import { useState, useEffect } from 'react';
import './App.css';
import {
  pad2,
  getTabFromUrl,
  updateUrlForTab,
  formatDateOnly,
  formatTimeOnly,
  formatDateTime,
  formatRelativeTime,
  isPast,
  getStartOfWeek,
  getWeeksBelongingToMonth,
  getWeekDisplayInfo,
  getWeeklyTrendData,
  getRapidInjections,
  maskBotToken,
  isCustomConfigName
} from './utils';

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
  const [activeTab, setActiveTab] = useState(() => getTabFromUrl()); // 'home' | 'logs' | 'settings'
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isLatestExpanded, setIsLatestExpanded] = useState(false);
  const [isLoggedIn] = useState(false); // Auth state placeholder (future login logic)
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);

  // Synchronize URL search params with activeTab
  useEffect(() => {
    updateUrlForTab(activeTab);
  }, [activeTab]);

  // Handle browser Back / Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Settings State
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('insuminder_language') || 'en';
  });
  const [telegramConfigs, setTelegramConfigs] = useState([]);
  const [telegramLabel, setTelegramLabel] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState(() => {
    return localStorage.getItem('insuminder_telegram_bot_token') || '';
  });
  const [telegramChatId, setTelegramChatId] = useState(() => {
    return localStorage.getItem('insuminder_telegram_chat_id') || '';
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [deleteModalConfig, setDeleteModalConfig] = useState(null);

  const latestLog = logs.length > 0 ? logs[0] : null;
  const isTelegramConfigured = telegramConfigs.length > 0
    ? telegramConfigs.some(c => c.isDefault)
    : Boolean(telegramBotToken.trim() && telegramChatId.trim());

  const fetchTelegramConfigs = () => {
    fetch('/api/telegram-configs')
      .then(response => response.json())
      .then(data => {
        if (data.success && Array.isArray(data.configs)) {
          setTelegramConfigs(data.configs);
          const defaultCfg = data.configs.find(c => c.isDefault);
          if (defaultCfg) {
            localStorage.setItem('insuminder_telegram_bot_token', defaultCfg.botToken);
            localStorage.setItem('insuminder_telegram_chat_id', defaultCfg.chatId);
          }
        }
      })
      .catch(error => console.error('Error fetching telegram configs:', error));
  };

  // Fetch configs and settings from server on mount
  useEffect(() => {
    fetchTelegramConfigs();
  }, []);

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

  const handleSaveTelegramSettings = async (e) => {
    e.preventDefault();
    const cleanToken = telegramBotToken.trim();
    const rawChatId = telegramChatId.trim().replace(/^-+/, '');
    const cleanChatId = rawChatId ? `-${rawChatId}` : '';
    const cleanLabel = telegramLabel.trim();

    if (!cleanToken || !cleanChatId) {
      setNotification({
        type: 'warning',
        message: 'Please provide both Bot Token and Chat ID.'
      });
      return;
    }

    setIsSavingSettings(true);
    try {
      const response = await fetch('/api/telegram-configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: cleanLabel,
          botToken: cleanToken,
          chatId: cleanChatId
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: 'Telegram configuration saved and set as default!'
        });
        setTelegramLabel('');
        setTelegramBotToken('');
        setTelegramChatId('');
        fetchTelegramConfigs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || 'Failed to save configuration.'
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: 'Failed to reach server to save configuration.'
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSetDefaultConfig = async (configId) => {
    try {
      const response = await fetch(`/api/telegram-configs/${configId}/default`, {
        method: 'PUT',
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: 'Default notification destination updated!'
        });
        fetchTelegramConfigs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || 'Failed to update default configuration.'
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: 'Failed to reach server to update default configuration.'
      });
    }
  };

  const handleOpenDeleteModal = (config) => {
    setDeleteModalConfig(config);
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalConfig(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalConfig) return;
    try {
      const response = await fetch(`/api/telegram-configs/${deleteModalConfig.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: `Configuration "${deleteModalConfig.name}" deleted successfully.`
        });
        setDeleteModalConfig(null);
        fetchTelegramConfigs();
      } else {
        setNotification({
          type: 'warning',
          message: data.error || 'Failed to delete configuration.'
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: 'Failed to reach server to delete configuration.'
      });
    }
  };

  const handleTestTelegramNotification = async (overrideToken, overrideChatId) => {
    const cleanToken = (overrideToken !== undefined ? overrideToken : telegramBotToken).trim();
    const rawChatId = (overrideChatId !== undefined ? overrideChatId : telegramChatId).trim().replace(/^-+/, '');
    const cleanChatId = rawChatId ? `-${rawChatId}` : '';

    if (!cleanToken || !cleanChatId) {
      setNotification({
        type: 'warning',
        message: 'Please enter both Bot Token and Chat ID before sending a test notification.'
      });
      return;
    }

    setIsTestingTelegram(true);
    try {
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramBotToken: cleanToken,
          telegramChatId: cleanChatId
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: 'Test notification sent! Check your Telegram chat.'
        });
      } else {
        setNotification({
          type: 'warning',
          message: `Telegram test failed: ${data.error || 'Could not send message'}`
        });
      }
    } catch {
      setNotification({
        type: 'warning',
        message: 'Failed to reach server to test Telegram notification.'
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handlePrevWeek = () => {
    setSelectedWeekStart(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7, 12, 0, 0);
      return getStartOfWeek(next);
    });
  };

  const handleNextWeek = () => {
    setSelectedWeekStart(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7, 12, 0, 0);
      return getStartOfWeek(next);
    });
  };

  const handleSelectWeek = (targetStart) => {
    setSelectedWeekStart(targetStart);
  };

  const handlePrevMonth = () => {
    const info = getWeekDisplayInfo(selectedWeekStart);
    let targetYear = info.anchorYear;
    let targetMonth = info.anchorMonth - 1;
    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear--;
    }
    const prevWeeks = getWeeksBelongingToMonth(targetYear, targetMonth);
    const targetIdx = Math.min(info.activeWeekIndex, prevWeeks.length - 1);
    setSelectedWeekStart(prevWeeks[targetIdx]);
  };

  const handleNextMonth = () => {
    const info = getWeekDisplayInfo(selectedWeekStart);
    let targetYear = info.anchorYear;
    let targetMonth = info.anchorMonth + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear++;
    }
    const nextWeeks = getWeeksBelongingToMonth(targetYear, targetMonth);
    const targetIdx = Math.min(info.activeWeekIndex, nextWeeks.length - 1);
    setSelectedWeekStart(nextWeeks[targetIdx]);
  };

  const handleResetToCurrentWeek = () => {
    setSelectedWeekStart(getStartOfWeek(new Date()));
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null || touchStartY === null || !e.changedTouches || !e.changedTouches[0]) {
      return;
    }
    const diffX = touchStartX - e.changedTouches[0].clientX;
    const diffY = touchStartY - e.changedTouches[0].clientY;

    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        handleNextWeek();
      } else {
        handlePrevWeek();
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const todayDateKey = formatDateOnly(new Date().toISOString());
  const todayLogs = logs.filter(log => formatDateOnly(log.injected_at) === todayDateKey);
  const weekInfo = getWeekDisplayInfo(selectedWeekStart);
  const weeklyData = getWeeklyTrendData(logs, selectedWeekStart);
  const rapidInjections = getRapidInjections(logs);

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
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="back-arrow-svg"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
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

      {/* VIEW 2: INJECTION LOGS & TRENDS (Dedicated Page) */}
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
              <>
                {/* 1. Header with Total Injections Count */}
                <div className="logs-header-banner">
                  <div className="logs-header-badge">
                    <span className="logs-total-count">{logs.length}</span>
                    <span className="logs-total-label">Total Injections</span>
                  </div>
                </div>

                {/* 2. Latest Injection Tile (Matching Reference Card) */}
                {latestLog && (
                  <div className="latest-log-card">
                    <div
                      className="latest-log-header"
                      onClick={() => setIsLatestExpanded(!isLatestExpanded)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setIsLatestExpanded(!isLatestExpanded);
                        }
                      }}
                      aria-expanded={isLatestExpanded}
                    >
                      <div className="latest-log-icon-wrapper" title="Latest Injection">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m18 2 4 4" />
                          <path d="m17 7 3-3" />
                          <path d="M19 9 8.7 19.3c-.4.4-1 .6-1.6.6H3v-4.1c0-.6.2-1.2.6-1.6L14 3.9" />
                          <path d="m9 14 5 5" />
                          <path d="m5 18-3 3" />
                        </svg>
                      </div>

                      <div className="latest-log-meta">
                        <div className="latest-log-timestamp">{formatDateTime(latestLog.injected_at)}</div>
                        <div className="latest-log-relative">{formatRelativeTime(latestLog.injected_at)}</div>
                      </div>

                      <div className={`latest-chevron ${isLatestExpanded ? 'open' : ''}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>

                    {/* Reminder Status Badges */}
                    <div className="latest-reminders-list">
                      <div className={`latest-reminder-pill ${isPast(latestLog.notify_2h_at) ? 'sent' : 'pending'}`}>
                        <span className="pill-icon">{isPast(latestLog.notify_2h_at) ? '✅' : '⏳'}</span>
                        <span className="pill-text">2-Hour Reminder: {isPast(latestLog.notify_2h_at) ? 'Sent' : 'Pending'}</span>
                      </div>

                      <div className={`latest-reminder-pill ${isPast(latestLog.notify_3h_at) ? 'sent' : 'pending'}`}>
                        <span className="pill-icon">{isPast(latestLog.notify_3h_at) ? '✅' : '⏳'}</span>
                        <span className="pill-text">3-Hour Reminder: {isPast(latestLog.notify_3h_at) ? 'Sent' : 'Pending'}</span>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isLatestExpanded && (
                      <div className="latest-expanded-panel">
                        <div className="expanded-row">
                          <span className="expanded-label">Injected At:</span>
                          <span className="expanded-value">{formatDateTime(latestLog.injected_at)}</span>
                        </div>
                        <div className="expanded-row">
                          <span className="expanded-label">2h Target Time:</span>
                          <span className="expanded-value">{formatDateTime(latestLog.notify_2h_at)}</span>
                        </div>
                        <div className="expanded-row">
                          <span className="expanded-label">3h Target Time:</span>
                          <span className="expanded-value">{formatDateTime(latestLog.notify_3h_at)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Weekly Trends Chart Card (Month Scoped with Weekly Navigation & Swipe) */}
                <div
                  className="trends-chart-card"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className="chart-card-header">
                    <div className="chart-title-group">
                      <h3 className="chart-title">Weekly Injections</h3>
                      <span className="chart-subtitle">Daily count for selected week</span>
                    </div>
                    <div className="chart-stats-badge">
                      <span className="chart-stat-number">{weeklyData.totalWeekInjections}</span>
                      <span className="chart-stat-label">week total</span>
                    </div>
                  </div>

                  {/* Month Navigation & Week Pagination */}
                  <div className="chart-nav-bar">
                    {/* Month Row */}
                    <div className="chart-month-row">
                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-month-btn"
                        onClick={handlePrevMonth}
                        aria-label="Previous Month"
                        title="Go to previous month"
                      >
                        ‹
                      </button>
                      <span className="chart-month-label">{weekInfo.monthName}</span>
                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-month-btn"
                        onClick={handleNextMonth}
                        aria-label="Next Month"
                        title="Go to next month"
                      >
                        ›
                      </button>
                    </div>

                    {/* Week Row */}
                    <div className="chart-week-row">
                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-week-btn"
                        onClick={handlePrevWeek}
                        aria-label="Previous Week"
                        title="Go to previous week (or swipe right)"
                      >
                        ←
                      </button>

                      <div className="chart-week-info">
                        <span className="chart-week-title">Week {weekInfo.weekNumber}</span>
                        <span className="chart-week-dates">({weeklyData.weekRangeStr})</span>
                      </div>

                      <button
                        type="button"
                        className="chart-nav-btn chart-nav-week-btn"
                        onClick={handleNextWeek}
                        aria-label="Next Week"
                        title="Go to next week (or swipe left)"
                      >
                        →
                      </button>
                    </div>

                    {/* Week Pills for Current Month */}
                    <div className="chart-week-pills" role="tablist" aria-label="Weeks of the month">
                      {weekInfo.monthWeeks.map((wDate, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`week-pill-btn ${idx === weekInfo.activeWeekIndex ? 'active' : ''}`}
                          onClick={() => handleSelectWeek(wDate)}
                          role="tab"
                          aria-selected={idx === weekInfo.activeWeekIndex}
                          title={`Week ${idx + 1}`}
                        >
                          W{idx + 1}
                        </button>
                      ))}
                    </div>

                    {/* Jump back to Current Week if browsing other weeks */}
                    {!weeklyData.isCurrentWeek && (
                      <div className="chart-today-reset-row">
                        <button
                          type="button"
                          className="chart-reset-today-btn"
                          onClick={handleResetToCurrentWeek}
                          title="Jump back to current week"
                        >
                          ↺ Jump to Current Week
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="chart-metrics-row">
                    <div className="metric-chip">
                      <span className="metric-chip-label">Daily Avg:</span>
                      <span className="metric-chip-value">{weeklyData.dailyAvg} / day</span>
                    </div>
                    <div className="metric-chip">
                      <span className="metric-chip-label">Active Days:</span>
                      <span className="metric-chip-value">{weeklyData.activeDaysCount} of 7</span>
                    </div>
                  </div>

                  {/* 7-Day Bar Chart */}
                  <div className="bars-container">
                    {weeklyData.days.map((day, idx) => {
                      const heightPercent = weeklyData.maxCount > 0
                        ? Math.round((day.count / weeklyData.maxCount) * 100)
                        : 0;

                      return (
                        <div
                          key={idx}
                          className={`bar-col ${day.isToday ? 'is-today' : ''} ${day.isOtherMonth ? 'is-other-month' : ''}`}
                        >
                          <div className="bar-count-label">{day.count > 0 ? day.count : ''}</div>
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${day.count > 0 ? 'has-data' : 'empty-data'}`}
                              style={{ height: `${Math.max(6, heightPercent)}%` }}
                              title={`${day.dateStr}: ${day.count} injections`}
                            />
                          </div>
                          <div className="bar-day-name">{day.dayName}</div>
                          <div className="bar-short-date">{day.shortDate}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Rapid Injection Trend Warning (< 3h) */}
                <div className="rapid-trend-card">
                  <div className="rapid-card-header">
                    <div className={`rapid-icon-wrapper ${rapidInjections.rapidList.length > 0 ? 'warning' : 'safe'}`}>
                      {rapidInjections.rapidList.length > 0 ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className="rapid-header-text">
                      <h3 className="rapid-title">Rapid Injection Trend</h3>
                      <span className="rapid-subtitle">Intervals under the recommended 3-hour spacing</span>
                    </div>
                  </div>

                  {rapidInjections.rapidList.length > 0 ? (
                    <div className="rapid-content">
                      <p className="rapid-guidance">
                        ⚠️ <strong>{rapidInjections.rapidList.length} dose{rapidInjections.rapidList.length === 1 ? '' : 's'}</strong> recorded less than 3 hours after a prior injection. If logged by mistake, take note; if intentional correction, monitor blood glucose closely.
                      </p>
                      <div className="rapid-incidents-list">
                        {rapidInjections.rapidList.map((item, idx) => (
                          <div key={idx} className="rapid-incident-item">
                            <div className="incident-time-row">
                              <span className="incident-time">{formatDateTime(item.currentInjectedAt)}</span>
                              <span className="incident-interval-badge">+{item.intervalStr} after prior dose</span>
                            </div>
                            <div className="incident-prior-info">
                              Prior injection was at {formatTimeOnly(item.previousInjectedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rapid-clear-content">
                      <span className="rapid-clear-text">
                        All recorded injections have maintained the recommended 3+ hour spacing. No premature doses detected.
                      </span>
                    </div>
                  )}
                </div>

                {/* 5. Today's Injection Logs (Daily View) */}
                <div className="daily-logs-section">
                  <div className="daily-logs-header">
                    <div className="daily-logs-title-group">
                      <h3 className="daily-logs-title">Today's Injections</h3>
                      <span className="daily-logs-subtitle">{todayDateKey}</span>
                    </div>
                    <span className="daily-count-badge">
                      {todayLogs.length} {todayLogs.length === 1 ? 'injection' : 'injections'}
                    </span>
                  </div>

                  {todayLogs.length === 0 ? (
                    <div className="daily-empty-card">
                      <span className="daily-empty-text">No injections recorded today yet.</span>
                    </div>
                  ) : (
                    <ul className="logs-list">
                      {todayLogs.map(log => {
                        const isRapid = rapidInjections.rapidIds.has(log.id);

                        return (
                          <li key={log.id} className={`log-item ${isRapid ? 'rapid-log-item' : ''}`}>
                            <div className="log-field">
                              <span className="log-label">Injected:</span>
                              <div className="log-value-group">
                                <span className="log-value">{formatTimeOnly(log.injected_at)}</span>
                                {isRapid && (
                                  <span className="log-rapid-pill" title="Logged under 3h after prior dose">
                                    ⚠️ &lt; 3h
                                  </span>
                                )}
                              </div>
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
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
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

              {/* 1. Add Configuration Form */}
              <form onSubmit={handleSaveTelegramSettings} className="settings-form">
                <div className="form-group">
                  <label htmlFor="config-label" className="form-label">
                    Configuration Name <span className="label-optional">(Optional)</span>
                  </label>
                  <input
                    id="config-label"
                    type="text"
                    className="form-input"
                    placeholder="e.g. My Phone, Channel"
                    value={telegramLabel}
                    onChange={(e) => setTelegramLabel(e.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

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
                  <div className="input-prefix-group">
                    <span className="input-prefix" aria-hidden="true">-</span>
                    <input
                      id="chat-id"
                      type="text"
                      className="form-input with-prefix"
                      placeholder="e.g. 4304245048 or 1004304245048"
                      value={telegramChatId.replace(/^-+/, '')}
                      onChange={(e) => setTelegramChatId(e.target.value.replace(/^-+/, ''))}
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                </div>

                <p className="settings-note">
                  Notifications are sent 2 and 3 hours after each injection via Telegram. Newly saved destinations are automatically marked as default.
                </p>

                <div className="form-actions">
                  <button type="submit" className="save-btn" disabled={isSavingSettings || !telegramBotToken.trim() || !telegramChatId.trim()}>
                    <span className="btn-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                    </span>
                    {isSavingSettings ? 'Saving...' : 'Save & Set as Default'}
                  </button>

                  <button
                    type="button"
                    className="test-btn"
                    onClick={() => handleTestTelegramNotification()}
                    disabled={isTestingTelegram || !telegramBotToken.trim() || !telegramChatId.trim()}
                  >
                    <span className="btn-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </span>
                    {isTestingTelegram ? 'Sending Test...' : 'Send Test Notification'}
                  </button>
                </div>
              </form>

              {/* 2. Saved Configurations List with Default Radio Button & Delete */}
              <div className="configs-section">
                <div className="configs-header">
                  <h3 className="configs-title">Saved Configurations</h3>
                  <span className="configs-count-badge">
                    {telegramConfigs.length} {telegramConfigs.length === 1 ? 'destination' : 'destinations'}
                  </span>
                </div>

                {telegramConfigs.length === 0 ? (
                  <div className="configs-empty-card">
                    <span className="configs-empty-text">No configurations saved yet. Enter details above to add one.</span>
                  </div>
                ) : (
                  <ul className="configs-list">
                    {telegramConfigs.map((cfg) => {
                      const hasCustom = isCustomConfigName(cfg.name, cfg.chatId);
                      return (
                        <li key={cfg.id} className={`config-item ${cfg.isDefault ? 'is-default' : ''}`}>
                          <label className="config-radio-label">
                            <input
                              type="radio"
                              name="default-telegram-config"
                              checked={cfg.isDefault}
                              onChange={() => handleSetDefaultConfig(cfg.id)}
                              className="config-radio"
                            />
                            <div className="config-info">
                              {hasCustom ? (
                                <>
                                  <div className="config-title-row">
                                    <span className="config-name">{cfg.name}</span>
                                  </div>
                                  <div className="config-details">
                                    <span className="config-detail-item">
                                      <span className="config-chat-group">
                                        <strong>Chat:</strong> {cfg.chatId}
                                        {cfg.isDefault && (
                                          <span className="default-pill">DEFAULT</span>
                                        )}
                                      </span>
                                    </span>
                                    <span className="config-detail-item">
                                      <strong>Token:</strong> {maskBotToken(cfg.botToken)}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="config-title-row">
                                    <span className="config-chat-group config-chat-title">
                                      <strong className="config-chat-prefix">Chat:</strong>
                                      <span className="config-chat-id-text">{cfg.chatId}</span>
                                      {cfg.isDefault && (
                                        <span className="default-pill">DEFAULT</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="config-details">
                                    <span className="config-detail-item">
                                      <strong>Token:</strong> {maskBotToken(cfg.botToken)}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </label>

                          <div className="config-item-actions">
                            <button
                              type="button"
                              className="config-row-test-btn"
                              title="Test this configuration"
                              onClick={() => handleTestTelegramNotification(cfg.botToken, cfg.chatId)}
                              disabled={isTestingTelegram}
                            >
                              Test
                            </button>
                            <button
                              type="button"
                              className="config-row-delete-btn"
                              title={hasCustom ? `Delete ${cfg.name}` : `Delete configuration for ${cfg.chatId}`}
                              onClick={() => handleOpenDeleteModal(cfg)}
                              aria-label={hasCustom ? `Delete ${cfg.name}` : `Delete configuration for ${cfg.chatId}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalConfig && (
        <div className="modal-overlay" onClick={handleCloseDeleteModal} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="modal-card delete-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-wrapper delete-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <h3 id="delete-modal-title" className="modal-title">Delete Telegram Configuration?</h3>
            </div>
            <div className="modal-body">
              <p className="delete-modal-text">
                {isCustomConfigName(deleteModalConfig.name, deleteModalConfig.chatId) ? (
                  <>Are you sure you want to delete <strong>{deleteModalConfig.name}</strong> ({deleteModalConfig.chatId})?</>
                ) : (
                  <>Are you sure you want to delete configuration for chat <strong>{deleteModalConfig.chatId}</strong>?</>
                )}
              </p>
              {deleteModalConfig.isDefault && (
                <p className="delete-modal-warning">
                  This is currently the default destination. If deleted, another saved destination will automatically become active.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn cancel-btn"
                onClick={handleCloseDeleteModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn confirm-delete-btn"
                onClick={handleConfirmDelete}
              >
                Delete Configuration
              </button>
            </div>
          </div>
        </div>
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
