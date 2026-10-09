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

  db.run("CREATE TABLE IF NOT EXISTS settings ("
    + "key TEXT PRIMARY KEY,"
    + "value TEXT"
    + ")");

  db.run("CREATE TABLE IF NOT EXISTS telegram_configs ("
    + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    + "name TEXT,"
    + "bot_token TEXT NOT NULL,"
    + "chat_id TEXT NOT NULL,"
    + "is_default BOOLEAN DEFAULT 0,"
    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    + ")", () => {
      // Migrate legacy settings into telegram_configs if empty
      db.get("SELECT COUNT(*) AS count FROM telegram_configs", (err, countRow) => {
        if (!err && countRow && countRow.count === 0) {
          getAllSettings((sErr, settings) => {
            if (!sErr && settings && settings.telegram_bot_token && settings.telegram_chat_id) {
              db.run(
                "INSERT INTO telegram_configs (name, bot_token, chat_id, is_default) VALUES (?, ?, ?, 1)",
                ['Primary Bot', settings.telegram_bot_token, settings.telegram_chat_id]
              );
            }
          });
        }
      });
    });
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

function getAllSettings(callback) {
  db.all("SELECT key, value FROM settings", (err, rows) => {
    if (err) return callback(err);
    const settings = {};
    if (rows) {
      rows.forEach(r => {
        settings[r.key] = r.value;
      });
    }
    callback(null, settings);
  });
}

function setSettings(settingsObj, callback) {
  const entries = Object.entries(settingsObj);
  if (entries.length === 0) return callback(null);

  db.serialize(() => {
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    let errorOccurred = null;

    entries.forEach(([key, val]) => {
      stmt.run(key, val, (err) => {
        if (err && !errorOccurred) errorOccurred = err;
      });
    });

    stmt.finalize((err) => {
      callback(errorOccurred || err || null);
    });
  });
}

function getTelegramConfigs(callback) {
  db.all("SELECT * FROM telegram_configs ORDER BY is_default DESC, id DESC", callback);
}

function getDefaultTelegramConfig(callback) {
  db.get("SELECT * FROM telegram_configs WHERE is_default = 1 LIMIT 1", (err, row) => {
    if (err) return callback(err);
    if (row) return callback(null, row);

    // Fallback to most recent config if none marked default
    db.get("SELECT * FROM telegram_configs ORDER BY id DESC LIMIT 1", (fallbackErr, fallbackRow) => {
      if (fallbackErr) return callback(fallbackErr);
      if (fallbackRow) return callback(null, fallbackRow);

      // Fallback to settings table
      getAllSettings((sErr, settings) => {
        if (sErr) return callback(sErr);
        if (settings && settings.telegram_bot_token && settings.telegram_chat_id) {
          return callback(null, {
            id: 0,
            name: 'Primary Bot',
            bot_token: settings.telegram_bot_token,
            chat_id: settings.telegram_chat_id,
            is_default: 1
          });
        }
        callback(null, null);
      });
    });
  });
}

function addTelegramConfig({ name, bot_token, chat_id }, callback) {
  db.serialize(() => {
    db.run("UPDATE telegram_configs SET is_default = 0", (err) => {
      if (err) return callback(err);

      const label = (name && name.trim()) || '';
      const cleanToken = bot_token.trim();
      const cleanChatId = chat_id.trim();

      const stmt = db.prepare("INSERT INTO telegram_configs (name, bot_token, chat_id, is_default) VALUES (?, ?, ?, 1)");
      stmt.run(label, cleanToken, cleanChatId, function(insertErr) {
        if (insertErr) return callback(insertErr);
        const newId = this.lastID;

        // Also sync settings table
        setSettings({
          telegram_bot_token: cleanToken,
          telegram_chat_id: cleanChatId
        }, () => {
          callback(null, {
            id: newId,
            name: label,
            bot_token: cleanToken,
            chat_id: cleanChatId,
            is_default: 1
          });
        });
      });
      stmt.finalize();
    });
  });
}

function setDefaultTelegramConfig(id, callback) {
  db.serialize(() => {
    db.run("UPDATE telegram_configs SET is_default = 0", (err) => {
      if (err) return callback(err);

      db.run("UPDATE telegram_configs SET is_default = 1 WHERE id = ?", [id], function(updateErr) {
        if (updateErr) return callback(updateErr);

        db.get("SELECT * FROM telegram_configs WHERE id = ?", [id], (getErr, row) => {
          if (!getErr && row) {
            setSettings({
              telegram_bot_token: row.bot_token,
              telegram_chat_id: row.chat_id
            }, () => callback(null, row));
          } else {
            callback(getErr || null);
          }
        });
      });
    });
  });
}

function deleteTelegramConfig(id, callback) {
  db.get("SELECT is_default FROM telegram_configs WHERE id = ?", [id], (checkErr, target) => {
    if (checkErr) return callback(checkErr);
    if (!target) return callback(new Error("Config not found"));

    const wasDefault = Boolean(target.is_default);

    db.run("DELETE FROM telegram_configs WHERE id = ?", [id], function(delErr) {
      if (delErr) return callback(delErr);

      if (wasDefault) {
        db.get("SELECT id, bot_token, chat_id FROM telegram_configs ORDER BY id DESC LIMIT 1", (remErr, remaining) => {
          if (!remErr && remaining) {
            db.run("UPDATE telegram_configs SET is_default = 1 WHERE id = ?", [remaining.id], () => {
              setSettings({
                telegram_bot_token: remaining.bot_token,
                telegram_chat_id: remaining.chat_id
              }, callback);
            });
          } else {
            setSettings({
              telegram_bot_token: '',
              telegram_chat_id: ''
            }, callback);
          }
        });
      } else {
        callback(null);
      }
    });
  });
}

function getDueNotifications(callback) {
  const now = new Date().toISOString();
  db.all(
    "SELECT * FROM injection_logs WHERE (status_2h_sent = 0 AND notify_2h_at <= ?) OR (status_3h_sent = 0 AND notify_3h_at <= ?) ORDER BY injected_at ASC",
    [now, now],
    callback
  );
}

function markNotificationSent(id, type, callback) {
  const column = type === '2h' ? 'status_2h_sent' : 'status_3h_sent';
  db.run(`UPDATE injection_logs SET ${column} = 1 WHERE id = ?`, [id], callback);
}

function expireAncientNotifications(cutoffIso, callback) {
  db.run(
    "UPDATE injection_logs SET status_2h_sent = 1 WHERE status_2h_sent = 0 AND notify_2h_at < ?",
    [cutoffIso],
    (err1) => {
      if (err1) return callback(err1);
      db.run(
        "UPDATE injection_logs SET status_3h_sent = 1 WHERE status_3h_sent = 0 AND notify_3h_at < ?",
        [cutoffIso],
        callback
      );
    }
  );
}

module.exports = {
  db,
  insertInjectionLog,
  getLogsFromLast24Hours,
  getAllSettings,
  setSettings,
  getTelegramConfigs,
  getDefaultTelegramConfig,
  addTelegramConfig,
  setDefaultTelegramConfig,
  deleteTelegramConfig,
  getDueNotifications,
  markNotificationSent,
  expireAncientNotifications
};
