import { useState, useEffect } from 'react';
import './App.css';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleString('en-IL', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

function App() {
  const [logs, setLogs] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const handleLogInjection = () => {
    fetch('/api/injections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        fetch('/api/logs')
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              setLogs(data.logs);
            }
          })
          .catch(error => console.error('Error fetching logs:', error));
      }
    })
    .catch(error => console.error('Error logging injection:', error));
  };

  return (
    <div className="App">
      <h1>InsuMinder</h1>
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
            <p className="no-logs">No injections logged in the last 24 hours.</p>
          ) : (
            <ul className="logs-list">
              {logs.map(log => (
                <li key={log.id} className="log-item">
                  <div className="log-field">
                    <span className="log-label">Injected:</span>
                    <span className="log-value">{formatDate(log.injected_at)}</span>
                  </div>
                  <div className="log-field">
                    <span className="log-label">2h Reminder:</span>
                    <span className="log-value">{formatDate(log.notify_2h_at)}</span>
                  </div>
                  <div className="log-field">
                    <span className="log-label">3h Reminder:</span>
                    <span className="log-value">{formatDate(log.notify_3h_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

export default App;
