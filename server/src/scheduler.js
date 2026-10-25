const db = require('./db');
const { sendTelegramMessage } = require('./telegram');
const webpush = require('./webpush');
const fcm = require('./fcm');

let schedulerInterval = null;
let isChecking = false;

function formatDoseTime(isoString) {
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

function buildTestMessage(lang = 'en', isLocal = true) {
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

function buildMessage10m(injectedAt, isLocal = true, lang = 'en') {
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

function buildMessage2h(injectedAt, isLocal = true, lang = 'en') {
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
  return `${prefix}\n⏰ 2-Hour Glucose Check${doseLine}\n\nPlease check your blood glucose level 2 hours after injection.`;
}

function buildMessage3h(injectedAt, isLocal = true, lang = 'en') {
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

function buildMessageBasal(isLocal = true, lang = 'en') {
  if (lang === 'he') {
    const prefix = isLocal ? "🌙 מאת InsuMinder (Local):" : "🌙 מאת InsuMinder:";
    return `${prefix}\n⏰ תזכורת להזרקת אינסולין בזאלי\n\nנא לזכור להזריק ולתעד את מנת האינסולין הבזאלי היומית שלך.\n\n📱 פתח את InsuMinder:\nhttps://insuminder.pages.dev/?action=basal`;
  }
  if (lang === 'ru') {
    const prefix = isLocal ? "🌙 От InsuMinder (Local):" : "🌙 От InsuMinder:";
    return `${prefix}\n⏰ Напоминание о базальном инсулине\n\nПожалуйста, не забудьте ввести и зафиксировать ежедневную дозу базального инсулина.\n\n📱 Открыть InsuMinder:\nhttps://insuminder.pages.dev/?action=basal`;
  }
  const prefix = isLocal ? "🌙 From InsuMinder (Local):" : "🌙 From InsuMinder:";
  return `${prefix}\n⏰ Basal Injection Reminder\n\nPlease remember to take and log your daily basal insulin dose.\n\n📱 Open InsuMinder:\nhttps://insuminder.pages.dev/?action=basal`;
}

function getJerusalemDateAndTime(date = new Date()) {
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

function buildPushPayload(type, { injectedAt, lang = 'en' } = {}) {
  const doseTime = formatDoseTime(injectedAt);
  if (type === '10m') {
    if (lang === 'he') {
      const doseLine = doseTime ? `הזרקה נרשמה בשעה: ${doseTime} 💉\n\n` : '';
      return {
        title: '🍽️ תזכורת זמן ארוחה ⏰',
        body: `${doseLine}חלפו 10 דקות ממועד ההזרקה. כעת ניתן להתחיל לאכול!`,
        tag: 'insuminder-10m',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    if (lang === 'ru') {
      const doseLine = doseTime ? `Инъекция зафиксирована в: ${doseTime} 💉\n\n` : '';
      return {
        title: '🍽️ Напоминание о приёме пищи ⏰',
        body: `${doseLine}Прошло 10 минут с момента инъекции. Теперь можно приступить к еде!`,
        tag: 'insuminder-10m',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    const doseLine = doseTime ? `Dose logged at: ${doseTime} 💉\n\n` : '';
    return {
      title: '🍽️ Meal Time Reminder ⏰',
      body: `${doseLine}10 minutes have passed since your injection. You can now start your meal!`,
      tag: 'insuminder-10m',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/' }
    };
  }

  if (type === '2h') {
    if (lang === 'he') {
      const doseLine = doseTime ? `הזרקה נרשמה בשעה: ${doseTime} 💉\n\n` : '';
      return {
        title: '🩸 בדיקת סוכר לאחר שעתיים ⏰',
        body: `${doseLine}נא לבדוק את רמת הסוכר לאחר שעתיים מההזרקה.`,
        tag: 'insuminder-2h',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    if (lang === 'ru') {
      const doseLine = doseTime ? `Инъекция зафиксирована в: ${doseTime} 💉\n\n` : '';
      return {
        title: '🩸 Проверка сахара через 2 часа ⏰',
        body: `${doseLine}Пожалуйста, измерьте уровень сахара в крови через 2 часа после инъекции.`,
        tag: 'insuminder-2h',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    const doseLine = doseTime ? `Dose logged at: ${doseTime} 💉\n\n` : '';
    return {
      title: '🩸 2-Hour Glucose Check ⏰',
      body: `${doseLine}Please check your blood glucose level 2 hours after injection.`,
      tag: 'insuminder-2h',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/' }
    };
  }

  if (type === '3h') {
    if (lang === 'he') {
      const doseLine = doseTime ? `הזרקה נרשמה בשעה: ${doseTime} 💉\n\n` : '';
      return {
        title: '🎯 חלון הזרקה בטוח (3 שעות) ⏰',
        body: `${doseLine}חלפו 3 שעות ממועד ההזרקה. הגיע חלון בטוח להזרקה הבאה במידת הצורך.`,
        tag: 'insuminder-3h',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    if (lang === 'ru') {
      const doseLine = doseTime ? `Инъекция зафиксирована в: ${doseTime} 💉\n\n` : '';
      return {
        title: '🎯 Безопасное окно для инъекции (3 часа) ⏰',
        body: `${doseLine}Прошло 3 часа с момента инъекции. Наступило безопасное окно для следующей дозы при необходимости.`,
        tag: 'insuminder-3h',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: { url: '/' }
      };
    }
    const doseLine = doseTime ? `Dose logged at: ${doseTime} 💉\n\n` : '';
    return {
      title: '🎯 3-Hour Safe Window ⏰',
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
      title: '🌙 תזכורת להזרקת אינסולין בזאלי ⏰',
      body: 'נא לזכור להזריק ולתעד את מנת האינסולין הבזאלי היומית שלך.',
      tag: 'insuminder-basal',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/?action=basal' }
    };
  }
  if (lang === 'ru') {
    return {
      title: '🌙 Напоминание о базальном инсулине ⏰',
      body: 'Пожалуйста, не забудьте ввести и зафиксировать ежедневную дозу базального инсулина.',
      tag: 'insuminder-basal',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/?action=basal' }
    };
  }
  return {
    title: '🌙 Basal Injection Reminder ⏰',
    body: 'Please remember to take and log your daily basal insulin dose.',
    tag: 'insuminder-basal',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: { url: '/?action=basal' }
  };
}

async function dispatchMultiChannelReminder({
  type,
  injectedAt,
  lang = 'en',
  telegramConfig,
  pushSubs,
  userPrefs,
  isLocal = true
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
      let pRes;
      if (sub.endpoint && sub.endpoint.startsWith('fcm:')) {
        const token = sub.endpoint.slice(4);
        const fRes = await fcm.sendFcmNotification(token, {
          reminderId: `bolus-${type}`,
          title: payload.title,
          body: payload.body,
          targetUrl: payload.data?.url || '/'
        });
        pRes = { ok: fRes.success, expired: fRes.expired, error: fRes.error };
      } else {
        pRes = await webpush.sendWebPush(sub, payload);
      }

      if (pRes.ok) {
        successCount++;
      } else if (pRes.expired) {
        console.log(`[Scheduler] Push subscription expired (${sub.endpoint.slice(0, 30)}...); pruning.`);
        await new Promise((resolve) => db.deletePushSubscription(sub.endpoint, () => resolve()));
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

const MESSAGE_10M = buildMessage10m(null, true);
const MESSAGE_2H = buildMessage2h(null, true);
const MESSAGE_3H = buildMessage3h(null, true);

/**
 * Check for due notifications and dispatch them to Telegram and Web Push
 */
async function checkAndDispatchNotifications() {
  if (isChecking) return;
  isChecking = true;

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // Expire ancient notifications older than 24h so the user is not flooded on new configuration
    const cutoff24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    await new Promise((resolve) => {
      db.expireAncientNotifications(cutoff24hAgo, () => resolve());
    });

    // Fetch pending due injection notifications
    const dueLogs = await new Promise((resolve, reject) => {
      db.getDueNotifications((err, rows) => (err ? reject(err) : resolve(rows || [])));
    });

    const unconfiguredError = 'Telegram is not configured. Go to Settings to set up your destination.';

    // 1. Process pending due bolus injection notifications
    if (dueLogs && dueLogs.length > 0) {
      for (const log of dueLogs) {
        // Find the user's specific Telegram config (never fall back to other users when user_id is set)
        const activeConfig = await new Promise((resolve) => {
          if (log.user_id) {
            db.getDefaultTelegramConfig(log.user_id, (err, cfg) => {
              resolve((!err && cfg) ? cfg : null);
            });
          } else {
            db.getDefaultTelegramConfig((err, cfg) => resolve((!err && cfg) ? cfg : null));
          }
        });

        // Fetch user's push subscriptions
        const pushSubs = await new Promise((resolve) => {
          if (log.user_id) {
            db.getPushSubscriptions(log.user_id, (err, rows) => resolve(rows || []));
          } else {
            resolve([]);
          }
        });

        const userInfo = await new Promise((resolve) => {
          if (log.user_id) {
            db.getUserById(log.user_id, (err, user) => {
              resolve((!err && user) ? user : null);
            });
          } else {
            resolve(null);
          }
        });

        const userLang = userInfo?.language || 'en';
        let userPrefs = null;
        if (userInfo && userInfo.notification_preferences) {
          try {
            userPrefs = typeof userInfo.notification_preferences === 'object'
              ? userInfo.notification_preferences
              : JSON.parse(userInfo.notification_preferences);
          } catch {
            userPrefs = null;
          }
        }

        // 10-minute meal notification
        if (!log.status_10m_sent && log.notify_10m_at <= nowIso) {
          const notifyTime = new Date(log.notify_10m_at).getTime();
          const minutesOverdue = (now.getTime() - notifyTime) / (60 * 1000);

          // If 10m reminder is more than 45 minutes overdue, expire it to prevent backlog flooding
          if (minutesOverdue > 45) {
            console.log(`[Scheduler] 10m reminder for #${log.id} is ${Math.round(minutesOverdue)}m overdue. Expiring without sending.`);
            await new Promise((resolve) => db.recordNotificationError(log.id, '10m', 'Notification expired without delivery (overdue).', resolve));
          } else {
            console.log(`[Scheduler] Dispatching 10m meal reminder for injection #${log.id}...`);
            const res10m = await dispatchMultiChannelReminder({
              type: '10m',
              injectedAt: log.injected_at,
              lang: userLang,
              telegramConfig: activeConfig,
              pushSubs,
              userPrefs,
              isLocal: true
            });

            if (res10m.ok) {
              console.log(`[Scheduler] 10m meal reminder sent successfully for #${log.id}`);
              await new Promise((resolve) => db.markNotificationSent(log.id, '10m', resolve));
            } else if (res10m.disabled) {
              await new Promise((resolve) => db.recordNotificationError(log.id, '10m', 'Disabled in notification settings.', resolve));
            } else if (res10m.unconfigured) {
              await new Promise((resolve) => db.recordNotificationError(log.id, '10m', unconfiguredError, resolve));
            } else {
              console.error(`[Scheduler] Failed to send 10m meal reminder for #${log.id}:`, res10m.error);
              await new Promise((resolve) => db.recordNotificationError(log.id, '10m', res10m.error, resolve));
            }
          }
        }

        // 2-hour notification
        if (!log.status_2h_sent && log.notify_2h_at <= nowIso) {
          const notifyTime = new Date(log.notify_2h_at).getTime();
          const minutesOverdue = (now.getTime() - notifyTime) / (60 * 1000);

          // If 2h reminder is more than 2 hours overdue (>4h after dose), expire it
          if (minutesOverdue > 120) {
            console.log(`[Scheduler] 2h reminder for #${log.id} is ${Math.round(minutesOverdue)}m overdue. Expiring without sending.`);
            await new Promise((resolve) => db.recordNotificationError(log.id, '2h', 'Notification expired without delivery (overdue).', resolve));
          } else {
            console.log(`[Scheduler] Dispatching 2h reminder for injection #${log.id}...`);
            const res2h = await dispatchMultiChannelReminder({
              type: '2h',
              injectedAt: log.injected_at,
              lang: userLang,
              telegramConfig: activeConfig,
              pushSubs,
              userPrefs,
              isLocal: true
            });

            if (res2h.ok) {
              console.log(`[Scheduler] 2h reminder sent successfully for #${log.id}`);
              await new Promise((resolve) => db.markNotificationSent(log.id, '2h', resolve));
            } else if (res2h.disabled) {
              await new Promise((resolve) => db.recordNotificationError(log.id, '2h', 'Disabled in notification settings.', resolve));
            } else if (res2h.unconfigured) {
              await new Promise((resolve) => db.recordNotificationError(log.id, '2h', unconfiguredError, resolve));
            } else {
              console.error(`[Scheduler] Failed to send 2h reminder for #${log.id}:`, res2h.error);
              await new Promise((resolve) => db.recordNotificationError(log.id, '2h', res2h.error, resolve));
            }
          }
        }

        // 3-hour notification
        if (!log.status_3h_sent && log.notify_3h_at <= nowIso) {
          const notifyTime = new Date(log.notify_3h_at).getTime();
          const minutesOverdue = (now.getTime() - notifyTime) / (60 * 1000);

          // If 3h reminder is more than 3 hours overdue (>6h after dose), expire it
          if (minutesOverdue > 180) {
            console.log(`[Scheduler] 3h reminder for #${log.id} is ${Math.round(minutesOverdue)}m overdue. Expiring without sending.`);
            await new Promise((resolve) => db.recordNotificationError(log.id, '3h', 'Notification expired without delivery (overdue).', resolve));
          } else {
            console.log(`[Scheduler] Dispatching 3h reminder for injection #${log.id}...`);
            const res3h = await dispatchMultiChannelReminder({
              type: '3h',
              injectedAt: log.injected_at,
              lang: userLang,
              telegramConfig: activeConfig,
              pushSubs,
              userPrefs,
              isLocal: true
            });

            if (res3h.ok) {
              console.log(`[Scheduler] 3h reminder sent successfully for #${log.id}`);
              await new Promise((resolve) => db.markNotificationSent(log.id, '3h', resolve));
            } else if (res3h.disabled) {
              await new Promise((resolve) => db.recordNotificationError(log.id, '3h', 'Disabled in notification settings.', resolve));
            } else if (res3h.unconfigured) {
              await new Promise((resolve) => db.recordNotificationError(log.id, '3h', unconfiguredError, resolve));
            } else {
              console.error(`[Scheduler] Failed to send 3h reminder for #${log.id}:`, res3h.error);
              await new Promise((resolve) => db.recordNotificationError(log.id, '3h', res3h.error, resolve));
            }
          }
        }
      }
    }

    // 2. Process pending due basal reminders (1 reminder per day if not injected yet)
    const { dateStr: jerusalemDate, timeStr: jerusalemTime } = getJerusalemDateAndTime(now);
    const pendingBasalUsers = await new Promise((resolve, reject) => {
      db.getUsersPendingBasalReminder(jerusalemTime, jerusalemDate, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    if (pendingBasalUsers && pendingBasalUsers.length > 0) {
      for (const pendingUser of pendingBasalUsers) {
        const activeConfig = await new Promise((resolve) => {
          db.getDefaultTelegramConfig(pendingUser.id, (err, cfg) => {
            resolve((!err && cfg) ? cfg : null);
          });
        });

        const pushSubs = await new Promise((resolve) => {
          db.getPushSubscriptions(pendingUser.id, (err, rows) => resolve(rows || []));
        });

        let pendingUserPrefs = null;
        if (pendingUser && pendingUser.notification_preferences) {
          try {
            pendingUserPrefs = typeof pendingUser.notification_preferences === 'object'
              ? pendingUser.notification_preferences
              : JSON.parse(pendingUser.notification_preferences);
          } catch {
            pendingUserPrefs = null;
          }
        }

        const lang = pendingUser.language || 'en';
        console.log(`[Scheduler] Dispatching basal reminder for user #${pendingUser.id} (${pendingUser.email})...`);
        const resBasal = await dispatchMultiChannelReminder({
          type: 'basal',
          lang,
          telegramConfig: activeConfig,
          pushSubs,
          userPrefs: pendingUserPrefs,
          isLocal: true
        });

        if (resBasal.ok) {
          console.log(`[Scheduler] Basal reminder sent successfully for user #${pendingUser.id}`);
          await new Promise((resolve) => {
            db.recordBasalReminder(pendingUser.id, jerusalemDate, pendingUser.basal_time, 1, null, () => resolve());
          });
        } else if (resBasal.disabled) {
          console.log(`[Scheduler] Basal reminder disabled in settings for user #${pendingUser.id}.`);
          await new Promise((resolve) => {
            db.recordBasalReminder(pendingUser.id, jerusalemDate, pendingUser.basal_time, 0, 'Disabled in notification settings.', () => resolve());
          });
        } else if (resBasal.unconfigured) {
          console.log(`[Scheduler] Notification channels not configured for user #${pendingUser.id} basal reminder.`);
          await new Promise((resolve) => {
            db.recordBasalReminder(pendingUser.id, jerusalemDate, pendingUser.basal_time, 0, unconfiguredError, () => resolve());
          });
        } else {
          console.error(`[Scheduler] Failed to send basal reminder for user #${pendingUser.id}:`, resBasal.error);
          await new Promise((resolve) => {
            db.recordBasalReminder(pendingUser.id, jerusalemDate, pendingUser.basal_time, 0, resBasal.error, () => resolve());
          });
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error checking notifications:', err);
  } finally {
    isChecking = false;
  }
}

/**
 * Start the polling scheduler at a given interval
 * @param {number} intervalMs - Poll interval in milliseconds (default: 30000)
 */
function startScheduler(intervalMs = 30000) {
  if (schedulerInterval) return;

  console.log(`[Scheduler] Starting notification scheduler (interval: ${intervalMs / 1000}s)`);
  // Run once immediately on start
  checkAndDispatchNotifications();
  schedulerInterval = setInterval(checkAndDispatchNotifications, intervalMs);
}

/**
 * Stop the polling scheduler
 */
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Notification scheduler stopped.');
  }
}

module.exports = {
  MESSAGE_10M,
  MESSAGE_2H,
  MESSAGE_3H,
  formatDoseTime,
  getJerusalemDateAndTime,
  buildTestMessage,
  buildMessage10m,
  buildMessage2h,
  buildMessage3h,
  buildMessageBasal,
  buildPushPayload,
  dispatchMultiChannelReminder,
  checkAndDispatchNotifications,
  startScheduler,
  stopScheduler
};
