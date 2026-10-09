const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../insuminder.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS injection_logs ("
    + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    + "injected_at TIMESTAMP NOT NULL,"
    + "notify_2h_at TIMESTAMP NOT NULL,"
    + "notify_3h_at TIMESTAMP NOT NULL,"
    + "status_2h_sent BOOLEAN DEFAULT 0,"
    + "status_3h_sent BOOLEAN DEFAULT 0"
    + ")");
});

function insertInjectionLog(callback) {
  const now = new Date();
  const currentMinute = now.toISOString().slice(0, 16);

  // Prevent multiple injections within the same minute
  db.get("SELECT injected_at FROM injection_logs ORDER BY injected_at DESC LIMIT 1", (err, row) => {
    if (err) return callback(err);

    if (row && row.injected_at && row.injected_at.slice(0, 16) === currentMinute) {
      const duplicateErr = new Error("An injection has already been recorded this minute. You can only log once per minute.");
      duplicateErr.status = 409;
      return callback(duplicateErr);
    }

    const injected_at = now.toISOString();
    const notify_2h_at = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const notify_3h_at = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();

    const stmt = db.prepare("INSERT INTO injection_logs (injected_at, notify_2h_at, notify_3h_at) VALUES (?, ?, ?)");
    stmt.run(injected_at, notify_2h_at, notify_3h_at, callback);
    stmt.finalize();
  });
}

function getLogsFromLast24Hours(callback) {
  db.all("SELECT * FROM injection_logs ORDER BY injected_at DESC", callback);
}

module.exports = {
  insertInjectionLog,
  getLogsFromLast24Hours
};
