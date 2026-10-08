import { useState, useEffect } from 'react';
import './App.css';
import { formatDate } from './utils';

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
          <li key={log.id}>
            ID: {log.id}, Injected At: {formatDate(log.injected_at)}, Notify 2h At: {formatDate(log.notify_2h_at)}, Notify 3h At: {formatDate(log.notify_3h_at)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
