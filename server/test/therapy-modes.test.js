const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const testDbPath = path.resolve(__dirname, `test_therapy_${Date.now()}_${process.pid}.db`);
process.env.DB_PATH = testDbPath;

const db = require('../src/db');

function insertManual(userId, type, injectedAt) {
  return new Promise((resolve, reject) => {
    db.insertManualInjectionLog(userId, type, injectedAt, function (err) {
      if (err) return reject(err);
      resolve(this.lastID);
    });
  });
}

describe('Therapy Modes (Pens vs Pump/Pod Flow) Database & Logic Tests', () => {
  let penUserId = null;
  let pumpUserId = null;

  before(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Create Pen User
    const penUser = await new Promise((resolve, reject) => {
      db.createUser({ email: `pen_${Date.now()}@test.org`, password_hash: 'Pass123!', name: 'Pen User' }, (err, u) => {
        if (err) return reject(err);
        resolve(u);
      });
    });
    penUserId = penUser.id;
    await new Promise((resolve, reject) => {
      db.updateUser(penUserId, { therapy_mode: 'pen' }, (err) => (err ? reject(err) : resolve()));
    });

    // Create Pump User
    const pumpUser = await new Promise((resolve, reject) => {
      db.createUser({ email: `pump_${Date.now()}@test.org`, password_hash: 'Pass123!', name: 'Pump User' }, (err, u) => {
        if (err) return reject(err);
        resolve(u);
      });
    });
    pumpUserId = pumpUser.id;
    await new Promise((resolve, reject) => {
      db.updateUser(pumpUserId, { therapy_mode: 'pump' }, (err) => (err ? reject(err) : resolve()));
    });
  });

  after(() => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore file lock cleanup on Windows
      }
    }
  });

  it('persists and retrieves therapy_mode correctly on users', async () => {
    const penUserRow = await new Promise((resolve, reject) => {
      db.getUserById(penUserId, (err, u) => (err ? reject(err) : resolve(u)));
    });
    assert.equal(penUserRow.therapy_mode, 'pen');

    const pumpUserRow = await new Promise((resolve, reject) => {
      db.getUserById(pumpUserId, (err, u) => (err ? reject(err) : resolve(u)));
    });
    assert.equal(pumpUserRow.therapy_mode, 'pump');
  });

  it('rejects basal injection in pump mode with status 400', async () => {
    const nowIso = new Date().toISOString();
    await assert.rejects(
      async () => {
        await insertManual(pumpUserId, 'basal', nowIso);
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /Basal injections are not applicable in pump mode/i);
        return true;
      }
    );
  });

  it('allows basal injection in pen mode and records delivery_method as pen', async () => {
    const now = new Date();
    const basalId = await insertManual(penUserId, 'basal', now.toISOString());
    assert.ok(basalId > 0);

    const logs = await new Promise((resolve, reject) => {
      db.getLogsFromLast24Hours(penUserId, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
    const logged = logs.find((l) => l.id === basalId);
    assert.ok(logged);
    assert.equal(logged.type, 'basal');
    assert.equal(logged.delivery_method, 'pen');
  });

  it('enforces 10 bolus limit per day for pen mode', async () => {
    const testDate = new Date().toISOString().slice(0, 10);
    for (let i = 1; i <= 10; i++) {
      const minute = String(i).padStart(2, '0');
      await insertManual(penUserId, 'bolus', `${testDate}T01:${minute}:00.000Z`);
    }

    // 11th should fail
    await assert.rejects(
      async () => {
        await insertManual(penUserId, 'bolus', `${testDate}T01:30:00.000Z`);
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /Maximum 10 bolus injections allowed per day/i);
        return true;
      }
    );
  });

  it('enforces 20 bolus limit per day for pump mode and saves delivery_method as pump', async () => {
    // Use yesterday's date (within 1 month)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const testDate = yesterday.toISOString().slice(0, 10);
    for (let i = 1; i <= 20; i++) {
      const minute = String(i).padStart(2, '0');
      const logId = await insertManual(pumpUserId, 'bolus', `${testDate}T02:${minute}:00.000Z`);
      assert.ok(logId > 0);
    }

    // Verify delivery_method on pump logs
    const logs = await new Promise((resolve, reject) => {
      db.getLogsFromLast24Hours(pumpUserId, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
    const pumpLogs = logs.filter((l) => l.injected_at.startsWith(testDate));
    assert.equal(pumpLogs.length, 20);
    pumpLogs.forEach((l) => assert.equal(l.delivery_method, 'pump'));

    // 21st should fail
    await assert.rejects(
      async () => {
        await insertManual(pumpUserId, 'bolus', `${testDate}T02:45:00.000Z`);
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /Maximum 20 bolus injections allowed per day/i);
        return true;
      }
    );
  });

  it('getUsersPendingBasalReminder excludes pump users from scheduled basal reminders', async () => {
    const dueUsers = await new Promise((resolve, reject) => {
      db.getUsersPendingBasalReminder('23:59', '2026-05-12', (err, rows) => (err ? reject(err) : resolve(rows)));
    });
    const pumpUserInDue = dueUsers.find((u) => u.id === pumpUserId);
    assert.equal(pumpUserInDue, undefined);
  });
});
