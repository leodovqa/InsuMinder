const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.post('/api/injections', (req, res) => {
  const now = new Date();
  const notify_2h_at = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const notify_3h_at = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const stmt = db.prepare("INSERT INTO injection_logs (notify_2h_at, notify_3h_at) VALUES (?, ?)");
  stmt.run(notify_2h_at, notify_3h_at, function(err) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, id: this.lastID });
    }
  });
  stmt.finalize();
});

app.get('/api/logs', (req, res) => {
  db.all("SELECT * FROM injection_logs WHERE injected_at >= datetime('now', '-24 hours') ORDER BY injected_at DESC", [], (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, logs: rows });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
