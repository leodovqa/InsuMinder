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
      <button onClick={handleLogInjection}>Log Insulin Injection</button>
      <h2>Injection Logs</h2>
      <ul>
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
    </div>
  );
}

export default App;
