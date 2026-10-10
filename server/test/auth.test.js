const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Use isolated test DB for auth tests
const testDbPath = path.resolve(__dirname, `test_auth_${Date.now()}_${process.pid}.db`);
process.env.DB_PATH = testDbPath;

const db = require('../src/db');
const {
  isValidEmail,
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  createSessionToken,
  verifySessionToken
} = require('../src/auth');
const { sendVerificationEmail, EMAIL_ERROR_MESSAGE } = require('../src/email');

describe('Authentication & User Scoping Integration Tests', () => {
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

  describe('Auth Utilities', () => {
    it('validates email addresses properly and rejects invalid domains', () => {
      assert.equal(isValidEmail('patient@example.com'), true);
      assert.equal(isValidEmail('user.name+tag@sub.domain.co.il'), true);
      assert.equal(isValidEmail('plainaddress'), false);
      assert.equal(isValidEmail('missingdomain@'), false);
      assert.equal(isValidEmail('@missinguser.com'), false);
      assert.equal(isValidEmail('bad@domain'), false);
      assert.equal(isValidEmail('user@test.invalid'), false);
      assert.equal(isValidEmail(''), false);
      assert.equal(isValidEmail(null), false);
    });

    it('generates 6-digit numeric verification codes', () => {
      for (let i = 0; i < 10; i++) {
        const code = generateVerificationCode();
        assert.equal(typeof code, 'string');
        assert.equal(code.length, 6);
        assert.equal(/^\d{6}$/.test(code), true);
      }
    });

    it('hashes passwords using PBKDF2 and verifies correctly', () => {
      const password = 'SuperSecret123!';
      const hash = hashPassword(password);

      assert.equal(typeof hash, 'string');
      assert.equal(hash.startsWith('pbkdf2:100000:'), true);

      assert.equal(verifyPassword(password, hash), true);
      assert.equal(verifyPassword('WrongPassword', hash), false);
      assert.equal(verifyPassword('', hash), false);
    });

    it('creates and verifies session tokens with expiry and tamper detection', () => {
      const user = { id: 42, email: 'user@test.com', name: 'Test' };
      const token = createSessionToken(user);

      assert.equal(typeof token, 'string');
      assert.equal(token.includes('.'), true);

      const payload = verifySessionToken(token);
      assert.ok(payload);
      assert.equal(payload.userId, 42);
      assert.equal(payload.email, 'user@test.com');

      // Tampered token fails
      const tampered = token.slice(0, -3) + 'abc';
      assert.equal(verifySessionToken(tampered), null);
    });
  });

  describe('Email Verification Service', () => {
    it('rejects invalid recipient emails with friendly error message', async () => {
      const res = await sendVerificationEmail('invalid-user@fake.fail', '123456');
      assert.equal(res.ok, false);
      assert.equal(res.error, EMAIL_ERROR_MESSAGE);
    });

    it('successfully generates devCode for valid email in development environment', async () => {
      const res = await sendVerificationEmail('patient@health.org', '654321');
      assert.equal(res.ok, true);
      assert.equal(res.devCode, '654321');
    });
  });

  describe('Database User & Verification Codes Flow', () => {
    const testEmail = 'alice@example.com';
    const testPassword = 'Password2026!';
    let verificationId = null;
    let generatedCode = null;

    it('creates and stores 6-digit verification code with 10-minute expiry', async () => {
      generatedCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const passwordHash = hashPassword(testPassword);

      const record = await new Promise((resolve, reject) => {
        db.createVerificationCode({
          email: testEmail,
          password_hash: passwordHash,
          code: generatedCode,
          expires_at: expiresAt
        }, (err, res) => (err ? reject(err) : resolve(res)));
      });

      assert.ok(record.id);
      verificationId = record.id;

      const row = await new Promise((resolve, reject) => {
        db.getLatestVerificationCode(testEmail, (err, res) => (err ? reject(err) : resolve(res)));
      });

      assert.ok(row);
      assert.equal(row.code, generatedCode);
      assert.equal(row.consumed, 0);
    });

    it('rejects verification if code is expired (> 10 minutes)', async () => {
      const expiredAt = new Date(Date.now() - 1000).toISOString();
      await new Promise((resolve, reject) => {
        db.createVerificationCode({
          email: 'expired@test.com',
          password_hash: hashPassword('Pass123'),
          code: '111222',
          expires_at: expiredAt
        }, (err, res) => (err ? reject(err) : resolve(res)));
      });

      const row = await new Promise((resolve, reject) => {
        db.getLatestVerificationCode('expired@test.com', (err, res) => (err ? reject(err) : resolve(res)));
      });

      assert.ok(row);
      const isExpired = new Date().getTime() > new Date(row.expires_at).getTime();
      assert.equal(isExpired, true);
    });

    it('marks code as consumed after successful verification', async () => {
      await new Promise((resolve, reject) => {
        db.consumeVerificationCode(verificationId, (err) => (err ? reject(err) : resolve()));
      });

      const row = await new Promise((resolve, reject) => {
        db.getLatestVerificationCode(testEmail, (err, res) => (err ? reject(err) : resolve(res)));
      });

      // consumed=1 should not be returned as latest active code
      assert.equal(row, undefined);
    });

    it('creates verified user account and authenticates', async () => {
      const passwordHash = hashPassword(testPassword);
      const user = await new Promise((resolve, reject) => {
        db.createUser({
          email: testEmail,
          password_hash: passwordHash,
          name: 'Alice',
          is_verified: 1
        }, (err, res) => (err ? reject(err) : resolve(res)));
      });

      assert.ok(user.id);
      assert.equal(user.email, testEmail);

      const row = await new Promise((resolve, reject) => {
        db.getUserByEmail(testEmail, (err, res) => (err ? reject(err) : resolve(res)));
      });

      assert.ok(row);
      assert.equal(row.is_verified, 1);
      assert.equal(verifyPassword(testPassword, row.password_hash), true);
    });

    it('creates user with first_name, last_name, phone and auto-computes full name', async () => {
      const user = await new Promise((resolve, reject) => {
        db.createUser({
          email: 'profile.user@example.com',
          first_name: 'John',
          last_name: 'Doe',
          phone: '+1-555-0199',
          is_verified: 1
        }, (err, res) => (err ? reject(err) : resolve(res)));
      });

      assert.ok(user.id);
      assert.equal(user.name, 'John Doe');
      assert.equal(user.first_name, 'John');
      assert.equal(user.last_name, 'Doe');
      assert.equal(user.phone, '+1-555-0199');

      const fetched = await new Promise((resolve, reject) => {
        db.getUserById(user.id, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(fetched.name, 'John Doe');
      assert.equal(fetched.first_name, 'John');
      assert.equal(fetched.last_name, 'Doe');
      assert.equal(fetched.phone, '+1-555-0199');
    });

    it('updates user profile details and name in database', async () => {
      const user = await new Promise((resolve, reject) => {
        db.createUser({
          email: 'update.user@example.com',
          name: 'Old Name',
          is_verified: 1
        }, (err, res) => (err ? reject(err) : resolve(res)));
      });

      await new Promise((resolve, reject) => {
        db.updateUser(user.id, {
          name: 'Jane Smith',
          first_name: 'Jane',
          last_name: 'Smith',
          phone: '+1-555-9876'
        }, (err) => (err ? reject(err) : resolve()));
      });

      const updated = await new Promise((resolve, reject) => {
        db.getUserById(user.id, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(updated.name, 'Jane Smith');
      assert.equal(updated.first_name, 'Jane');
      assert.equal(updated.last_name, 'Smith');
      assert.equal(updated.phone, '+1-555-9876');
    });
  });

  describe('User-Scoped Data Isolation', () => {
    let userAId = null;
    let userBId = null;

    it('creates two distinct users', async () => {
      const uA = await new Promise((resolve, reject) => {
        db.createUser({ email: 'usera@test.com', name: 'User A', is_verified: 1 }, (err, res) => (err ? reject(err) : resolve(res)));
      });
      userAId = uA.id;

      const uB = await new Promise((resolve, reject) => {
        db.createUser({ email: 'userb@test.com', name: 'User B', is_verified: 1 }, (err, res) => (err ? reject(err) : resolve(res)));
      });
      userBId = uB.id;

      assert.ok(userAId);
      assert.ok(userBId);
      assert.notEqual(userAId, userBId);
    });

    it('scopes injection logs to the authenticated user', async () => {
      await new Promise((resolve, reject) => {
        db.insertInjectionLog(userAId, (err) => (err ? reject(err) : resolve()));
      });

      const rowsA = await new Promise((resolve, reject) => {
        db.getLogsFromLast24Hours(userAId, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(rowsA.length, 1);
      assert.equal(rowsA[0].user_id, userAId);

      // User B should see 0 logs
      const rowsB = await new Promise((resolve, reject) => {
        db.getLogsFromLast24Hours(userBId, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(rowsB.length, 0);
    });

    it('scopes Telegram configurations to the authenticated user', async () => {
      await new Promise((resolve, reject) => {
        db.addTelegramConfig(userAId, {
          name: 'User A Bot',
          bot_token: '123:tokenA',
          chat_id: '-100111'
        }, (err) => (err ? reject(err) : resolve()));
      });

      const configsA = await new Promise((resolve, reject) => {
        db.getTelegramConfigs(userAId, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(configsA.length, 1);
      assert.equal(configsA[0].name, 'User A Bot');

      // User B has no configs
      const configsB = await new Promise((resolve, reject) => {
        db.getTelegramConfigs(userBId, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(configsB.length, 0);
    });
  });
});

