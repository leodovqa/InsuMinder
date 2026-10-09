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

const getStartOfWeek = (d) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 is Sunday, 6 is Saturday (Israel calendar: Sun to Sat)
  date.setDate(date.getDate() - day);
  return date;
};

const getWeeksBelongingToMonth = (year, monthIndex) => {
  // In Sunday-to-Saturday weeks, Wednesday (4th day, +3) defines the anchor month
  const weeks = [];
  const firstOfMonth = new Date(year, monthIndex, 1);
  let cur = getStartOfWeek(firstOfMonth);

  for (let i = 0; i < 6; i++) {
    const wednesday = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 3);
    if (wednesday.getMonth() === monthIndex && wednesday.getFullYear() === year) {
      weeks.push(new Date(cur));
    }
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
};

const getWeekDisplayInfo = (selectedWeekStart) => {
  const wednesday = new Date(
    selectedWeekStart.getFullYear(),
    selectedWeekStart.getMonth(),
    selectedWeekStart.getDate() + 3
  );
  const anchorYear = wednesday.getFullYear();
  const anchorMonth = wednesday.getMonth();

  const monthWeeks = getWeeksBelongingToMonth(anchorYear, anchorMonth);
  const startIso = selectedWeekStart.toISOString().slice(0, 10);
  let activeWeekIndex = monthWeeks.findIndex(w => w.toISOString().slice(0, 10) === startIso);
  if (activeWeekIndex === -1) {
    activeWeekIndex = 0;
  }

  const monthName = wednesday.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return {
    anchorYear,
    anchorMonth,
    monthName,
    activeWeekIndex,
    weekNumber: activeWeekIndex + 1,
    totalWeeks: monthWeeks.length,
    monthWeeks
  };
};

const getWeeklyTrendData = (logsList, selectedWeekStart) => {
  const days = [];
  const todayStr = formatDateOnly(new Date().toISOString());
  const anchorWednesday = new Date(
    selectedWeekStart.getFullYear(),
    selectedWeekStart.getMonth(),
    selectedWeekStart.getDate() + 3
  );
  const anchorMonth = anchorWednesday.getMonth();

  for (let i = 0; i < 7; i++) {
    const d = new Date(
      selectedWeekStart.getFullYear(),
      selectedWeekStart.getMonth(),
      selectedWeekStart.getDate() + i,
      12,
      0,
      0
    );
    const dateStr = formatDateOnly(d.toISOString());
    const dayName = d.toLocaleDateString('en-IL', { weekday: 'short' });
    const dayNum = d.getDate();
    const monthNum = d.getMonth() + 1;
    const isToday = dateStr === todayStr;
    const isOtherMonth = d.getMonth() !== anchorMonth;

    const count = logsList.filter(log => formatDateOnly(log.injected_at) === dateStr).length;

    days.push({
      date: d,
      dateStr,
      dayName,
      shortDate: `${dayNum}/${monthNum}`,
      count,
      isToday,
      isOtherMonth
    });
  }

  const totalWeekInjections = days.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(3, ...days.map(d => d.count));
  const activeDaysCount = days.filter(d => d.count > 0).length;
  const dailyAvg = (totalWeekInjections / 7).toFixed(1);

  const startDay = days[0].date;
  const endDay = days[6].date;
  const startDayMonth = `${startDay.getDate()}/${startDay.getMonth() + 1}`;
  const endDayMonth = `${endDay.getDate()}/${endDay.getMonth() + 1}`;
  const weekRangeStr = `${startDayMonth} – ${endDayMonth}`;

  const todayWeekStart = getStartOfWeek(new Date());
  const isCurrentWeek =
    selectedWeekStart.getFullYear() === todayWeekStart.getFullYear() &&
    selectedWeekStart.getMonth() === todayWeekStart.getMonth() &&
    selectedWeekStart.getDate() === todayWeekStart.getDate();

  return {
    days,
    totalWeekInjections,
    maxCount,
    activeDaysCount,
    dailyAvg,
    weekRangeStr,
    isCurrentWeek
  };
};

const getRapidInjections = (logsList) => {
  const rapidList = [];
  const rapidIds = new Set();

  // logsList is ordered descending (latest first)
  for (let i = 0; i < logsList.length - 1; i++) {
    const current = logsList[i];
    const previous = logsList[i + 1];
    const currentMs = new Date(current.injected_at).getTime();
    const prevMs = new Date(previous.injected_at).getTime();
    const diffMs = currentMs - prevMs;
    const threeHoursMs = 3 * 60 * 60 * 1000;

    if (diffMs > 0 && diffMs < threeHoursMs) {
      const diffMinutes = Math.round(diffMs / (60 * 1000));
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      const intervalStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      rapidList.push({
        currentId: current.id,
        currentInjectedAt: current.injected_at,
        previousInjectedAt: previous.injected_at,
        intervalStr,
        diffMinutes
      });
      rapidIds.add(current.id);
    }
  }

  return { rapidList, rapidIds };
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
  const [notification, setNotification] = useState(null);
  const [isLatestExpanded, setIsLatestExpanded] = useState(false);
  const [isLoggedIn] = useState(false); // Auth state placeholder (future login logic)
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);

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
