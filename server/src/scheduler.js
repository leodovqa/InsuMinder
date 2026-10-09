const db = require('./db');
const { sendTelegramMessage } = require('./telegram');

let schedulerInterval = null;
let isChecking = false;

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

    // 1. Retrieve current default Telegram configuration
    const activeConfig = await new Promise((resolve, reject) => {
      db.getDefaultTelegramConfig((err, res) => (err ? reject(err) : resolve(res)));
    });

    const isTelegramConfigured = Boolean(
      activeConfig &&
      activeConfig.bot_token &&
      activeConfig.chat_id &&
      activeConfig.bot_token.trim() &&
      activeConfig.chat_id.trim()
    );

    // 2. Fetch pending due injection notifications
    const dueLogs = await new Promise((resolve, reject) => {
      db.getDueNotifications((err, rows) => (err ? reject(err) : resolve(rows || [])));
    });

    // If Telegram is not configured, record descriptive error on due logs
    if (!isTelegramConfigured) {
      const unconfiguredError = "Telegram is not configured. Go to Settings to set up your destination.";
      for (const log of dueLogs) {
        if (!log.status_2h_sent && log.notify_2h_at <= nowIso && (!log.error_2h || log.error_2h !== unconfiguredError)) {
          await new Promise((resolve) => db.recordNotificationError(log.id, '2h', unconfiguredError, resolve));
        }
        if (!log.status_3h_sent && log.notify_3h_at <= nowIso && (!log.error_3h || log.error_3h !== unconfiguredError)) {
          await new Promise((resolve) => db.recordNotificationError(log.id, '3h', unconfiguredError, resolve));
        }
      }
      isChecking = false;
      return;
    }

    const botToken = activeConfig.bot_token.trim();
    const chatId = activeConfig.chat_id.trim();

    for (const log of dueLogs) {
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

function startScheduler(intervalMs = 30000) {
  if (schedulerInterval) return;
  console.log(`[Scheduler] Starting notification scheduler (interval: ${intervalMs / 1000}s)`);
  // Run an immediate check on startup
  checkAndDispatchNotifications();
  schedulerInterval = setInterval(checkAndDispatchNotifications, intervalMs);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Notification scheduler stopped');
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  checkAndDispatchNotifications,
  MESSAGE_2H,
  MESSAGE_3H
};

