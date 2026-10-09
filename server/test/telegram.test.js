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

    it('inserts injection log and tracks 2h/3h notification status', async () => {
      const logId = await new Promise((resolve, reject) => {
        db.insertInjectionLog(function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        });
      });

      assert.ok(logId > 0);

      // Verify marking 2h and 3h sent
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
      assert.strictEqual(target.status_2h_sent, 1);
      assert.strictEqual(target.status_3h_sent, 1);
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
    it('has exact notification message formats as requested', () => {
      assert.strictEqual(
        scheduler.MESSAGE_2H,
        'From InsuMinder:\nPlease go and check your Glucose level after 2 Hours.'
      );
      assert.strictEqual(
        scheduler.MESSAGE_3H,
        'From InsuMinder:\nPlease go and check your Glucose level after 3 Hours.'
      );
    });
  });
});

