const TELEGRAM_API_BASE = 'https://api.telegram.org';

async function postToTelegramApi(token, targetChatId, text) {
  try {
    const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: text,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || !data.ok) {
      const errorMsg = (data && data.description) ? data.description : `Telegram API error (${response.status})`;
      return { ok: false, error: errorMsg };
    }

    return { ok: true, result: data.result };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error reaching Telegram API.' };
  }
}

export async function sendTelegramMessage(botToken, chatId, text) {
  if (!botToken || !chatId) {
    return { ok: false, error: 'Telegram bot token and chat ID are required.' };
  }

  const cleanToken = String(botToken).trim();
  let cleanChatId = String(chatId).trim();

  if (!cleanToken || !cleanChatId) {
    return { ok: false, error: 'Telegram bot token and chat ID cannot be empty.' };
  }

  if (!cleanChatId.startsWith('-')) {
    cleanChatId = `-${cleanChatId}`;
  }

  const initialResult = await postToTelegramApi(cleanToken, cleanChatId, text);
  if (initialResult.ok) {
    return initialResult;
  }

  // Telegram Web K -100 fallback retry
  const digits = cleanChatId.replace(/^-+/, '');
  if (!cleanChatId.startsWith('-100') && digits.length >= 8 && digits.length <= 11) {
    const prefixedChatId = `-100${digits}`;
    const retryResult = await postToTelegramApi(cleanToken, prefixedChatId, text);
    if (retryResult.ok) {
      return retryResult;
    }
  }

  return initialResult;
}

export async function ensureTablesExist(db) {
  // Users table
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      google_id TEXT,
      name TEXT,
      avatar TEXT,
      is_verified BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  // Verification codes table
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      consumed BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  // Injection logs table
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS injection_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      injected_at TIMESTAMP NOT NULL,
      notify_10m_at TIMESTAMP,
      notify_2h_at TIMESTAMP NOT NULL,
      notify_3h_at TIMESTAMP NOT NULL,
      status_10m_sent BOOLEAN DEFAULT 0,
      status_2h_sent BOOLEAN DEFAULT 0,
      status_3h_sent BOOLEAN DEFAULT 0,
      error_10m TEXT,
      error_2h TEXT,
      error_3h TEXT
    )`
  ).run();

  try {
    await db.prepare(`ALTER TABLE injection_logs ADD COLUMN user_id INTEGER`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE injection_logs ADD COLUMN notify_10m_at TIMESTAMP`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE injection_logs ADD COLUMN status_10m_sent BOOLEAN DEFAULT 0`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE injection_logs ADD COLUMN error_10m TEXT`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE injection_logs ADD COLUMN error_2h TEXT`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE injection_logs ADD COLUMN error_3h TEXT`).run();
  } catch (err) {
    void err;
  }

  // Telegram configs table
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS telegram_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      bot_token TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  try {
    await db.prepare(`ALTER TABLE telegram_configs ADD COLUMN user_id INTEGER`).run();
  } catch (err) {
    void err;
  }

  // Shared members table
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS shared_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_id, member_id)
    )`
  ).run();

  // Share invites table
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS share_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      invite_email TEXT NOT NULL,
      share_code TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN first_name TEXT`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN last_name TEXT`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN phone TEXT`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN share_code TEXT`).run();
  } catch (err) {
    void err;
  }
}

export function formatDoseTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IL', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return '';
  }
}

export function buildMessage10m(injectedAt, isLocal = false) {
  const prefix = isLocal ? "🍽️ From InsuMinder (Local):" : "🍽️ From InsuMinder:";
  const doseTime = formatDoseTime(injectedAt);
  const doseLine = doseTime ? `\n💉 Dose logged at: ${doseTime}` : "";
  return `${prefix}\n⏰ Meal Time Reminder${doseLine}\n\n10 minutes have passed since your injection. You can now start your meal!`;
}

export function buildMessage2h(injectedAt, isLocal = false) {
  const prefix = isLocal ? "🩸 From InsuMinder (Local):" : "🩸 From InsuMinder:";
  const doseTime = formatDoseTime(injectedAt);
  const doseLine = doseTime ? `\n💉 Dose logged at: ${doseTime}` : "";
  return `${prefix}\n⏰ 2-Hour Glucose Check${doseLine}\n\nPlease go and check your Glucose level after 2 Hours.`;
}

export function buildMessage3h(injectedAt, isLocal = false) {
  const prefix = isLocal ? "🎯 From InsuMinder (Local):" : "🎯 From InsuMinder:";
  const doseTime = formatDoseTime(injectedAt);
  const doseLine = doseTime ? `\n💉 Dose logged at: ${doseTime}` : "";
  return `${prefix}\n⏰ 3-Hour Injection Eligibility${doseLine}\n\n3 hours have passed since your injection. Safe window reached for your next dose if needed.`;
}

export async function dispatchDueNotifications(db) {
  if (!db) return { dispatched: 0 };
  try {
    await ensureTablesExist(db);

    const now = new Date();
    const nowIso = now.toISOString();
    const cutoff24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Expire ancient notifications
    try {
      await db.prepare(
        `UPDATE injection_logs SET error_10m = COALESCE(error_10m, 'Notification expired without delivery.') WHERE status_10m_sent = 0 AND notify_10m_at < ?`
      ).bind(cutoff24hAgo).run();
      await db.prepare(
        `UPDATE injection_logs SET error_2h = COALESCE(error_2h, 'Notification expired without delivery.') WHERE status_2h_sent = 0 AND notify_2h_at < ?`
      ).bind(cutoff24hAgo).run();
      await db.prepare(
        `UPDATE injection_logs SET error_3h = COALESCE(error_3h, 'Notification expired without delivery.') WHERE status_3h_sent = 0 AND notify_3h_at < ?`
      ).bind(cutoff24hAgo).run();
    } catch (err) {
      void err;
    }

    const { results: due10m } = await db.prepare(
      `SELECT * FROM injection_logs WHERE status_10m_sent = 0 AND notify_10m_at <= ? AND notify_10m_at >= ? ORDER BY notify_10m_at ASC LIMIT 5`
    ).bind(nowIso, cutoff24hAgo).all();

    const { results: due2h } = await db.prepare(
      `SELECT * FROM injection_logs WHERE status_2h_sent = 0 AND notify_2h_at <= ? AND notify_2h_at >= ? ORDER BY notify_2h_at ASC LIMIT 5`
    ).bind(nowIso, cutoff24hAgo).all();

    const { results: due3h } = await db.prepare(
      `SELECT * FROM injection_logs WHERE status_3h_sent = 0 AND notify_3h_at <= ? AND notify_3h_at >= ? ORDER BY notify_3h_at ASC LIMIT 5`
    ).bind(nowIso, cutoff24hAgo).all();

    const allDue = [...(due10m || []), ...(due2h || []), ...(due3h || [])];
    if (allDue.length === 0) {
      return { dispatched: 0 };
    }

    // Helper to find default config for a specific log's user
    const getConfigForLog = async (log) => {
      if (log.user_id) {
        const userCfg = await db.prepare(
          `SELECT * FROM telegram_configs WHERE user_id = ? AND is_default = 1 LIMIT 1`
        ).bind(log.user_id).first();
        if (userCfg) return userCfg;
        const fallback = await db.prepare(
          `SELECT * FROM telegram_configs WHERE user_id = ? ORDER BY id DESC LIMIT 1`
        ).bind(log.user_id).first();
        if (fallback) return fallback;
      }
      return await db.prepare(`SELECT * FROM telegram_configs WHERE is_default = 1 LIMIT 1`).first();
    };

    let count = 0;

    if (due10m && due10m.length > 0) {
      for (const log of due10m) {
        const notifyTime = new Date(log.notify_10m_at).getTime();
        const minutesOverdue = (now.getTime() - notifyTime) / (60 * 1000);

        // Expire if 10m reminder is more than 45 minutes overdue
        if (minutesOverdue > 45) {
          await db.prepare(`UPDATE injection_logs SET error_10m = ? WHERE id = ?`)
            .bind('Notification expired without delivery (overdue).', log.id)
            .run();
          continue;
        }

        const cfg = await getConfigForLog(log);
        if (!cfg || !cfg.bot_token || !cfg.chat_id) {
          await db.prepare(`UPDATE injection_logs SET error_10m = ? WHERE id = ?`)
            .bind('Telegram is not configured. Go to Settings to set up your destination.', log.id)
            .run();
          continue;
        }
        const msg = buildMessage10m(log.injected_at, false);
        const sendRes = await sendTelegramMessage(cfg.bot_token, cfg.chat_id, msg);
        if (sendRes.ok) {
          await db.prepare(`UPDATE injection_logs SET status_10m_sent = 1, error_10m = NULL WHERE id = ?`).bind(log.id).run();
          count++;
        } else {
          await db.prepare(`UPDATE injection_logs SET error_10m = ? WHERE id = ?`).bind(sendRes.error || 'Failed to send Telegram reminder.', log.id).run();
        }
      }
    }

    if (due2h && due2h.length > 0) {
      for (const log of due2h) {
        const notifyTime = new Date(log.notify_2h_at).getTime();
        const minutesOverdue = (now.getTime() - notifyTime) / (60 * 1000);

        // Expire if 2h reminder is more than 2 hours overdue (>4h after dose)
        if (minutesOverdue > 120) {
          await db.prepare(`UPDATE injection_logs SET error_2h = ? WHERE id = ?`)
            .bind('Notification expired without delivery (overdue).', log.id)
            .run();
          continue;
        }

        const cfg = await getConfigForLog(log);
        if (!cfg || !cfg.bot_token || !cfg.chat_id) {
          await db.prepare(`UPDATE injection_logs SET error_2h = ? WHERE id = ?`)
            .bind('Telegram is not configured. Go to Settings to set up your destination.', log.id)
            .run();
          continue;
        }
        const msg = buildMessage2h(log.injected_at, false);
        const sendRes = await sendTelegramMessage(cfg.bot_token, cfg.chat_id, msg);
        if (sendRes.ok) {
          await db.prepare(`UPDATE injection_logs SET status_2h_sent = 1, error_2h = NULL WHERE id = ?`).bind(log.id).run();
          count++;
        } else {
          await db.prepare(`UPDATE injection_logs SET error_2h = ? WHERE id = ?`).bind(sendRes.error || 'Failed to send Telegram reminder.', log.id).run();
        }
      }
    }

    if (due3h && due3h.length > 0) {
      for (const log of due3h) {
        const notifyTime = new Date(log.notify_3h_at).getTime();
        const minutesOverdue = (now.getTime() - notifyTime) / (60 * 1000);

        // Expire if 3h reminder is more than 3 hours overdue (>6h after dose)
        if (minutesOverdue > 180) {
          await db.prepare(`UPDATE injection_logs SET error_3h = ? WHERE id = ?`)
            .bind('Notification expired without delivery (overdue).', log.id)
            .run();
          continue;
        }

        const cfg = await getConfigForLog(log);
        if (!cfg || !cfg.bot_token || !cfg.chat_id) {
          await db.prepare(`UPDATE injection_logs SET error_3h = ? WHERE id = ?`)
            .bind('Telegram is not configured. Go to Settings to set up your destination.', log.id)
            .run();
          continue;
        }
        const msg = buildMessage3h(log.injected_at, false);
        const sendRes = await sendTelegramMessage(cfg.bot_token, cfg.chat_id, msg);
        if (sendRes.ok) {
          await db.prepare(`UPDATE injection_logs SET status_3h_sent = 1, error_3h = NULL WHERE id = ?`).bind(log.id).run();
          count++;
        } else {
          await db.prepare(`UPDATE injection_logs SET error_3h = ? WHERE id = ?`).bind(sendRes.error || 'Failed to send Telegram reminder.', log.id).run();
        }
      }
    }

    return { dispatched: count };
  } catch (err) {
    console.error('dispatchDueNotifications error:', err);
    return { dispatched: 0, error: err.message };
  }
}
