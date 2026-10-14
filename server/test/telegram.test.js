const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// Use a unique temporary test database per test run so tests don't collide
const testDbPath = path.resolve(__dirname, `test_insuminder_${Date.now()}_${process.pid}.db`);
process.env.DB_PATH = testDbPath;

const { sendTelegramMessage } = require('../src/telegram');
const db = require('../src/db');
const scheduler = require('../src/scheduler');

describe('Telegram Notification Integration Tests', () => {
  after(() => {
    // Clean up test db file
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {
      // ignore cleanup errors on open handles
    }
  });

  describe('Telegram Client (sendTelegramMessage)', () => {
    it('returns error when bot token or chat ID is missing or empty', async () => {
      const res1 = await sendTelegramMessage('', '12345', 'Hello');
      assert.strictEqual(res1.ok, false);
      assert.match(res1.error, /required/i);

      const res2 = await sendTelegramMessage('token', '   ', 'Hello');
      assert.strictEqual(res2.ok, false);
      assert.match(res2.error, /cannot be empty/i);
    });

    it('successfully calls Telegram API when credentials are valid', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        assert.match(url, /api\.telegram\.org\/botMY_TOKEN\/sendMessage/);
        const payload = JSON.parse(options.body);
        assert.strictEqual(payload.chat_id, '-999888');
        assert.strictEqual(payload.text, 'Test Msg');

        return {
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 42 } })
        };
      };

      try {
        const res = await sendTelegramMessage('MY_TOKEN', '999888', 'Test Msg');
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.result.message_id, 42);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns error description when Telegram API returns failure', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return {
          ok: false,
          status: 400,
          json: async () => ({ ok: false, error_code: 400, description: 'Bad Request: chat not found' })
        };
      };

      try {
        const res = await sendTelegramMessage('MY_TOKEN', 'INVALID_CHAT', 'Test Msg');
        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.error, 'Bad Request: chat not found');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Database Settings & Notification Status', () => {
    it('saves and retrieves Telegram settings in SQLite', async () => {
      await new Promise((resolve, reject) => {
        db.setSettings({
          telegram_bot_token: 'bot12345:TOKEN',
          telegram_chat_id: 'chat98765'
        }, (err) => (err ? reject(err) : resolve()));
      });

      const settings = await new Promise((resolve, reject) => {
        db.getAllSettings((err, res) => (err ? reject(err) : resolve(res)));
      });

      assert.strictEqual(settings.telegram_bot_token, 'bot12345:TOKEN');
      assert.strictEqual(settings.telegram_chat_id, 'chat98765');
    });

    it('inserts injection log and tracks 10m/2h/3h notification status', async () => {
      const logId = await new Promise((resolve, reject) => {
        db.insertInjectionLog(function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        });
      });

      assert.ok(logId > 0);

      // Verify marking 10m, 2h, and 3h sent
      await new Promise((resolve, reject) => {
        db.markNotificationSent(logId, '10m', (err) => (err ? reject(err) : resolve()));
      });
      await new Promise((resolve, reject) => {
        db.markNotificationSent(logId, '2h', (err) => (err ? reject(err) : resolve()));
      });
      await new Promise((resolve, reject) => {
        db.markNotificationSent(logId, '3h', (err) => (err ? reject(err) : resolve()));
      });

      const logs = await new Promise((resolve, reject) => {
        db.getLogsFromLast24Hours((err, rows) => (err ? reject(err) : resolve(rows)));
      });

      const target = logs.find(l => l.id === logId);
      assert.strictEqual(target.status_10m_sent, 1);
      assert.strictEqual(target.status_2h_sent, 1);
      assert.strictEqual(target.status_3h_sent, 1);
      assert.ok(target.notify_10m_at);
      assert.ok(target.notify_2h_at);
      assert.ok(target.notify_3h_at);
      assert.strictEqual(target.type, 'bolus');
    });

    it('inserts basal injection log without scheduling pending notifications', async () => {
      const basalLogId = await new Promise((resolve, reject) => {
        db.insertInjectionLog(8888, 'basal', function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        });
      });

      assert.ok(basalLogId > 0);

      const logs = await new Promise((resolve, reject) => {
        db.getLogsFromLast24Hours(8888, (err, rows) => (err ? reject(err) : resolve(rows)));
      });

      const basalEntry = logs.find(l => l.id === basalLogId);
      assert.ok(basalEntry);
      assert.strictEqual(basalEntry.type, 'basal');
      assert.strictEqual(basalEntry.status_10m_sent, 1);
      assert.strictEqual(basalEntry.status_2h_sent, 1);
      assert.strictEqual(basalEntry.status_3h_sent, 1);

      // Verify that getDueNotifications does not pick up basal entries
      const due = await new Promise((resolve, reject) => {
        db.getDueNotifications((err, rows) => (err ? reject(err) : resolve(rows)));
      });
      assert.ok(!due.some(l => l.id === basalLogId));
    });

    it('records notification errors and clears error upon successful delivery', async () => {
      const logId = await new Promise((resolve, reject) => {
        const past = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        db.db.run(
          "INSERT INTO injection_logs (injected_at, notify_10m_at, notify_2h_at, notify_3h_at) VALUES (?, ?, ?, ?)",
          [past, past, past, past],
          function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });

      // Record an error for 10m, 2h, and 3h
      await new Promise((resolve, reject) => {
        db.recordNotificationError(logId, '10m', 'Telegram is not configured.', (err) => (err ? reject(err) : resolve()));
      });
      await new Promise((resolve, reject) => {
        db.recordNotificationError(logId, '2h', 'Chat not found (-4304245048)', (err) => (err ? reject(err) : resolve()));
      });
      await new Promise((resolve, reject) => {
        db.recordNotificationError(logId, '3h', 'Bot token expired or unauthorized', (err) => (err ? reject(err) : resolve()));
      });

      let logs = await new Promise((resolve, reject) => {
        db.getLogsFromLast24Hours((err, rows) => (err ? reject(err) : resolve(rows)));
      });
      let target = logs.find(l => l.id === logId);
      assert.strictEqual(target.status_10m_sent, 0);
      assert.strictEqual(target.status_2h_sent, 0);
      assert.strictEqual(target.status_3h_sent, 0);
      assert.strictEqual(target.error_10m, 'Telegram is not configured.');
      assert.strictEqual(target.error_2h, 'Chat not found (-4304245048)');
      assert.strictEqual(target.error_3h, 'Bot token expired or unauthorized');

      // Now mark 10m and 2h sent - should clear error and set status sent to 1
      await new Promise((resolve, reject) => {
        db.markNotificationSent(logId, '10m', (err) => (err ? reject(err) : resolve()));
      });
      await new Promise((resolve, reject) => {
        db.markNotificationSent(logId, '2h', (err) => (err ? reject(err) : resolve()));
      });

      logs = await new Promise((resolve, reject) => {
        db.getLogsFromLast24Hours((err, rows) => (err ? reject(err) : resolve(rows)));
      });
      target = logs.find(l => l.id === logId);
      assert.strictEqual(target.status_10m_sent, 1);
      assert.strictEqual(target.error_10m, null);
      assert.strictEqual(target.status_2h_sent, 1);
      assert.strictEqual(target.error_2h, null);
      assert.strictEqual(target.status_3h_sent, 0);
      assert.strictEqual(target.error_3h, 'Bot token expired or unauthorized');
    });
  });

  describe('Telegram Multi-Config Management', () => {
    it('adds multiple configs, sets newest as default, and allows changing default', async () => {
      const cfg1 = await new Promise((resolve, reject) => {
        db.addTelegramConfig({ name: 'Bot 1', bot_token: 'token1', chat_id: 'chat1' }, (err, res) => {
          err ? reject(err) : resolve(res);
        });
      });

      const cfg2 = await new Promise((resolve, reject) => {
        db.addTelegramConfig({ name: 'Bot 2', bot_token: 'token2', chat_id: 'chat2' }, (err, res) => {
          err ? reject(err) : resolve(res);
        });
      });

      // cfg2 should be default
      let active = await new Promise((resolve, reject) => {
        db.getDefaultTelegramConfig((err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.strictEqual(active.id, cfg2.id);
      assert.strictEqual(active.name, 'Bot 2');

      // Switch default back to cfg1
      await new Promise((resolve, reject) => {
        db.setDefaultTelegramConfig(cfg1.id, (err, res) => (err ? reject(err) : resolve(res)));
      });

      active = await new Promise((resolve, reject) => {
        db.getDefaultTelegramConfig((err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.strictEqual(active.id, cfg1.id);

      // Delete cfg1, cfg2 should be promoted
      await new Promise((resolve, reject) => {
        db.deleteTelegramConfig(cfg1.id, (err) => (err ? reject(err) : resolve()));
      });

      active = await new Promise((resolve, reject) => {
        db.getDefaultTelegramConfig((err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.strictEqual(active.id, cfg2.id);
    });

    it('automatically retries Web K format channel IDs (-4304245048 -> -1004304245048)', async () => {
      const originalFetch = globalThis.fetch;
      let attemptedChatId = null;

      globalThis.fetch = async (url, options) => {
        const payload = JSON.parse(options.body);
        attemptedChatId = payload.chat_id;
        if (payload.chat_id === '-4304245048') {
          return {
            ok: false,
            status: 400,
            json: async () => ({ ok: false, error_code: 400, description: 'Bad Request: chat not found' })
          };
        }
        if (payload.chat_id === '-1004304245048') {
          return {
            ok: true,
            json: async () => ({ ok: true, result: { message_id: 1001 } })
          };
        }
        return { ok: false, status: 500, json: async () => ({ ok: false }) };
      };

      try {
        const res = await sendTelegramMessage('TOKEN', '-4304245048', 'Test Web K');
        assert.strictEqual(res.ok, true);
        assert.strictEqual(attemptedChatId, '-1004304245048');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Scheduler Messages Specification', () => {
    it('has enhanced notification message formats with icons, local prefix, and dose time', () => {
      // Local defaults (without specific dose time)
      assert.strictEqual(
        scheduler.MESSAGE_10M,
        '🍽️ From InsuMinder (Local):\n⏰ Meal Time Reminder\n\n10 minutes have passed since your injection. You can now start your meal!'
      );
      assert.strictEqual(
        scheduler.MESSAGE_2H,
        '🩸 From InsuMinder (Local):\n⏰ 2-Hour Glucose Check\n\nPlease go and check your Glucose level after 2 Hours.'
      );
      assert.strictEqual(
        scheduler.MESSAGE_3H,
        '🎯 From InsuMinder (Local):\n⏰ 3-Hour Injection Eligibility\n\n3 hours have passed since your injection. Safe window reached for your next dose if needed.'
      );

      // Production builder with dose time (ISO timestamp)
      const testIso = '2026-10-10T14:30:00.000Z';
      const expectedTime = scheduler.formatDoseTime(testIso);
      const prodMsg10m = scheduler.buildMessage10m(testIso, false);
      assert.match(prodMsg10m, /🍽️ From InsuMinder:/);
      assert.doesNotMatch(prodMsg10m, /\(Local\)/);
      assert.match(prodMsg10m, new RegExp(`💉 Dose logged at: ${expectedTime}`));

      const prodMsg2h = scheduler.buildMessage2h(testIso, false);
      assert.match(prodMsg2h, /🩸 From InsuMinder:/);
      assert.match(prodMsg2h, new RegExp(`💉 Dose logged at: ${expectedTime}`));

      const prodMsg3h = scheduler.buildMessage3h(testIso, false);
      assert.match(prodMsg3h, /🎯 From InsuMinder:/);
      assert.match(prodMsg3h, new RegExp(`💉 Dose logged at: ${expectedTime}`));

      // Hebrew localized message builders (Local vs Prod)
      const testMsgHebLocal = scheduler.buildTestMessage('he', true);
      assert.match(testMsgHebLocal, /מאת InsuMinder \(Local\):/);
      assert.match(testMsgHebLocal, /חיבור הטלגרם הצליח!/);

      const testMsgHebProd = scheduler.buildTestMessage('he', false);
      assert.match(testMsgHebProd, /מאת InsuMinder:/);
      assert.doesNotMatch(testMsgHebProd, /\(Local\)/);

      const hebMsg10mLocal = scheduler.buildMessage10m(testIso, true, 'he');
      assert.match(hebMsg10mLocal, /🍽️ מאת InsuMinder \(Local\):/);

      const hebMsg10mProd = scheduler.buildMessage10m(testIso, false, 'he');
      assert.match(hebMsg10mProd, /🍽️ מאת InsuMinder:/);
      assert.doesNotMatch(hebMsg10mProd, /\(Local\)/);
      assert.match(hebMsg10mProd, /תזכורת זמן ארוחה/);
      assert.match(hebMsg10mProd, new RegExp(`💉 הזרקה נרשמה בשעה: ${expectedTime}`));

      const hebMsg2h = scheduler.buildMessage2h(testIso, false, 'he');
      assert.match(hebMsg2h, /🩸 מאת InsuMinder:/);
      assert.match(hebMsg2h, /בדיקת סוכר לאחר שעתיים/);

      const hebMsg3h = scheduler.buildMessage3h(testIso, false, 'he');
      assert.match(hebMsg3h, /🎯 מאת InsuMinder:/);
      assert.match(hebMsg3h, /חלון הזרקה בטוח/);

      // Russian localized message builders (Local vs Prod)
      const testMsgRuLocal = scheduler.buildTestMessage('ru', true);
      assert.match(testMsgRuLocal, /От InsuMinder \(Local\):/);
      assert.match(testMsgRuLocal, /Подключение к Telegram успешно!/);

      const testMsgRuProd = scheduler.buildTestMessage('ru', false);
      assert.match(testMsgRuProd, /От InsuMinder:/);
      assert.doesNotMatch(testMsgRuProd, /\(Local\)/);

      const ruMsg10mLocal = scheduler.buildMessage10m(testIso, true, 'ru');
      assert.match(ruMsg10mLocal, /🍽️ От InsuMinder \(Local\):/);

      const ruMsg10mProd = scheduler.buildMessage10m(testIso, false, 'ru');
      assert.match(ruMsg10mProd, /🍽️ От InsuMinder:/);
      assert.doesNotMatch(ruMsg10mProd, /\(Local\)/);
      assert.match(ruMsg10mProd, /Напоминание о приёме пищи/);
      assert.match(ruMsg10mProd, new RegExp(`💉 Инъекция зафиксирована в: ${expectedTime}`));

      const ruMsg2h = scheduler.buildMessage2h(testIso, false, 'ru');
      assert.match(ruMsg2h, /🩸 От InsuMinder:/);
      assert.match(ruMsg2h, /Проверка уровня сахара через 2 часа/);

      const ruMsg3h = scheduler.buildMessage3h(testIso, false, 'ru');
      assert.match(ruMsg3h, /🎯 От InsuMinder:/);
      assert.match(ruMsg3h, /Безопасное окно для инъекции/);

      // Basal reminder messages
      const basalEn = scheduler.buildMessageBasal(true, 'en');
      assert.match(basalEn, /🌙 From InsuMinder \(Local\):/);
      assert.match(basalEn, /⏰ Basal Injection Reminder/);

      const basalHe = scheduler.buildMessageBasal(false, 'he');
      assert.match(basalHe, /🌙 מאת InsuMinder:/);
      assert.match(basalHe, /תזכורת להזרקת אינסולין בזאלי/);

      const basalRu = scheduler.buildMessageBasal(false, 'ru');
      assert.match(basalRu, /🌙 От InsuMinder:/);
      assert.match(basalRu, /Напоминание о базальном инсулине/);
    });

    it('records and queries basal reminders with idempotency', async () => {
      const testUserId = 7777;
      const testDate = '2026-10-13';

      // 1. Record pending / failed
      await new Promise((resolve, reject) => {
        db.recordBasalReminder(testUserId, testDate, '20:00', 0, 'Telegram is not configured.', (err) => (err ? reject(err) : resolve()));
      });

      const reminder1 = await new Promise((resolve, reject) => {
        db.getTodayBasalReminder(testUserId, testDate, (err, row) => (err ? reject(err) : resolve(row)));
      });
      assert.ok(reminder1);
      assert.strictEqual(reminder1.status_sent, 0);
      assert.strictEqual(reminder1.error, 'Telegram is not configured.');

      // 2. Record success (updates status_sent=1)
      await new Promise((resolve, reject) => {
        db.recordBasalReminder(testUserId, testDate, '20:00', 1, null, (err) => (err ? reject(err) : resolve()));
      });

      const reminder2 = await new Promise((resolve, reject) => {
        db.getTodayBasalReminder(testUserId, testDate, (err, row) => (err ? reject(err) : resolve(row)));
      });
      assert.strictEqual(reminder2.status_sent, 1);
      assert.strictEqual(reminder2.error, null);

      // 3. Trying to overwrite already sent reminder with 'Already injected' preserves status_sent=1
      await new Promise((resolve, reject) => {
        db.recordBasalReminder(testUserId, testDate, '20:00', 0, 'Already injected', (err) => (err ? reject(err) : resolve()));
      });

      const reminder3 = await new Promise((resolve, reject) => {
        db.getTodayBasalReminder(testUserId, testDate, (err, row) => (err ? reject(err) : resolve(row)));
      });
      assert.strictEqual(reminder3.status_sent, 1);
    });

    it('expires stale notifications overdue by more than the threshold to prevent flooding', async () => {
      // Test stale expiration logic
      const ancientTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 60 mins overdue (> 45m threshold)
      const logId = await new Promise((resolve, reject) => {
        db.db.run(
          "INSERT INTO injection_logs (injected_at, notify_10m_at, notify_2h_at, notify_3h_at) VALUES (?, ?, ?, ?)",
          [ancientTime, ancientTime, ancientTime, ancientTime],
          function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });

      // Configure a valid bot
      await new Promise((resolve, reject) => {
        db.addTelegramConfig({ name: 'Stale Test', bot_token: 'TOKEN', chat_id: '12345' }, (err) => (err ? reject(err) : resolve()));
      });

      await scheduler.checkAndDispatchNotifications();

      const logs = await new Promise((resolve, reject) => {
        db.getLogsFromLast24Hours((err, rows) => (err ? reject(err) : resolve(rows)));
      });
      const staleLog = logs.find(l => l.id === logId);
      // 10m should NOT be sent because it was > 45 minutes overdue
      assert.strictEqual(staleLog.status_10m_sent, 0);
      assert.match(staleLog.error_10m, /expired.*overdue/i);
    });

    it('clearNotificationQueue clears all pending unsent notifications from injection_logs and basal_reminders', async () => {
      // 1. Insert un-sent injection log
      const now = new Date();
      await new Promise((resolve, reject) => {
        db.db.run(
          "INSERT INTO injection_logs (injected_at, notify_10m_at, notify_2h_at, notify_3h_at, status_10m_sent, status_2h_sent, status_3h_sent) VALUES (?, ?, ?, ?, 0, 0, 0)",
          [now.toISOString(), now.toISOString(), now.toISOString(), now.toISOString()],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // 2. Insert pending basal reminder
      await new Promise((resolve, reject) => {
        db.recordBasalReminder(999, '2026-10-14', '20:00', 0, null, (err) => (err ? reject(err) : resolve()));
      });

      // 3. Clear queue
      const res = await new Promise((resolve, reject) => {
        db.clearNotificationQueue((err, result) => (err ? reject(err) : resolve(result)));
      });

      assert.ok(res.logsCleared >= 1);
      assert.ok(res.basalCleared >= 1);

      // Verify no unsent logs remain
      const pendingLogs = await new Promise((resolve, reject) => {
        db.db.all(
          "SELECT * FROM injection_logs WHERE status_10m_sent = 0 OR status_2h_sent = 0 OR status_3h_sent = 0",
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });
      assert.strictEqual(pendingLogs.length, 0);

      const pendingBasal = await new Promise((resolve, reject) => {
        db.db.all(
          "SELECT * FROM basal_reminders WHERE status_sent = 0",
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });
      assert.strictEqual(pendingBasal.length, 0);
    });

    it('scheduler does not send notifications when a user has no telegram configs configured (strictly scoped)', async () => {
      // Create user 555 with NO configs
      const userWithoutConfig = 555;
      const recentTime = new Date().toISOString();

      const logId = await new Promise((resolve, reject) => {
        db.db.run(
          "INSERT INTO injection_logs (user_id, injected_at, notify_10m_at, notify_2h_at, notify_3h_at, status_10m_sent, status_2h_sent, status_3h_sent) VALUES (?, ?, ?, ?, ?, 0, 0, 0)",
          [userWithoutConfig, recentTime, recentTime, recentTime, recentTime],
          function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });

      // Even if another user or global has a config, user 555 must not send anything
      await scheduler.checkAndDispatchNotifications();

      const log = await new Promise((resolve, reject) => {
        db.db.get("SELECT * FROM injection_logs WHERE id = ?", [logId], (err, row) => (err ? reject(err) : resolve(row)));
      });

      assert.strictEqual(log.status_10m_sent, 0);
      assert.match(log.error_10m, /Telegram is not configured/i);
    });
  });
});

