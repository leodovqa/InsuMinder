import { sendWebPush } from './_webpush.js';

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
  try {
    await db.prepare(`ALTER TABLE injection_logs ADD COLUMN type TEXT DEFAULT 'bolus'`).run();
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
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  try {
    await db.prepare(`ALTER TABLE telegram_configs ADD COLUMN user_id INTEGER`).run();
  } catch (err) {
    void err;
  }

  try {
    await db.prepare(`ALTER TABLE telegram_configs ADD COLUMN is_active INTEGER DEFAULT 1`).run();
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

  // Basal reminders table
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS basal_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reminder_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      status_sent BOOLEAN DEFAULT 0,
      sent_at TIMESTAMP,
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, reminder_date)
    )`
  ).run();

  // Push subscriptions table
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
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
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'email'`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN locked_until TIMESTAMP`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en'`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN basal_time TEXT DEFAULT '20:00'`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'`).run();
  } catch (err) {
    void err;
  }
  try {
    await db.prepare(`ALTER TABLE users ADD COLUMN notification_preferences TEXT`).run();
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

export function buildTestMessage(lang = 'en', isLocal = false) {
  if (lang === 'he') {
    const prefix = isLocal ? "מאת InsuMinder (Local):" : "מאת InsuMinder:";
    return `${prefix}\nחיבור הטלגרם הצליח! תזכורות ההזרקה שלך פעילות.`;
  }
  if (lang === 'ru') {
    const prefix = isLocal ? "От InsuMinder (Local):" : "От InsuMinder:";
    return `${prefix}\nПодключение к Telegram успешно! Напоминания об инъекциях активны.`;
  }
  const prefix = isLocal ? "From InsuMinder (Local):" : "From InsuMinder:";
  return `${prefix}\nTelegram connection successful! Your injection reminders are active.`;
}

export function buildMessage10m(injectedAt, isLocal = false, lang = 'en') {
  const doseTime = formatDoseTime(injectedAt);
  if (lang === 'he') {
    const prefix = isLocal ? "🍽️ מאת InsuMinder (Local):" : "🍽️ מאת InsuMinder:";
    const doseLine = doseTime ? `\n💉 הזרקה נרשמה בשעה: ${doseTime}` : "";
    return `${prefix}\n⏰ תזכורת זמן ארוחה${doseLine}\n\nחלפו 10 דקות ממועד ההזרקה. כעת ניתן להתחיל לאכול!`;
  }
  if (lang === 'ru') {
    const prefix = isLocal ? "🍽️ От InsuMinder (Local):" : "🍽️ От InsuMinder:";
    const doseLine = doseTime ? `\n💉 Инъекция зафиксирована в: ${doseTime}` : "";
    return `${prefix}\n⏰ Напоминание о приёме пищи${doseLine}\n\nПрошло 10 минут с момента инъекции. Теперь можно приступить к еде!`;
  }
  const prefix = isLocal ? "🍽️ From InsuMinder (Local):" : "🍽️ From InsuMinder:";
  const doseLine = doseTime ? `\n💉 Dose logged at: ${doseTime}` : "";
  return `${prefix}\n⏰ Meal Time Reminder${doseLine}\n\n10 minutes have passed since your injection. You can now start your meal!`;
}

export function buildMessage2h(injectedAt, isLocal = false, lang = 'en') {
  const doseTime = formatDoseTime(injectedAt);
  if (lang === 'he') {
    const prefix = isLocal ? "🩸 מאת InsuMinder (Local):" : "🩸 מאת InsuMinder:";
    const doseLine = doseTime ? `\n💉 הזרקה נרשמה בשעה: ${doseTime}` : "";
    return `${prefix}\n⏰ בדיקת סוכר לאחר שעתיים${doseLine}\n\nנא לבדוק את רמת הסוכר לאחר שעתיים מההזרקה.`;
  }
  if (lang === 'ru') {
    const prefix = isLocal ? "🩸 От InsuMinder (Local):" : "🩸 От InsuMinder:";
    const doseLine = doseTime ? `\n💉 Инъекция зафиксирована в: ${doseTime}` : "";
    return `${prefix}\n⏰ Проверка уровня сахара через 2 часа${doseLine}\n\nПожалуйста, измерьте уровень сахара в крови через 2 часа после инъекции.`;
  }
  const prefix = isLocal ? "🩸 From InsuMinder (Local):" : "🩸 From InsuMinder:";
  const doseLine = doseTime ? `\n💉 Dose logged at: ${doseTime}` : "";
  return `${prefix}\n⏰ 2-Hour Glucose Check${doseLine}\n\nPlease go and check your Glucose level after 2 Hours.`;
}

export function buildMessage3h(injectedAt, isLocal = false, lang = 'en') {
  const doseTime = formatDoseTime(injectedAt);
  if (lang === 'he') {
    const prefix = isLocal ? "🎯 מאת InsuMinder (Local):" : "🎯 מאת InsuMinder:";
    const doseLine = doseTime ? `\n💉 הזרקה נרשמה בשעה: ${doseTime}` : "";
    return `${prefix}\n⏰ חלון הזרקה בטוח (3 שעות)${doseLine}\n\nחלפו 3 שעות ממועד ההזרקה. הגיע חלון בטוח להזרקה הבאה במידת הצורך.`;
  }
  if (lang === 'ru') {
    const prefix = isLocal ? "🎯 От InsuMinder (Local):" : "🎯 От InsuMinder:";
    const doseLine = doseTime ? `\n💉 Инъекция зафиксирована в: ${doseTime}` : "";
    return `${prefix}\n⏰ Безопасное окно для инъекции (3 часа)${doseLine}\n\nПрошло 3 часа с момента инъекции. Наступило безопасное окно для следующей дозы при необходимости.`;
  }
  const prefix = isLocal ? "🎯 From InsuMinder (Local):" : "🎯 From InsuMinder:";
  const doseLine = doseTime ? `\n💉 Dose logged at: ${doseTime}` : "";
  return `${prefix}\n⏰ 3-Hour Injection Eligibility${doseLine}\n\n3 hours have passed since your injection. Safe window reached for your next dose if needed.`;
}

export function getJerusalemDateAndTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    dateStr: `${m.year}-${m.month}-${m.day}`,
    timeStr: `${m.hour}:${m.minute}`
  };
}

export function buildMessageBasal(isLocal = false, lang = 'en') {
  if (lang === 'he') {
    const prefix = isLocal ? "🌙 מאת InsuMinder (Local):" : "🌙 מאת InsuMinder:";
    return `${prefix}\n⏰ תזכורת להזרקת אינסולין בזאלי\n\nנא לזכור להזריק ולתעד את מנת האינסולין הבזאלי היומית שלך.`;
  }
  if (lang === 'ru') {
    const prefix = isLocal ? "🌙 От InsuMinder (Local):" : "🌙 От InsuMinder:";
    return `${prefix}\n⏰ Напоминание о базальном инсулине\n\nПожалуйста, не забудьте ввести и зафиксировать ежедневную дозу базального инсулина.`;
  }
  const prefix = isLocal ? "🌙 From InsuMinder (Local):" : "🌙 From InsuMinder:";
  return `${prefix}\n⏰ Basal Injection Reminder\n\nPlease remember to take and log your daily basal insulin dose.`;
}

export function buildPushPayload(type, { injectedAt, lang = 'en' } = {}) {
  const doseTime = formatDoseTime(injectedAt);
  if (type === '10m') {
    if (lang === 'he') {
      const doseLine = doseTime ? `הזרקה נרשמה בשעה: ${doseTime}. ` : '';
      return {
        title: '🍽️ תזכורת זמן ארוחה',
        body: `${doseLine}חלפו 10 דקות ממועד ההזרקה. כעת ניתן להתחיל לאכול!`,
        tag: 'insuminder-10m',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    if (lang === 'ru') {
      const doseLine = doseTime ? `Инъекция зафиксирована в: ${doseTime}. ` : '';
      return {
        title: '🍽️ Напоминание о приёме пищи',
        body: `${doseLine}Прошло 10 минут с момента инъекции. Теперь можно приступить к еде!`,
        tag: 'insuminder-10m',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    const doseLine = doseTime ? `Dose logged at: ${doseTime}. ` : '';
    return {
      title: '🍽️ Meal Time Reminder',
      body: `${doseLine}10 minutes have passed since your injection. You can now start your meal!`,
      tag: 'insuminder-10m',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/' }
    };
  }

  if (type === '2h') {
    if (lang === 'he') {
      const doseLine = doseTime ? `הזרקה נרשמה בשעה: ${doseTime}. ` : '';
      return {
        title: '🩸 בדיקת סוכר לאחר שעתיים',
        body: `${doseLine}נא לבדוק את רמת הסוכר לאחר שעתיים מההזרקה.`,
        tag: 'insuminder-2h',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    if (lang === 'ru') {
      const doseLine = doseTime ? `Инъекция зафиксирована в: ${doseTime}. ` : '';
      return {
        title: '🩸 Проверка уровня сахара',
        body: `${doseLine}Пожалуйста, измерьте уровень сахара в крови через 2 часа после инъекции.`,
        tag: 'insuminder-2h',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    const doseLine = doseTime ? `Dose logged at: ${doseTime}. ` : '';
    return {
      title: '🩸 2-Hour Glucose Check',
      body: `${doseLine}Please go and check your Glucose level after 2 Hours.`,
      tag: 'insuminder-2h',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/' }
    };
  }

  if (type === '3h') {
    if (lang === 'he') {
      const doseLine = doseTime ? `הזרקה נרשמה בשעה: ${doseTime}. ` : '';
      return {
        title: '🎯 חלון הזרקה בטוח (3 שעות)',
        body: `${doseLine}חלפו 3 שעות ממועד ההזרקה. הגיע חלון בטוח להזרקה הבאה במידת הצורך.`,
        tag: 'insuminder-3h',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    if (lang === 'ru') {
      const doseLine = doseTime ? `Инъекция зафиксирована в: ${doseTime}. ` : '';
      return {
        title: '🎯 Безопасное окно для инъекции (3 часа)',
        body: `${doseLine}Прошло 3 часа с момента инъекции. Наступило безопасное окно для следующей дозы при необходимости.`,
        tag: 'insuminder-3h',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    const doseLine = doseTime ? `Dose logged at: ${doseTime}. ` : '';
    return {
      title: '🎯 3-Hour Injection Eligibility',
      body: `${doseLine}3 hours have passed since your injection. Safe window reached for your next dose if needed.`,
      tag: 'insuminder-3h',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/' }
    };
  }

  // Basal
  if (lang === 'he') {
    return {
      title: '🌙 תזכורת להזרקת אינסולין בזאלי',
      body: 'נא לזכור להזריק ולתעד את מנת האינסולין הבזאלי היומית שלך.',
      tag: 'insuminder-basal',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/' }
    };
  }
  if (lang === 'ru') {
    return {
      title: '🌙 Напоминание о базальном инсулине',
      body: 'Пожалуйста, не забудьте ввести и зафиксировать ежедневную дозу базального инсулина.',
      tag: 'insuminder-basal',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/' }
    };
  }
  return {
    title: '🌙 Basal Injection Reminder',
    body: 'Please remember to take and log your daily basal insulin dose.',
    tag: 'insuminder-basal',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: { url: '/' }
  };
}

async function dispatchMultiChannelReminderEdge({
  db,
  type,
  injectedAt,
  lang = 'en',
  telegramConfig,
  pushSubs,
  userPrefs,
  isLocal = false
}) {
  const isBasal = type === 'basal';
  const prefKey = isBasal ? 'basal' : (type === '10m' ? 'rem10m' : (type === '2h' ? 'rem2h' : 'rem3h'));

  if (userPrefs?.personal?.[prefKey] === false) {
    return { ok: false, disabled: true, error: 'Disabled in notification settings.' };
  }

  const isTelegramConfigured = Boolean(
    telegramConfig &&
    telegramConfig.is_active !== 0 &&
    telegramConfig.is_active !== false &&
    telegramConfig.bot_token &&
    telegramConfig.chat_id &&
    telegramConfig.bot_token.trim() &&
    telegramConfig.chat_id.trim()
  );
  const isPushConfigured = Boolean(pushSubs && pushSubs.length > 0);

  const telegramEnabled = userPrefs?.personal?.telegram !== false;
  const pushEnabled = userPrefs?.personal?.webPush !== false;

  const shouldSendTelegram = isTelegramConfigured && telegramEnabled;
  const shouldSendPush = isPushConfigured && pushEnabled;

  if (!shouldSendTelegram && !shouldSendPush) {
    if (telegramEnabled === false) {
      return { ok: false, disabled: true, error: 'Disabled in notification settings.' };
    }
    if (!isTelegramConfigured && !isPushConfigured) {
      return { ok: false, unconfigured: true, error: 'Telegram is not configured. Go to Settings to set up your destination.' };
    }
    return { ok: false, disabled: true, error: 'Disabled in notification settings.' };
  }

  let successCount = 0;
  const errors = [];

  if (shouldSendTelegram) {
    let msg = '';
    if (type === '10m') msg = buildMessage10m(injectedAt, isLocal, lang);
    else if (type === '2h') msg = buildMessage2h(injectedAt, isLocal, lang);
    else if (type === '3h') msg = buildMessage3h(injectedAt, isLocal, lang);
    else if (type === 'basal') msg = buildMessageBasal(isLocal, lang);

    const tgRes = await sendTelegramMessage(telegramConfig.bot_token.trim(), telegramConfig.chat_id.trim(), msg);
    if (tgRes.ok) {
      successCount++;
    } else {
      errors.push(`Telegram: ${tgRes.error}`);
    }
  }

  if (shouldSendPush) {
    const payload = buildPushPayload(type, { injectedAt, lang });
    for (const sub of pushSubs) {
      const pRes = await sendWebPush(sub, payload);
      if (pRes.ok) {
        successCount++;
      } else if (pRes.expired) {
        await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(sub.endpoint).run();
      } else {
        errors.push(`Push: ${pRes.error}`);
      }
    }
  }

  if (successCount > 0) {
    return { ok: true };
  }
  return { ok: false, error: errors.join('; ') || 'Failed to dispatch notification.' };
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
      `SELECT * FROM injection_logs WHERE (type IS NULL OR type = 'bolus') AND status_10m_sent = 0 AND notify_10m_at <= ? AND notify_10m_at >= ? ORDER BY notify_10m_at ASC LIMIT 5`
    ).bind(nowIso, cutoff24hAgo).all();

    const { results: due2h } = await db.prepare(
      `SELECT * FROM injection_logs WHERE (type IS NULL OR type = 'bolus') AND status_2h_sent = 0 AND notify_2h_at <= ? AND notify_2h_at >= ? ORDER BY notify_2h_at ASC LIMIT 5`
    ).bind(nowIso, cutoff24hAgo).all();

    const { results: due3h } = await db.prepare(
      `SELECT * FROM injection_logs WHERE (type IS NULL OR type = 'bolus') AND status_3h_sent = 0 AND notify_3h_at <= ? AND notify_3h_at >= ? ORDER BY notify_3h_at ASC LIMIT 5`
    ).bind(nowIso, cutoff24hAgo).all();

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
        return null;
      }
      return null;
    };

    const getLanguageForLog = async (log) => {
      if (log.user_id) {
        const userRow = await db.prepare(
          `SELECT language FROM users WHERE id = ? LIMIT 1`
        ).bind(log.user_id).first();
        if (userRow && userRow.language) {
          return userRow.language;
        }
      }
      return 'en';
    };

    const getPreferencesForLog = async (log) => {
      if (log.user_id) {
        const userRow = await db.prepare(
          `SELECT notification_preferences FROM users WHERE id = ? LIMIT 1`
        ).bind(log.user_id).first();
        if (userRow && userRow.notification_preferences) {
          try {
            return JSON.parse(userRow.notification_preferences);
          } catch {
            return null;
          }
        }
      }
      return null;
    };

    const getPushSubsForLog = async (log) => {
      if (log.user_id) {
        const { results } = await db.prepare(
          `SELECT * FROM push_subscriptions WHERE user_id = ?`
        ).bind(log.user_id).all();
        return results || [];
      }
      return [];
    };

    let count = 0;
    const unconfiguredError = 'Telegram is not configured. Go to Settings to set up your destination.';

    if (due10m && due10m.length > 0) {
      for (const log of due10m) {
        const notifyTime = new Date(log.notify_10m_at).getTime();
        const minutesOverdue = (now.getTime() - notifyTime) / (60 * 1000);

        if (minutesOverdue > 45) {
          await db.prepare(`UPDATE injection_logs SET error_10m = ? WHERE id = ?`)
            .bind('Notification expired without delivery (overdue).', log.id)
            .run();
          continue;
        }

        const prefs = await getPreferencesForLog(log);
        const cfg = await getConfigForLog(log);
        const pushSubs = await getPushSubsForLog(log);
        const lang = await getLanguageForLog(log);

        const res10m = await dispatchMultiChannelReminderEdge({
          db,
          type: '10m',
          injectedAt: log.injected_at,
          lang,
          telegramConfig: cfg,
          pushSubs,
          userPrefs: prefs,
          isLocal: false
        });

        if (res10m.ok) {
          await db.prepare(`UPDATE injection_logs SET status_10m_sent = 1, error_10m = NULL WHERE id = ?`).bind(log.id).run();
          count++;
        } else if (res10m.disabled) {
          await db.prepare(`UPDATE injection_logs SET error_10m = ? WHERE id = ?`).bind('Disabled in notification settings.', log.id).run();
        } else if (res10m.unconfigured) {
          await db.prepare(`UPDATE injection_logs SET error_10m = ? WHERE id = ?`).bind(unconfiguredError, log.id).run();
        } else {
          await db.prepare(`UPDATE injection_logs SET error_10m = ? WHERE id = ?`).bind(res10m.error, log.id).run();
        }
      }
    }

    if (due2h && due2h.length > 0) {
      for (const log of due2h) {
        const notifyTime = new Date(log.notify_2h_at).getTime();
        const minutesOverdue = (now.getTime() - notifyTime) / (60 * 1000);

        if (minutesOverdue > 120) {
          await db.prepare(`UPDATE injection_logs SET error_2h = ? WHERE id = ?`)
            .bind('Notification expired without delivery (overdue).', log.id)
            .run();
          continue;
        }

        const prefs = await getPreferencesForLog(log);
        const cfg = await getConfigForLog(log);
        const pushSubs = await getPushSubsForLog(log);
        const lang = await getLanguageForLog(log);

        const res2h = await dispatchMultiChannelReminderEdge({
          db,
          type: '2h',
          injectedAt: log.injected_at,
          lang,
          telegramConfig: cfg,
          pushSubs,
          userPrefs: prefs,
          isLocal: false
        });

        if (res2h.ok) {
          await db.prepare(`UPDATE injection_logs SET status_2h_sent = 1, error_2h = NULL WHERE id = ?`).bind(log.id).run();
          count++;
        } else if (res2h.disabled) {
          await db.prepare(`UPDATE injection_logs SET error_2h = ? WHERE id = ?`).bind('Disabled in notification settings.', log.id).run();
        } else if (res2h.unconfigured) {
          await db.prepare(`UPDATE injection_logs SET error_2h = ? WHERE id = ?`).bind(unconfiguredError, log.id).run();
        } else {
          await db.prepare(`UPDATE injection_logs SET error_2h = ? WHERE id = ?`).bind(res2h.error, log.id).run();
        }
      }
    }

    if (due3h && due3h.length > 0) {
      for (const log of due3h) {
        const notifyTime = new Date(log.notify_3h_at).getTime();
        const minutesOverdue = (now.getTime() - notifyTime) / (60 * 1000);

        if (minutesOverdue > 180) {
          await db.prepare(`UPDATE injection_logs SET error_3h = ? WHERE id = ?`)
            .bind('Notification expired without delivery (overdue).', log.id)
            .run();
          continue;
        }

        const prefs = await getPreferencesForLog(log);
        const cfg = await getConfigForLog(log);
        const pushSubs = await getPushSubsForLog(log);
        const lang = await getLanguageForLog(log);

        const res3h = await dispatchMultiChannelReminderEdge({
          db,
          type: '3h',
          injectedAt: log.injected_at,
          lang,
          telegramConfig: cfg,
          pushSubs,
          userPrefs: prefs,
          isLocal: false
        });

        if (res3h.ok) {
          await db.prepare(`UPDATE injection_logs SET status_3h_sent = 1, error_3h = NULL WHERE id = ?`).bind(log.id).run();
          count++;
        } else if (res3h.disabled) {
          await db.prepare(`UPDATE injection_logs SET error_3h = ? WHERE id = ?`).bind('Disabled in notification settings.', log.id).run();
        } else if (res3h.unconfigured) {
          await db.prepare(`UPDATE injection_logs SET error_3h = ? WHERE id = ?`).bind(unconfiguredError, log.id).run();
        } else {
          await db.prepare(`UPDATE injection_logs SET error_3h = ? WHERE id = ?`).bind(res3h.error, log.id).run();
        }
      }
    }

    // Process pending due basal reminders (1 reminder per day if not injected yet)
    try {
      const { dateStr: jerusalemDate, timeStr: jerusalemTime } = getJerusalemDateAndTime(now);
      const { results: pendingBasalUsers } = await db.prepare(
        `SELECT u.id, u.email, u.language, u.notification_preferences, COALESCE(u.basal_time, '20:00') as basal_time
         FROM users u
         WHERE COALESCE(u.basal_time, '20:00') <= ?
         AND NOT EXISTS (
           SELECT 1 FROM basal_reminders r
           WHERE r.user_id = u.id AND r.reminder_date = ?
         )`
      ).bind(jerusalemTime, jerusalemDate).all();

      if (pendingBasalUsers && pendingBasalUsers.length > 0) {
        for (const pendingUser of pendingBasalUsers) {
          let pendingUserPrefs = null;
          if (pendingUser.notification_preferences) {
            try {
              pendingUserPrefs = JSON.parse(pendingUser.notification_preferences);
            } catch {
              pendingUserPrefs = null;
            }
          }
          if (pendingUserPrefs?.personal?.basal === false) {
            await db.prepare(
              `INSERT INTO basal_reminders (user_id, reminder_date, scheduled_time, status_sent, sent_at, error)
               VALUES (?, ?, ?, 0, NULL, 'Disabled in notification settings.')
               ON CONFLICT(user_id, reminder_date) DO NOTHING`
            ).bind(pendingUser.id, jerusalemDate, pendingUser.basal_time).run();
            continue;
          }
          // Check if user already logged basal injection today
          const { results: recentBasalLogs } = await db.prepare(
            `SELECT id, injected_at FROM injection_logs WHERE user_id = ? AND type = 'basal' ORDER BY injected_at DESC LIMIT 10`
          ).bind(pendingUser.id).all();

          const alreadyInjectedToday = (recentBasalLogs || []).some(l => {
            try {
              const { dateStr } = getJerusalemDateAndTime(new Date(l.injected_at));
              return dateStr === jerusalemDate;
            } catch {
              return false;
            }
          });

          if (alreadyInjectedToday) {
            await db.prepare(
              `INSERT INTO basal_reminders (user_id, reminder_date, scheduled_time, status_sent, sent_at, error)
               VALUES (?, ?, ?, 0, NULL, 'Already injected')
               ON CONFLICT(user_id, reminder_date) DO NOTHING`
            ).bind(pendingUser.id, jerusalemDate, pendingUser.basal_time).run();
            continue;
          }

          const cfg = await getConfigForLog({ user_id: pendingUser.id });
          const { results: pushSubs } = await db.prepare(
            `SELECT * FROM push_subscriptions WHERE user_id = ?`
          ).bind(pendingUser.id).all();

          const lang = pendingUser.language || 'en';
          const resBasal = await dispatchMultiChannelReminderEdge({
            db,
            type: 'basal',
            lang,
            telegramConfig: cfg,
            pushSubs: pushSubs || [],
            userPrefs: pendingUserPrefs,
            isLocal: false
          });

          if (resBasal.ok) {
            await db.prepare(
              `INSERT INTO basal_reminders (user_id, reminder_date, scheduled_time, status_sent, sent_at, error)
               VALUES (?, ?, ?, 1, ?, NULL)
               ON CONFLICT(user_id, reminder_date) DO UPDATE SET status_sent = 1, sent_at = excluded.sent_at, error = NULL`
            ).bind(pendingUser.id, jerusalemDate, pendingUser.basal_time, nowIso).run();
            count++;
          } else if (resBasal.disabled) {
            await db.prepare(
              `INSERT INTO basal_reminders (user_id, reminder_date, scheduled_time, status_sent, sent_at, error)
               VALUES (?, ?, ?, 0, NULL, 'Disabled in notification settings.')
               ON CONFLICT(user_id, reminder_date) DO NOTHING`
            ).bind(pendingUser.id, jerusalemDate, pendingUser.basal_time).run();
          } else if (resBasal.unconfigured) {
            await db.prepare(
              `INSERT INTO basal_reminders (user_id, reminder_date, scheduled_time, status_sent, sent_at, error)
               VALUES (?, ?, ?, 0, NULL, ?)
               ON CONFLICT(user_id, reminder_date) DO UPDATE SET error = excluded.error`
            ).bind(pendingUser.id, jerusalemDate, pendingUser.basal_time, unconfiguredError).run();
          } else {
            await db.prepare(
              `INSERT INTO basal_reminders (user_id, reminder_date, scheduled_time, status_sent, sent_at, error)
               VALUES (?, ?, ?, 0, NULL, ?)
               ON CONFLICT(user_id, reminder_date) DO UPDATE SET error = excluded.error`
            ).bind(pendingUser.id, jerusalemDate, pendingUser.basal_time, resBasal.error).run();
          }
        }
      }
    } catch (basalErr) {
      console.error('Error dispatching basal reminders:', basalErr);
    }

    return { dispatched: count };
  } catch (err) {
    console.error('dispatchDueNotifications error:', err);
    return { dispatched: 0, error: err.message };
  }
}
