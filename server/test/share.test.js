const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Unique temporary test database per test run
const testDbPath = path.resolve(__dirname, `test_share_${Date.now()}_${process.pid}.db`);
process.env.DB_PATH = testDbPath;
process.env.AUTH_SECRET = 'test-secret-share-key-2026';

const db = require('../src/db');
const { generateShareCode } = require('../src/db');
const { sendShareInviteEmail } = require('../src/email');

describe('Caregiver & Family Shared Access Database & Service Tests', () => {
  before(async () => {
    // Wait for DB initialization
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  after(() => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // Ignore file lock cleanup errors on Windows
      }
    }
  });

  let patientId = null;
  let caregiverId = null;
  let patientShareCode = null;

  it('generates properly formatted share codes (INSU-XXXXXX)', () => {
    for (let i = 0; i < 10; i++) {
      const code = generateShareCode();
      assert.equal(typeof code, 'string');
      assert.equal(code.startsWith('INSU-'), true);
      assert.equal(code.length, 11);
      assert.match(code, /^INSU-[A-Z0-9]{6}$/);
    }
  });

  it('creates two distinct users and automatically assigns share codes', async () => {
    const p = await new Promise((resolve, reject) => {
      db.createUser({ email: 'patient@clinic.org', name: 'Patient Jane', is_verified: 1 }, (err, res) => (err ? reject(err) : resolve(res)));
    });
    patientId = p.id;
    assert.ok(patientId);
    assert.ok(p.share_code);
    assert.match(p.share_code, /^INSU-/);
    patientShareCode = p.share_code;

    const c = await new Promise((resolve, reject) => {
      db.createUser({ email: 'caregiver@family.org', name: 'Caregiver Bob', is_verified: 1 }, (err, res) => (err ? reject(err) : resolve(res)));
    });
    caregiverId = c.id;
    assert.ok(caregiverId);
    assert.ok(c.share_code);
    assert.notEqual(patientShareCode, c.share_code);
  });

  it('ensures share code for existing user without regenerating if already present', async () => {
    const code = await new Promise((resolve, reject) => {
      db.ensureShareCode(patientId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(code, patientShareCode);
  });

  it('initially reports empty members and empty sharedGroups for Patient', async () => {
    const status = await new Promise((resolve, reject) => {
      db.getShareStatus(patientId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(status.shareCode, patientShareCode);
    assert.deepEqual(status.members, []);
    assert.deepEqual(status.sharedGroups, []);
  });

  it('validates and sends share invite emails', async () => {
    // 1. Invalid email rejected
    const invalidRes = await sendShareInviteEmail('bad-email@fail.invalid', 'Patient Jane', 'patient@clinic.org', patientShareCode, 'http://localhost');
    assert.equal(invalidRes.ok, false);

    // 2. Valid email succeeds in dev/test fallback
    const validRes = await sendShareInviteEmail('caregiver@family.org', 'Patient Jane', 'patient@clinic.org', patientShareCode, 'http://localhost/?shareCode=' + patientShareCode);
    assert.equal(validRes.ok, true);

    // 3. Record invite in database
    const invite = await new Promise((resolve, reject) => {
      db.createShareInvite(patientId, 'caregiver@family.org', (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(invite.inviteEmail, 'caregiver@family.org');
    assert.equal(invite.shareCode, patientShareCode);
  });

  it('rejects joining with invalid share code or joining own group', async () => {
    // 1. Invalid share code
    await assert.rejects(
      () => new Promise((resolve, reject) => {
        db.addSharedMemberByCode('INSU-NONEXISTENT', caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
      }),
      /Invalid share code/i
    );

    // 2. Self join rejected
    await assert.rejects(
      () => new Promise((resolve, reject) => {
        db.addSharedMemberByCode(patientShareCode, patientId, (err, res) => (err ? reject(err) : resolve(res)));
      }),
      /cannot join your own shared group/i
    );
  });

  it('successfully joins caregiver to patient shared group via share code', async () => {
    const result = await new Promise((resolve, reject) => {
      db.addSharedMemberByCode(patientShareCode, caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(result.ownerId, patientId);
    assert.equal(result.ownerEmail, 'patient@clinic.org');

    const isMember = await new Promise((resolve, reject) => {
      db.isSharedMember(patientId, caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(isMember, true);
  });

  it('updates getShareStatus for both owner and caregiver', async () => {
    // Patient sees caregiver in members
    const patientStatus = await new Promise((resolve, reject) => {
      db.getShareStatus(patientId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(patientStatus.members.length, 1);
    assert.equal(patientStatus.members[0].id, caregiverId);
    assert.equal(patientStatus.members[0].email, 'caregiver@family.org');

    // Caregiver sees patient in sharedGroups
    const caregiverStatus = await new Promise((resolve, reject) => {
      db.getShareStatus(caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(caregiverStatus.sharedGroups.length, 1);
    assert.equal(caregiverStatus.sharedGroups[0].ownerId, patientId);
    assert.equal(caregiverStatus.sharedGroups[0].ownerEmail, 'patient@clinic.org');
  });

  it('allows member to access owner logs while keeping personal logs separate', async () => {
    // Patient logs an injection
    await new Promise((resolve, reject) => {
      db.insertInjectionLog(patientId, (err) => (err ? reject(err) : resolve()));
    });

    // Caregiver logs a personal injection
    await new Promise((resolve, reject) => {
      db.insertInjectionLog(caregiverId, (err) => (err ? reject(err) : resolve()));
    });

    // When caregiver views their personal logs
    const personalLogs = await new Promise((resolve, reject) => {
      db.getLogsFromLast24Hours(caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(personalLogs.length, 1);
    assert.equal(personalLogs[0].user_id, caregiverId);

    // When caregiver views shared logs (effectiveUserId is patientId after isSharedMember check)
    const isMember = await new Promise((resolve, reject) => {
      db.isSharedMember(patientId, caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(isMember, true);

    const sharedLogs = await new Promise((resolve, reject) => {
      db.getLogsFromLast24Hours(patientId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(sharedLogs.length, 1);
    assert.equal(sharedLogs[0].user_id, patientId);
  });

  it('owner can remove member from group', async () => {
    await new Promise((resolve, reject) => {
      db.removeSharedMember(patientId, caregiverId, (err) => (err ? reject(err) : resolve()));
    });

    const isMember = await new Promise((resolve, reject) => {
      db.isSharedMember(patientId, caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(isMember, false);

    const patientStatus = await new Promise((resolve, reject) => {
      db.getShareStatus(patientId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(patientStatus.members.length, 0);
  });

  it('caregiver can rejoin and leave group', async () => {
    // Rejoin
    await new Promise((resolve, reject) => {
      db.addSharedMemberByCode(patientShareCode, caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
    });

    let isMember = await new Promise((resolve, reject) => {
      db.isSharedMember(patientId, caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(isMember, true);

    // Leave
    await new Promise((resolve, reject) => {
      db.leaveSharedGroup(patientId, caregiverId, (err) => (err ? reject(err) : resolve()));
    });

    isMember = await new Promise((resolve, reject) => {
      db.isSharedMember(patientId, caregiverId, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.equal(isMember, false);
  });
});
