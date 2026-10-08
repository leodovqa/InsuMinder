const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./insuminder.db');

router.post('/api/injections', (req, res) => {
  const now = new Date();
  const notify_2h_at = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const notify_3h_at = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  db.run('INSERT INTO injection_logs (injected_at, notify_2h_at, notify_3h_at) VALUES (?, ?, ?)', [now, notify_2h_at, notify_3h_at], function(err) {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

router.get('/api/logs', (req, res) => {
  db.all('SELECT * FROM injection_logs WHERE injected_at >= datetime(\'now\', \'-24 hours\') ORDER BY injected_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, logs: rows });
  });
});

module.exports = router;
