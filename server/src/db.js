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
  // Users table
  db.run("CREATE TABLE IF NOT EXISTS users ("
    + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    + "email TEXT UNIQUE NOT NULL,"
    + "password_hash TEXT,"
    + "google_id TEXT,"
    + "name TEXT,"
    + "avatar TEXT,"
    + "is_verified BOOLEAN DEFAULT 0,"
    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    + ")");

  // Verification codes table
  db.run("CREATE TABLE IF NOT EXISTS verification_codes ("
    + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    + "email TEXT NOT NULL,"
    + "password_hash TEXT NOT NULL,"
    + "code TEXT NOT NULL,"
    + "expires_at TIMESTAMP NOT NULL,"
    + "consumed BOOLEAN DEFAULT 0,"
    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    + ")");

  // Injection logs table
  db.run("CREATE TABLE IF NOT EXISTS injection_logs ("
    + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    + "user_id INTEGER,"
    + "injected_at TIMESTAMP NOT NULL,"
    + "notify_10m_at TIMESTAMP,"
    + "notify_2h_at TIMESTAMP NOT NULL,"
    + "notify_3h_at TIMESTAMP NOT NULL,"
    + "status_10m_sent BOOLEAN DEFAULT 0,"
    + "status_2h_sent BOOLEAN DEFAULT 0,"
    + "status_3h_sent BOOLEAN DEFAULT 0,"
    + "error_10m TEXT,"
    + "error_2h TEXT,"
    + "error_3h TEXT,"
    + "FOREIGN KEY(user_id) REFERENCES users(id)"
    + ")", () => {
      // Auto-migrate columns if table already existed
      db.run("ALTER TABLE injection_logs ADD COLUMN user_id INTEGER", () => {});
      db.run("ALTER TABLE injection_logs ADD COLUMN notify_10m_at TIMESTAMP", () => {});
      db.run("ALTER TABLE injection_logs ADD COLUMN status_10m_sent BOOLEAN DEFAULT 0", () => {});
      db.run("ALTER TABLE injection_logs ADD COLUMN error_10m TEXT", () => {});
      db.run("ALTER TABLE injection_logs ADD COLUMN error_2h TEXT", () => {});
      db.run("ALTER TABLE injection_logs ADD COLUMN error_3h TEXT", () => {});
    });

  // Settings table (legacy backward compatibility)
  db.run("CREATE TABLE IF NOT EXISTS settings ("
    + "key TEXT PRIMARY KEY,"
    + "value TEXT"
    + ")");

  // Telegram configs table
  db.run("CREATE TABLE IF NOT EXISTS telegram_configs ("
    + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    + "user_id INTEGER,"
    + "name TEXT,"
    + "bot_token TEXT NOT NULL,"
    + "chat_id TEXT NOT NULL,"
    + "is_default BOOLEAN DEFAULT 0,"
    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    + "FOREIGN KEY(user_id) REFERENCES users(id)"
    + ")", () => {
      db.run("ALTER TABLE telegram_configs ADD COLUMN user_id INTEGER", () => {});
    });

  // Users share_code column
  db.run("ALTER TABLE users ADD COLUMN share_code TEXT", () => {});

  // Shared members table (connects caregivers/family members to owner's data)
  db.run("CREATE TABLE IF NOT EXISTS shared_members ("
    + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    + "owner_id INTEGER NOT NULL,"
    + "member_id INTEGER NOT NULL,"
    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    + "UNIQUE(owner_id, member_id),"
    + "FOREIGN KEY(owner_id) REFERENCES users(id),"
    + "FOREIGN KEY(member_id) REFERENCES users(id)"
    + ")");

  // Share invites table
  db.run("CREATE TABLE IF NOT EXISTS share_invites ("
    + "id INTEGER PRIMARY KEY AUTOINCREMENT,"
    + "owner_id INTEGER NOT NULL,"
    + "invite_email TEXT NOT NULL,"
    + "share_code TEXT NOT NULL,"
    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
    + "FOREIGN KEY(owner_id) REFERENCES users(id)"
    + ")");
});

/* =========================================================================
   USER & VERIFICATION CODE METHODS
   ========================================================================= */

function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'INSU-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createUser({ email, password_hash, google_id, name, avatar, is_verified = 0, share_code }, callback) {
  const cleanEmail = String(email).trim().toLowerCase();
  const code = share_code || generateShareCode();
  const stmt = db.prepare(
    "INSERT INTO users (email, password_hash, google_id, name, avatar, is_verified, share_code) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  stmt.run(cleanEmail, password_hash || null, google_id || null, name || '', avatar || '', is_verified ? 1 : 0, code, function(err) {
    if (err) return callback(err);
    callback(null, {
      id: this.lastID,
      email: cleanEmail,
      name: name || '',
      avatar: avatar || '',
      is_verified: Boolean(is_verified),
      share_code: code
    });
  });
  stmt.finalize();
}

function getUserByEmail(email, callback) {
  if (!email) return callback(null, null);
  const cleanEmail = String(email).trim().toLowerCase();
  db.get("SELECT * FROM users WHERE email = ? COLLATE NOCASE", [cleanEmail], callback);
}

function getUserById(id, callback) {
  db.get("SELECT id, email, name, avatar, is_verified, share_code, created_at FROM users WHERE id = ?", [id], callback);
}

function getUserByGoogleId(googleId, callback) {
  if (!googleId) return callback(null, null);
  db.get("SELECT * FROM users WHERE google_id = ?", [googleId], callback);
}

function updateUser(id, updates, callback) {
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.avatar !== undefined) {
    fields.push("avatar = ?");
    values.push(updates.avatar);
  }
  if (updates.password_hash !== undefined) {
    fields.push("password_hash = ?");
    values.push(updates.password_hash);
  }
  if (updates.google_id !== undefined) {
    fields.push("google_id = ?");
    values.push(updates.google_id);
  }
  if (updates.is_verified !== undefined) {
    fields.push("is_verified = ?");
    values.push(updates.is_verified ? 1 : 0);
  }

  if (fields.length === 0) return callback(null);

  values.push(id);
  db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values, callback);
}

function createVerificationCode({ email, password_hash, code, expires_at }, callback) {
  const cleanEmail = String(email).trim().toLowerCase();
  const stmt = db.prepare(
    "INSERT INTO verification_codes (email, password_hash, code, expires_at, consumed) VALUES (?, ?, ?, ?, 0)"
  );
  stmt.run(cleanEmail, password_hash, code, expires_at, function(err) {
    if (err) return callback(err);
    callback(null, { id: this.lastID, email: cleanEmail, code, expires_at });
  });
  stmt.finalize();
}

function getLatestVerificationCode(email, callback) {
  const cleanEmail = String(email).trim().toLowerCase();
  db.get(
    "SELECT * FROM verification_codes WHERE email = ? COLLATE NOCASE AND consumed = 0 ORDER BY id DESC LIMIT 1",
    [cleanEmail],
    callback
  );
}

function consumeVerificationCode(id, callback) {
  db.run("UPDATE verification_codes SET consumed = 1 WHERE id = ?", [id], callback);
}

/* =========================================================================
   INJECTION LOGS METHODS
   ========================================================================= */

function insertInjectionLog(userIdOrCallback, maybeCallback) {
  const userId = typeof userIdOrCallback === 'number' ? userIdOrCallback : null;
  const callback = typeof userIdOrCallback === 'function' ? userIdOrCallback : maybeCallback;

  const now = new Date();
  const currentMinute = now.toISOString().slice(0, 16);

  // Rate-limit per user (or globally if no user)
  const rateLimitSql = userId
    ? "SELECT injected_at FROM injection_logs WHERE user_id = ? ORDER BY injected_at DESC LIMIT 1"
    : "SELECT injected_at FROM injection_logs ORDER BY injected_at DESC LIMIT 1";
  const rateLimitParams = userId ? [userId] : [];

  db.get(rateLimitSql, rateLimitParams, (err, row) => {
    if (err) return callback(err);

    if (row && row.injected_at && row.injected_at.slice(0, 16) === currentMinute) {
      const duplicateErr = new Error("An injection has already been recorded this minute. You can only log once per minute.");
      duplicateErr.status = 409;
      return callback(duplicateErr);
    }

    const injected_at = now.toISOString();
    const notify_10m_at = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const notify_2h_at = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const notify_3h_at = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();

    const stmt = db.prepare(
      "INSERT INTO injection_logs (user_id, injected_at, notify_10m_at, notify_2h_at, notify_3h_at) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(userId, injected_at, notify_10m_at, notify_2h_at, notify_3h_at, callback);
    stmt.finalize();
  });
}

function getLogsFromLast24Hours(userIdOrCallback, maybeCallback) {
  const userId = typeof userIdOrCallback === 'number' ? userIdOrCallback : (typeof userIdOrCallback === 'string' ? parseInt(userIdOrCallback, 10) : null);
  const callback = typeof userIdOrCallback === 'function' ? userIdOrCallback : maybeCallback;

  if (userId) {
    db.all("SELECT * FROM injection_logs WHERE user_id = ? ORDER BY injected_at DESC", [userId], callback);
  } else {
    // If no userId is specified (legacy or unauthenticated query)
    db.all("SELECT * FROM injection_logs ORDER BY injected_at DESC", callback);
  }
}

/* =========================================================================
   SETTINGS & TELEGRAM CONFIGS
   ========================================================================= */

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

function getTelegramConfigs(userIdOrCallback, maybeCallback) {
  const userId = typeof userIdOrCallback === 'number' ? userIdOrCallback : null;
  const callback = typeof userIdOrCallback === 'function' ? userIdOrCallback : maybeCallback;

  if (userId) {
    db.all("SELECT * FROM telegram_configs WHERE user_id = ? ORDER BY is_default DESC, id DESC", [userId], callback);
  } else {
    db.all("SELECT * FROM telegram_configs ORDER BY is_default DESC, id DESC", callback);
  }
}

function getDefaultTelegramConfig(userIdOrCallback, maybeCallback) {
  const userId = typeof userIdOrCallback === 'number' ? userIdOrCallback : null;
  const callback = typeof userIdOrCallback === 'function' ? userIdOrCallback : maybeCallback;

  if (userId) {
    db.get("SELECT * FROM telegram_configs WHERE user_id = ? AND is_default = 1 LIMIT 1", [userId], (err, row) => {
      if (err) return callback(err);
      if (row) return callback(null, row);

      db.get("SELECT * FROM telegram_configs WHERE user_id = ? ORDER BY id DESC LIMIT 1", [userId], (fallbackErr, fallbackRow) => {
        if (fallbackErr) return callback(fallbackErr);
        callback(null, fallbackRow || null);
      });
    });
  } else {
    // Unassigned or global fallback
    db.get("SELECT * FROM telegram_configs WHERE is_default = 1 LIMIT 1", (err, row) => {
      if (err) return callback(err);
      if (row) return callback(null, row);

      db.get("SELECT * FROM telegram_configs ORDER BY id DESC LIMIT 1", (fallbackErr, fallbackRow) => {
        if (fallbackErr) return callback(fallbackErr);
        if (fallbackRow) return callback(null, fallbackRow);

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
}

function addTelegramConfig(userIdOrConfig, configOrCallback, maybeCallback) {
  let userId = null;
  let config = {};
  let callback = () => {};

  if (typeof userIdOrConfig === 'number') {
    userId = userIdOrConfig;
    config = configOrCallback;
    callback = maybeCallback;
  } else {
    config = userIdOrConfig;
    callback = configOrCallback;
  }

  const { name, bot_token, chat_id } = config || {};
  const label = (name && name.trim()) || '';
  const cleanToken = (bot_token && bot_token.trim()) || '';
  const cleanChatId = (chat_id && chat_id.trim()) || '';

  db.serialize(() => {
    const unmarkSql = userId
      ? "UPDATE telegram_configs SET is_default = 0 WHERE user_id = ?"
      : "UPDATE telegram_configs SET is_default = 0";
    const unmarkParams = userId ? [userId] : [];

    db.run(unmarkSql, unmarkParams, (err) => {
      if (err) return callback(err);

      const stmt = db.prepare(
        "INSERT INTO telegram_configs (user_id, name, bot_token, chat_id, is_default) VALUES (?, ?, ?, ?, 1)"
      );
      stmt.run(userId, label, cleanToken, cleanChatId, function(insertErr) {
        if (insertErr) return callback(insertErr);
        const newId = this.lastID;

        // If unassigned or first config, also sync legacy settings
        setSettings({
          telegram_bot_token: cleanToken,
          telegram_chat_id: cleanChatId
        }, () => {
          callback(null, {
            id: newId,
            userId,
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

function setDefaultTelegramConfig(userIdOrId, idOrCallback, maybeCallback) {
  let userId = null;
  let id = null;
  let callback = () => {};

  if (typeof userIdOrId === 'number' && typeof idOrCallback === 'number') {
    userId = userIdOrId;
    id = idOrCallback;
    callback = maybeCallback;
  } else {
    id = userIdOrId;
    callback = idOrCallback;
  }

  db.serialize(() => {
    const unmarkSql = userId
      ? "UPDATE telegram_configs SET is_default = 0 WHERE user_id = ?"
      : "UPDATE telegram_configs SET is_default = 0";
    const unmarkParams = userId ? [userId] : [];

    db.run(unmarkSql, unmarkParams, (err) => {
      if (err) return callback(err);

      const markSql = userId
        ? "UPDATE telegram_configs SET is_default = 1 WHERE id = ? AND user_id = ?"
        : "UPDATE telegram_configs SET is_default = 1 WHERE id = ?";
      const markParams = userId ? [id, userId] : [id];

      db.run(markSql, markParams, function(updateErr) {
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

function deleteTelegramConfig(userIdOrId, idOrCallback, maybeCallback) {
  let userId = null;
  let id = null;
  let callback = () => {};

  if (typeof userIdOrId === 'number' && typeof idOrCallback === 'number') {
    userId = userIdOrId;
    id = idOrCallback;
    callback = maybeCallback;
  } else {
    id = userIdOrId;
    callback = idOrCallback;
  }

  const checkSql = userId
    ? "SELECT is_default FROM telegram_configs WHERE id = ? AND user_id = ?"
    : "SELECT is_default FROM telegram_configs WHERE id = ?";
  const checkParams = userId ? [id, userId] : [id];

  db.get(checkSql, checkParams, (checkErr, target) => {
    if (checkErr) return callback(checkErr);
    if (!target) return callback(new Error("Config not found"));

    const wasDefault = Boolean(target.is_default);

    const deleteSql = userId
      ? "DELETE FROM telegram_configs WHERE id = ? AND user_id = ?"
      : "DELETE FROM telegram_configs WHERE id = ?";
    const deleteParams = userId ? [id, userId] : [id];

    db.run(deleteSql, deleteParams, function(delErr) {
      if (delErr) return callback(delErr);

      if (wasDefault) {
        const fallbackSql = userId
          ? "SELECT id, bot_token, chat_id FROM telegram_configs WHERE user_id = ? ORDER BY id DESC LIMIT 1"
          : "SELECT id, bot_token, chat_id FROM telegram_configs ORDER BY id DESC LIMIT 1";
        const fallbackParams = userId ? [userId] : [];

        db.get(fallbackSql, fallbackParams, (remErr, remaining) => {
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

/* =========================================================================
   SCHEDULER NOTIFICATIONS
   ========================================================================= */

function getDueNotifications(callback) {
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  db.all(
    "SELECT * FROM injection_logs WHERE ((status_10m_sent = 0 AND notify_10m_at <= ? AND notify_10m_at >= ?) OR (status_2h_sent = 0 AND notify_2h_at <= ? AND notify_2h_at >= ?) OR (status_3h_sent = 0 AND notify_3h_at <= ? AND notify_3h_at >= ?)) ORDER BY injected_at ASC",
    [nowIso, cutoff24hAgo, nowIso, cutoff24hAgo, nowIso, cutoff24hAgo],
    callback
  );
}

function markNotificationSent(id, type, callback) {
  const statusColumn = type === '10m' ? 'status_10m_sent' : type === '2h' ? 'status_2h_sent' : 'status_3h_sent';
  const errorColumn = type === '10m' ? 'error_10m' : type === '2h' ? 'error_2h' : 'error_3h';
  db.run(`UPDATE injection_logs SET ${statusColumn} = 1, ${errorColumn} = NULL WHERE id = ?`, [id], callback);
}

function recordNotificationError(id, type, errorMsg, callback) {
  const errorColumn = type === '10m' ? 'error_10m' : type === '2h' ? 'error_2h' : 'error_3h';
  const cleanMsg = (errorMsg && String(errorMsg).trim()) || 'Unknown error occurred while delivering Telegram reminder.';
  db.run(`UPDATE injection_logs SET ${errorColumn} = ? WHERE id = ?`, [cleanMsg, id], callback);
}

function expireAncientNotifications(cutoffIso, callback) {
  db.run(
    "UPDATE injection_logs SET error_10m = COALESCE(error_10m, 'Notification expired without delivery.') WHERE status_10m_sent = 0 AND notify_10m_at < ?",
    [cutoffIso],
    (err0) => {
      if (err0) return callback(err0);
      db.run(
        "UPDATE injection_logs SET error_2h = COALESCE(error_2h, 'Notification expired without delivery.') WHERE status_2h_sent = 0 AND notify_2h_at < ?",
        [cutoffIso],
        (err1) => {
          if (err1) return callback(err1);
          db.run(
            "UPDATE injection_logs SET error_3h = COALESCE(error_3h, 'Notification expired without delivery.') WHERE status_3h_sent = 0 AND notify_3h_at < ?",
            [cutoffIso],
            callback
          );
        }
      );
    }
  );
}

/* =========================================================================
   SHARED ACCESS & CAREGIVER / FAMILY SHARING METHODS
   ========================================================================= */

function ensureShareCode(userId, callback) {
  getUserById(userId, (err, user) => {
    if (err) return callback(err);
    if (!user) return callback(new Error('User not found.'));
    if (user.share_code) return callback(null, user.share_code);

    const newCode = generateShareCode();
    db.run("UPDATE users SET share_code = ? WHERE id = ?", [newCode, userId], (upErr) => {
      if (upErr) return callback(upErr);
      callback(null, newCode);
    });
  });
}

function getShareStatus(userId, callback) {
  ensureShareCode(userId, (err, shareCode) => {
    if (err) return callback(err);
    // 1. Members connected to my data (I am Owner/Admin)
    db.all(
      "SELECT u.id, u.email, u.name, u.avatar, sm.created_at as joined_at "
      + "FROM shared_members sm "
      + "JOIN users u ON sm.member_id = u.id "
      + "WHERE sm.owner_id = ? "
      + "ORDER BY sm.created_at DESC",
      [userId],
      (mErr, members) => {
        if (mErr) return callback(mErr);
        // 2. Shared groups I belong to (I am Member/Caregiver)
        db.all(
          "SELECT u.id as owner_id, u.email as owner_email, u.name as owner_name, u.avatar as owner_avatar, sm.created_at as joined_at "
          + "FROM shared_members sm "
          + "JOIN users u ON sm.owner_id = u.id "
          + "WHERE sm.member_id = ? "
          + "ORDER BY sm.created_at DESC",
          [userId],
          (gErr, groups) => {
            if (gErr) return callback(gErr);
            callback(null, {
              shareCode,
              members: (members || []).map(m => ({
                id: m.id,
                email: m.email,
                name: m.name || m.email.split('@')[0],
                avatar: m.avatar || '',
                joinedAt: m.joined_at
              })),
              sharedGroups: (groups || []).map(g => ({
                ownerId: g.owner_id,
                ownerEmail: g.owner_email,
                ownerName: g.owner_name || g.owner_email.split('@')[0],
                ownerAvatar: g.owner_avatar || '',
                joinedAt: g.joined_at
              }))
            });
          }
        );
      }
    );
  });
}

function addSharedMemberByCode(shareCode, memberId, callback) {
  if (!shareCode || typeof shareCode !== 'string') {
    return callback(new Error('Share code is required.'));
  }
  const cleanCode = shareCode.trim().toUpperCase();
  db.get("SELECT id, email, name FROM users WHERE share_code = ? COLLATE NOCASE", [cleanCode], (err, owner) => {
    if (err) return callback(err);
    if (!owner) {
      return callback(new Error('Invalid share code. Please check the code and try again.'));
    }
    if (owner.id === memberId) {
      return callback(new Error('You cannot join your own shared group.'));
    }
    db.run(
      "INSERT OR IGNORE INTO shared_members (owner_id, member_id) VALUES (?, ?)",
      [owner.id, memberId],
      (insErr) => {
        if (insErr) return callback(insErr);
        callback(null, {
          ownerId: owner.id,
          ownerEmail: owner.email,
          ownerName: owner.name || owner.email.split('@')[0]
        });
      }
    );
  });
}

function removeSharedMember(ownerId, memberId, callback) {
  db.run("DELETE FROM shared_members WHERE owner_id = ? AND member_id = ?", [ownerId, memberId], callback);
}

function leaveSharedGroup(ownerId, memberId, callback) {
  db.run("DELETE FROM shared_members WHERE owner_id = ? AND member_id = ?", [ownerId, memberId], callback);
}

function isSharedMember(ownerId, memberId, callback) {
  db.get("SELECT id FROM shared_members WHERE owner_id = ? AND member_id = ?", [ownerId, memberId], (err, row) => {
    if (err) return callback(err, false);
    callback(null, Boolean(row));
  });
}

function createShareInvite(ownerId, inviteEmail, callback) {
  ensureShareCode(ownerId, (err, shareCode) => {
    if (err) return callback(err);
    const cleanEmail = String(inviteEmail).trim().toLowerCase();
    db.run(
      "INSERT INTO share_invites (owner_id, invite_email, share_code) VALUES (?, ?, ?)",
      [ownerId, cleanEmail, shareCode],
      (insErr) => {
        if (insErr) return callback(insErr);
        callback(null, { shareCode, inviteEmail: cleanEmail });
      }
    );
  });
}

module.exports = {
  db,
  createUser,
  getUserByEmail,
  getUserById,
  getUserByGoogleId,
  updateUser,
  createVerificationCode,
  getLatestVerificationCode,
  consumeVerificationCode,
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
  recordNotificationError,
  expireAncientNotifications,
  generateShareCode,
  ensureShareCode,
  getShareStatus,
  addSharedMemberByCode,
  removeSharedMember,
  leaveSharedGroup,
  isSharedMember,
  createShareInvite
};
