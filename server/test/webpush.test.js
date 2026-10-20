const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// Dynamically generate ephemeral in-memory VAPID keypair for tests (Rule 13: Zero Hardcoded Secrets)
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  process.env.VAPID_PUBLIC_KEY = ecdh.getPublicKey('base64url');
  process.env.VAPID_PRIVATE_KEY = ecdh.getPrivateKey('base64url');
  process.env.VAPID_SUBJECT = 'mailto:test@insuminder.com';
}

const db = require('../src/db');
const webpush = require('../src/webpush');
const scheduler = require('../src/scheduler');

describe('Web Push & Multi-Channel Reminder Integration Tests', () => {
  beforeEach(async () => {
    // Clear subscriptions table
    await new Promise((resolve) => {
      db.db.run("DELETE FROM push_subscriptions", () => resolve());
    });
  });

  describe('Database Push Subscriptions Operations', () => {
    it('saves, retrieves, and deletes push subscriptions scoped to user', async () => {
      const userId = 888;
      const sub = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-sub-1',
        keys: {
          p256dh: 'BNACDjD1nn2PsLMW8wXHd24MFshk1rHd72u-_NC28fa9nepN7SJTsBmAGaI1ooxPvTv-lOYuQrkxE2z7iVwUJHs',
          auth: 'mock_auth_token_secret_xyz123'
        }
      };

      // 1. Save subscription
      const saveRes = await new Promise((resolve, reject) => {
        db.savePushSubscription(userId, sub, 'Test Browser Agent', (err, res) => {
          if (err) return reject(err);
          resolve(res);
        });
      });
      assert.ok(saveRes);
      assert.strictEqual(saveRes.endpoint, sub.endpoint);

      // 2. Retrieve subscriptions for user
      const userSubs = await new Promise((resolve, reject) => {
        db.getPushSubscriptions(userId, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      assert.strictEqual(userSubs.length, 1);
      assert.strictEqual(userSubs[0].endpoint, sub.endpoint);
      assert.strictEqual(userSubs[0].p256dh, sub.keys.p256dh);
      assert.strictEqual(userSubs[0].auth, sub.keys.auth);
      assert.strictEqual(userSubs[0].user_agent, 'Test Browser Agent');

      // Another user has 0 subscriptions
      const otherSubs = await new Promise((resolve, reject) => {
        db.getPushSubscriptions(999, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      assert.strictEqual(otherSubs.length, 0);

      // 3. Delete subscription
      const delRes = await new Promise((resolve, reject) => {
        db.deletePushSubscription(sub.endpoint, (err, res) => {
          if (err) return reject(err);
          resolve(res);
        });
      });
      assert.strictEqual(delRes.deleted, 1);

      const remaining = await new Promise((resolve, reject) => {
        db.getPushSubscriptions(userId, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      assert.strictEqual(remaining.length, 0);
    });
  });

  describe('Web Push Crypto & RFC 8291/8292 Encryption', () => {
    it('has valid VAPID keys exported', () => {
      assert.ok(webpush.VAPID_PUBLIC_KEY);
      assert.ok(webpush.VAPID_PRIVATE_KEY);
      assert.ok(webpush.VAPID_SUBJECT);
      assert.match(webpush.VAPID_SUBJECT, /^mailto:/);
    });

    it('formats VAPID subject gracefully with or without mailto prefix', () => {
      assert.strictEqual(webpush.formatVapidSubject('insuminder@gmail.com'), 'mailto:insuminder@gmail.com');
      assert.strictEqual(webpush.formatVapidSubject('mailto:insuminder@gmail.com'), 'mailto:insuminder@gmail.com');
      assert.strictEqual(webpush.formatVapidSubject('https://insuminder.pages.dev'), 'https://insuminder.pages.dev');
      assert.strictEqual(webpush.formatVapidSubject(''), 'mailto:insuminder@gmail.com');
      assert.strictEqual(webpush.formatVapidSubject(null), 'mailto:insuminder@gmail.com');
    });

    it('builds push payloads with appropriate clinical reminder text in en, he, ru', () => {
      const iso = '2026-10-10T14:30:00.000Z';

      const enPayload = scheduler.buildPushPayload('10m', { injectedAt: iso, lang: 'en' });
      assert.strictEqual(enPayload.title, '🍽️ Meal Time Reminder');
      assert.match(enPayload.body, /10 minutes have passed/);
      assert.strictEqual(enPayload.tag, 'insuminder-10m');

      const hePayload = scheduler.buildPushPayload('10m', { injectedAt: iso, lang: 'he' });
      assert.strictEqual(hePayload.title, '🍽️ תזכורת זמן ארוחה');
      assert.match(hePayload.body, /חלפו 10 דקות/);

      const ruPayload = scheduler.buildPushPayload('2h', { injectedAt: iso, lang: 'ru' });
      assert.strictEqual(ruPayload.title, '🩸 Проверка уровня сахара');
      assert.match(ruPayload.body, /Пожалуйста, измерьте/);

      const basalPayload = scheduler.buildPushPayload('basal', { lang: 'en' });
      assert.strictEqual(basalPayload.title, '🌙 Basal Injection Reminder');
      assert.strictEqual(basalPayload.tag, 'insuminder-basal');
    });

    it('handles push delivery response and automatically detects expired subscriptions (410 Gone)', async () => {
      const originalFetch = globalThis.fetch;
      const testSub = {
        endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/test-expired',
        p256dh: 'BNACDjD1nn2PsLMW8wXHd24MFshk1rHd72u-_NC28fa9nepN7SJTsBmAGaI1ooxPvTv-lOYuQrkxE2z7iVwUJHs',
        auth: 'mock_auth_token_secret_xyz123'
      };

      try {
        // Mock 410 Gone from push endpoint
        globalThis.fetch = async () => ({
          status: 410,
          text: async () => 'Push subscription has expired'
        });

        const res = await webpush.sendWebPush(testSub, { title: 'Test' });
        assert.strictEqual(res.ok, false);
        assert.strictEqual(res.expired, true);
        assert.strictEqual(res.status, 410);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('successfully delivers push when endpoint responds with 201 Created', async () => {
      const originalFetch = globalThis.fetch;
      const testSub = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-success',
        p256dh: 'BNACDjD1nn2PsLMW8wXHd24MFshk1rHd72u-_NC28fa9nepN7SJTsBmAGaI1ooxPvTv-lOYuQrkxE2z7iVwUJHs',
        auth: 'mock_auth_token_secret_xyz123'
      };

      let capturedHeaders = null;
      try {
        globalThis.fetch = async (url, options) => {
          capturedHeaders = options.headers;
          return {
            status: 201,
            text: async () => ''
          };
        };

        const res = await webpush.sendWebPush(testSub, { title: 'Test Injection' });
        assert.strictEqual(res.ok, true);
        assert.strictEqual(res.status, 201);
        assert.ok(capturedHeaders);
        assert.strictEqual(capturedHeaders['Content-Encoding'], 'aes128gcm');
        assert.match(capturedHeaders['Authorization'], /^vapid t=/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Multi-Channel Scheduler Dispatch Integration', () => {
    it('dispatches reminder via Web Push and prunes expired subscriptions from database', async () => {
      const originalFetch = globalThis.fetch;
      const userId = 888;
      const expiredEndpoint = 'https://fcm.googleapis.com/fcm/send/expired-client';

      await new Promise((resolve) => {
        db.savePushSubscription(
          userId,
          {
            endpoint: expiredEndpoint,
            keys: {
              p256dh: 'BNACDjD1nn2PsLMW8wXHd24MFshk1rHd72u-_NC28fa9nepN7SJTsBmAGaI1ooxPvTv-lOYuQrkxE2z7iVwUJHs',
              auth: 'mock_auth_token_secret_xyz123'
            }
          },
          'Expired UA',
          () => resolve()
        );
      });

      try {
        globalThis.fetch = async () => ({
          status: 410,
          text: async () => 'Gone'
        });

        const subs = await new Promise((resolve) => {
          db.getPushSubscriptions(userId, (err, rows) => resolve(rows || []));
        });
        assert.strictEqual(subs.length, 1);

        const res = await scheduler.dispatchMultiChannelReminder({
          type: '10m',
          injectedAt: new Date().toISOString(),
          pushSubs: subs,
          telegramConfig: null,
          isLocal: true
        });

        assert.strictEqual(res.ok, false);

        // Verify that expired subscription was automatically pruned from database
        const remainingSubs = await new Promise((resolve) => {
          db.getPushSubscriptions(userId, (err, rows) => resolve(rows || []));
        });
        assert.strictEqual(remainingSubs.length, 0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

