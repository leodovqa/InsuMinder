import { useState, useEffect } from 'react';
import './App.css';

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

function App() {
  const [logs, setLogs] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});
  const [notification, setNotification] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  // Live real-time clock ticking every second (Asia/Jerusalem / local timezone)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IL', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setCurrentTime(timeStr);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

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

  return (
    <div className="App">
      <h1 className="app-title">InsuMinder</h1>
      <hr className="title-divider" />

      {/* Real-time Clock */}
      {currentTime && (
        <div className="live-clock" title="Current Local Time">
          <span className="clock-icon">🕒</span>
          <span className="clock-time">{currentTime}</span>
        </div>
      )}

      {/* Notification Banner (Success & Warning) */}
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

      <div className="actions-container">
        <button className="primary-btn" onClick={handleLogInjection}>
          Log Insulin Injection
        </button>
        <button
          className="secondary-btn"
          onClick={() => setIsSidebarOpen(true)}
          aria-expanded={isSidebarOpen}
        >
          📋 View Injection Logs {logs.length > 0 && <span className="badge">{logs.length}</span>}
        </button>
      </div>

      {/* Left-sided Modal Sidebar */}
      <div
        className={`sidebar-backdrop ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden={!isSidebarOpen}
      />
      <aside
        className={`sidebar-modal ${isSidebarOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Injection Logs"
        aria-hidden={!isSidebarOpen}
      >
        <div className="sidebar-header">
          <h2>Injection Logs</h2>
          <button
            className="close-btn"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close injection logs"
          >
            &times;
          </button>
        </div>
        <div className="sidebar-content">
          {logs.length === 0 ? (
            <p className="no-logs">No injections logged yet.</p>
          ) : (
            <div className="date-groups-container">
              {dateKeys.map((dateKey, index) => {
                const dateLogs = groupedLogs[dateKey];
                // Default: latest date (index 0) is expanded, others collapsed
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
      </aside>
    </div>
  );
}

export default App;
