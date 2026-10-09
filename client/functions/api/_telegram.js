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

  if (initialResult.error && /chat not found/i.test(initialResult.error)) {
    if (cleanChatId.startsWith('-') && !cleanChatId.startsWith('-100')) {
      const altChatId = `-100${cleanChatId.slice(1)}`;
      const altResult = await postToTelegramApi(cleanToken, altChatId, text);
      if (altResult.ok) {
        return altResult;
      }
    } else if (!cleanChatId.startsWith('-') && cleanChatId.length >= 9) {
      const altChatId = `-100${cleanChatId}`;
      const altResult = await postToTelegramApi(cleanToken, altChatId, text);
      if (altResult.ok) {
        return altResult;
      }
    }
  }

  return initialResult;
}

export async function ensureTablesExist(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS injection_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      injected_at TIMESTAMP NOT NULL,
      notify_2h_at TIMESTAMP NOT NULL,
      notify_3h_at TIMESTAMP NOT NULL,
      status_2h_sent BOOLEAN DEFAULT 0,
      status_3h_sent BOOLEAN DEFAULT 0
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS telegram_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      bot_token TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

export async function dispatchDueNotifications(db) {
  if (!db) return { dispatched: 0 };
  try {
    await ensureTablesExist(db);

    const nowIso = new Date().toISOString();

    const { results: due2h } = await db.prepare(
      `SELECT * FROM injection_logs WHERE status_2h_sent = 0 AND notify_2h_at <= ? ORDER BY notify_2h_at ASC LIMIT 5`
    ).bind(nowIso).all();

    const { results: due3h } = await db.prepare(
      `SELECT * FROM injection_logs WHERE status_3h_sent = 0 AND notify_3h_at <= ? ORDER BY notify_3h_at ASC LIMIT 5`
    ).bind(nowIso).all();

    if ((!due2h || due2h.length === 0) && (!due3h || due3h.length === 0)) {
      return { dispatched: 0 };
    }

    const defaultCfg = await db.prepare(
      `SELECT * FROM telegram_configs WHERE is_default = 1 LIMIT 1`
    ).first();

    if (!defaultCfg || !defaultCfg.bot_token || !defaultCfg.chat_id) {
      return { dispatched: 0, reason: 'No default telegram config found.' };
    }

    let count = 0;
    if (due2h && due2h.length > 0) {
      for (const log of due2h) {
        const msg = "From InsuMinder:\nPlease go and check your Glucose level after 2 Hours.";
        const sendRes = await sendTelegramMessage(defaultCfg.bot_token, defaultCfg.chat_id, msg);
        if (sendRes.ok) {
          await db.prepare(`UPDATE injection_logs SET status_2h_sent = 1 WHERE id = ?`).bind(log.id).run();
          count++;
        }
      }
    }

    if (due3h && due3h.length > 0) {
      for (const log of due3h) {
        const msg = "From InsuMinder:\nPlease go and check your Glucose level after 3 Hours.";
        const sendRes = await sendTelegramMessage(defaultCfg.bot_token, defaultCfg.chat_id, msg);
        if (sendRes.ok) {
          await db.prepare(`UPDATE injection_logs SET status_3h_sent = 1 WHERE id = ?`).bind(log.id).run();
          count++;
        }
      }
    }

    return { dispatched: count };
  } catch (err) {
    console.error('Error dispatching notifications:', err);
    return { dispatched: 0, error: err.message };
  }
}

