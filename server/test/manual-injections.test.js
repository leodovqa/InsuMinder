const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// Use a unique temporary test database per test run
const testDbPath = path.resolve(__dirname, `test_manual_${Date.now()}_${process.pid}.db`);
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

function getLogs(userId) {
  return new Promise((resolve, reject) => {
    db.getLogsFromLast24Hours(userId, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

describe('Manual Injection Logging Integration Tests', () => {
  let testUserId = null;

  before(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const user = await new Promise((resolve, reject) => {
      db.createUser({ email: 'manual_tester@test.org', password_hash: 'HashPass123!', name: 'Manual Tester' }, (err, u) => {
        if (err) return reject(err);
        resolve(u);
      });
    });
    testUserId = user.id;
  });

  after(() => {
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {
      // ignore
    }
  });

  it('successfully logs a manual past bolus injection and suppresses active notifications', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 30, 0, 0);

    const logId = await insertManual(testUserId, 'bolus', yesterday.toISOString());
    assert.ok(logId);

    // Verify the record in DB has status_*_sent = 1 so no notifications trigger
    const logs = await getLogs(testUserId);
    const saved = logs.find(l => l.id === logId);
    assert.ok(saved);
    assert.strictEqual(saved.type, 'bolus');
    assert.strictEqual(saved.status_10m_sent, 1);
    assert.strictEqual(saved.status_2h_sent, 1);
    assert.strictEqual(saved.status_3h_sent, 1);
  });

  it('successfully logs a manual basal injection and marks status sent', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(21, 15, 0, 0);

    const logId = await insertManual(testUserId, 'basal', twoDaysAgo.toISOString());
    assert.ok(logId);

    const logs = await getLogs(testUserId);
    const saved = logs.find(l => l.id === logId);
    assert.ok(saved);
    assert.strictEqual(saved.type, 'basal');
    assert.strictEqual(saved.status_10m_sent, 1);
  });

  it('rejects future injection date/time with a descriptive error', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await assert.rejects(
      async () => {
        await insertManual(testUserId, 'bolus', tomorrow.toISOString());
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /future/i);
        return true;
      }
    );
  });

  it('rejects injection date older than 1 month (31 days)', async () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 40);

    await assert.rejects(
      async () => {
        await insertManual(testUserId, 'bolus', twoMonthsAgo.toISOString());
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /1 month/i);
        return true;
      }
    );
  });

  it('strictly blocks logging a 2nd basal injection on the same day', async () => {
    const fiveDaysAgo1 = new Date();
    fiveDaysAgo1.setDate(fiveDaysAgo1.getDate() - 5);
    fiveDaysAgo1.setHours(10, 0, 0, 0);

    const id1 = await insertManual(testUserId, 'basal', fiveDaysAgo1.toISOString());
    assert.ok(id1);

    // Attempt second basal on same calendar date
    const fiveDaysAgo2 = new Date();
    fiveDaysAgo2.setDate(fiveDaysAgo2.getDate() - 5);
    fiveDaysAgo2.setHours(14, 30, 0, 0);

    await assert.rejects(
      async () => {
        await insertManual(testUserId, 'basal', fiveDaysAgo2.toISOString());
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.message, 'You cannot have 2 basal injections in one day.');
        return true;
      }
    );
  });

  it('blocks logging a bolus injection at the exact same minute on the same day', async () => {
    const tenDaysAgo1 = new Date();
    tenDaysAgo1.setDate(tenDaysAgo1.getDate() - 10);
    tenDaysAgo1.setHours(13, 45, 0, 0);

    const id1 = await insertManual(testUserId, 'bolus', tenDaysAgo1.toISOString());
    assert.ok(id1);

    // Attempt duplicate bolus at exact same HH:MM
    const tenDaysAgo2 = new Date();
    tenDaysAgo2.setDate(tenDaysAgo2.getDate() - 10);
    tenDaysAgo2.setHours(13, 45, 30, 0); // same HH:MM (13:45)

    await assert.rejects(
      async () => {
        await insertManual(testUserId, 'bolus', tenDaysAgo2.toISOString());
      },
      (err) => {
        assert.strictEqual(err.status, 409);
        assert.strictEqual(err.message, "Can't add, this exact time already appears.");
        return true;
      }
    );
  });

  it('strictly caps bolus injections at 10 per day and rejects the 11th', async () => {
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    // Insert 10 bolus doses at different hours/minutes within daytime hours
    for (let i = 0; i < 10; i++) {
      const doseDate = new Date(fifteenDaysAgo);
      doseDate.setHours(8 + Math.floor(i / 2), (i % 2) * 30, 0, 0);
      await insertManual(testUserId, 'bolus', doseDate.toISOString());
    }

    // Attempt 11th bolus
    const eleventhDose = new Date(fifteenDaysAgo);
    eleventhDose.setHours(14, 0, 0, 0);

    await assert.rejects(
      async () => {
        await insertManual(testUserId, 'bolus', eleventhDose.toISOString());
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.message, 'Maximum 10 bolus injections allowed per day.');
        return true;
      }
    );
  });
});
