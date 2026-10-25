const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const db = require('../src/db');
const fcm = require('../src/fcm');
const scheduler = require('../src/scheduler');

describe('Firebase Cloud Messaging (FCM) & Killed App Notifications Tests', () => {
  beforeEach(async () => {
    await new Promise((resolve) => {
      db.db.run("DELETE FROM push_subscriptions", () => resolve());
    });
  });

  describe('FCM Credentials & Configuration (Rule 13)', () => {
    it('returns null gracefully when FIREBASE_SERVICE_ACCOUNT is unset', () => {
      const orig = process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      try {
        const creds = fcm.resolveFcmCredentials();
        assert.strictEqual(creds, null);
      } finally {
        if (orig) process.env.FIREBASE_SERVICE_ACCOUNT = orig;
      }
    });

    it('gracefully fails with clear configuration error when sending without credentials', async () => {
      const orig = process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      try {
        const res = await fcm.sendFcmNotification('test_token_123', {
          reminderId: 'bolus-10m',
          title: 'Meal Reminder',
          body: '10 minutes have passed'
        });
        assert.strictEqual(res.success, false);
        assert.match(res.error, /Firebase credentials not configured/i);
      } finally {
        if (orig) process.env.FIREBASE_SERVICE_ACCOUNT = orig;
      }
    });
  });

  describe('Database FCM Subscriptions & Multi-Engine Handling', () => {
    it('saves and retrieves native FCM token subscriptions with fcm: prefix', async () => {
      const userId = 777;
      const sub = {
        endpoint: 'fcm:mock_fcm_device_token_abc123',
        keys: { p256dh: 'fcm', auth: 'fcm' }
      };

      const saveRes = await new Promise((resolve, reject) => {
        db.savePushSubscription(userId, sub, 'InsuMinder-Android', (err, res) => {
          if (err) return reject(err);
          resolve(res);
        });
      });
      assert.ok(saveRes);
      assert.strictEqual(saveRes.endpoint, 'fcm:mock_fcm_device_token_abc123');

      const subs = await new Promise((resolve, reject) => {
        db.getPushSubscriptions(userId, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      assert.strictEqual(subs.length, 1);
      assert.strictEqual(subs[0].endpoint, 'fcm:mock_fcm_device_token_abc123');
      assert.strictEqual(subs[0].p256dh, 'fcm');
      assert.strictEqual(subs[0].auth, 'fcm');
    });

    it('scheduler routes fcm: endpoints to sendFcmNotification and auto-prunes expired tokens', async () => {
      const userId = 778;
      const fcmEndpoint = 'fcm:expired_device_token_xyz';

      // Seed expired token
      await new Promise((resolve, reject) => {
        db.savePushSubscription(userId, { endpoint: fcmEndpoint, keys: { p256dh: 'fcm', auth: 'fcm' } }, 'Android', (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      // Verify token is in DB
      let initialSubs = await new Promise((resolve) => db.getPushSubscriptions(userId, (e, r) => resolve(r)));
      assert.strictEqual(initialSubs.length, 1);

      // Mock fcm.sendFcmNotification returning expired
      const origSend = fcm.sendFcmNotification;
      let interceptedToken = null;
      fcm.sendFcmNotification = async (token, payload) => {
        interceptedToken = token;
        return { success: false, expired: true, error: 'UNREGISTERED' };
      };

      try {
        const pushSubs = await new Promise((resolve) => db.getPushSubscriptions(userId, (e, r) => resolve(r)));
        const res = await scheduler.dispatchMultiChannelReminder({
          type: '10m',
          injectedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          pushSubs,
          userPrefs: { personal: { webPush: true } }
        });

        assert.strictEqual(interceptedToken, 'expired_device_token_xyz');
        // Expired subscription should have been deleted from DB
        const remainingSubs = await new Promise((resolve) => db.getPushSubscriptions(userId, (e, r) => resolve(r)));
        assert.strictEqual(remainingSubs.length, 0);
      } finally {
        fcm.sendFcmNotification = origSend;
      }
    });
  });
});

