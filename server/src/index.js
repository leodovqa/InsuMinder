const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.post('/api/injections', (req, res) => {
  db.insertInjectionLog(function(err) {
    if (err) {
      const status = err.status || 500;
      res.status(status).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, id: this.lastID });
    }
  });
});

app.get('/api/logs', (req, res) => {
  db.getLogsFromLast24Hours(function(err, rows) {
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
