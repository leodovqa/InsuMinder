const db = require('./db');
const { sendTelegramMessage } = require('./telegram');

let schedulerInterval = null;
let isChecking = false;

const MESSAGE_10M = "From InsuMinder:\n10 minutes have passed since your injection. You can now start your meal.";
const MESSAGE_2H = "From InsuMinder:\nPlease go and check your Glucose level after 2 Hours.";
const MESSAGE_3H = "From InsuMinder:\nPlease go and check your Glucose level after 3 Hours.";

/**
 * Check for due notifications and dispatch them to Telegram
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

    if (!dueLogs || dueLogs.length === 0) {
      isChecking = false;
      return;
    }

    const unconfiguredError = "Telegram is not configured. Go to Settings to set up your destination.";

    for (const log of dueLogs) {
      // Find the user's specific Telegram config, or global fallback
      const activeConfig = await new Promise((resolve) => {
        if (log.user_id) {
          db.getDefaultTelegramConfig(log.user_id, (err, cfg) => {
            if (!err && cfg) return resolve(cfg);
            db.getDefaultTelegramConfig((gErr, gCfg) => resolve(gCfg || null));
          });
        } else {
          db.getDefaultTelegramConfig((err, cfg) => resolve(cfg || null));
        }
      });

      const isTelegramConfigured = Boolean(
        activeConfig &&
        activeConfig.bot_token &&
        activeConfig.chat_id &&
        activeConfig.bot_token.trim() &&
        activeConfig.chat_id.trim()
      );

      if (!isTelegramConfigured) {
        if (!log.status_10m_sent && log.notify_10m_at <= nowIso && (!log.error_10m || log.error_10m !== unconfiguredError)) {
          await new Promise((resolve) => db.recordNotificationError(log.id, '10m', unconfiguredError, resolve));
        }
        if (!log.status_2h_sent && log.notify_2h_at <= nowIso && (!log.error_2h || log.error_2h !== unconfiguredError)) {
          await new Promise((resolve) => db.recordNotificationError(log.id, '2h', unconfiguredError, resolve));
        }
        if (!log.status_3h_sent && log.notify_3h_at <= nowIso && (!log.error_3h || log.error_3h !== unconfiguredError)) {
          await new Promise((resolve) => db.recordNotificationError(log.id, '3h', unconfiguredError, resolve));
        }
        continue;
      }

      const botToken = activeConfig.bot_token.trim();
      const chatId = activeConfig.chat_id.trim();

      // 10-minute meal notification
      if (!log.status_10m_sent && log.notify_10m_at <= nowIso) {
        console.log(`[Scheduler] Dispatching 10m meal reminder for injection #${log.id}...`);
        const result = await sendTelegramMessage(botToken, chatId, MESSAGE_10M);
        if (result.ok) {
          console.log(`[Scheduler] 10m meal reminder sent successfully for #${log.id}`);
          await new Promise((resolve) => db.markNotificationSent(log.id, '10m', resolve));
        } else {
          console.error(`[Scheduler] Failed to send 10m meal reminder for #${log.id}:`, result.error);
          await new Promise((resolve) => db.recordNotificationError(log.id, '10m', result.error, resolve));
        }
      }

      // 2-hour notification
      if (!log.status_2h_sent && log.notify_2h_at <= nowIso) {
        console.log(`[Scheduler] Dispatching 2h reminder for injection #${log.id}...`);
        const result = await sendTelegramMessage(botToken, chatId, MESSAGE_2H);
        if (result.ok) {
          console.log(`[Scheduler] 2h reminder sent successfully for #${log.id}`);
          await new Promise((resolve) => db.markNotificationSent(log.id, '2h', resolve));
        } else {
          console.error(`[Scheduler] Failed to send 2h reminder for #${log.id}:`, result.error);
          await new Promise((resolve) => db.recordNotificationError(log.id, '2h', result.error, resolve));
        }
      }

      // 3-hour notification
      if (!log.status_3h_sent && log.notify_3h_at <= nowIso) {
        console.log(`[Scheduler] Dispatching 3h reminder for injection #${log.id}...`);
        const result = await sendTelegramMessage(botToken, chatId, MESSAGE_3H);
        if (result.ok) {
          console.log(`[Scheduler] 3h reminder sent successfully for #${log.id}`);
          await new Promise((resolve) => db.markNotificationSent(log.id, '3h', resolve));
        } else {
          console.error(`[Scheduler] Failed to send 3h reminder for #${log.id}:`, result.error);
          await new Promise((resolve) => db.recordNotificationError(log.id, '3h', result.error, resolve));
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
  checkAndDispatchNotifications,
  startScheduler,
  stopScheduler
};
