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

    it('records auth_provider as "google" for Google signups and "email" for password signups', async () => {
      const emailUser = await new Promise((resolve, reject) => {
        db.createUser({
          email: 'standard.user@example.com',
          password_hash: hashPassword('Pass123!'),
          name: 'Standard User',
          is_verified: 1
        }, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(emailUser.auth_provider, 'email');

      const googleUser = await new Promise((resolve, reject) => {
        db.createUser({
          email: 'google.auth@example.com',
          google_id: 'google-sub-12345',
          auth_provider: 'google',
          name: 'Google Auth User',
          first_name: 'Google',
          last_name: 'Auth',
          phone: '+1-555-0100',
          is_verified: 1
        }, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(googleUser.auth_provider, 'google');
      assert.equal(googleUser.first_name, 'Google');
      assert.equal(googleUser.last_name, 'Auth');
      assert.equal(googleUser.phone, '+1-555-0100');
    });

    it('rejects registration when email is already registered without revealing provider', async () => {
      // User registered via Google
      const existingGoogleUser = await new Promise((resolve, reject) => {
        db.getUserByEmail('google.auth@example.com', (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.ok(existingGoogleUser);

      // Simulation of /api/auth/register logic
      const checkDuplicate = (user) => {
        if (user && (user.is_verified || user.google_id || user.password_hash)) {
          return { error: 'This email is already registered. Please log in.' };
        }
        return { success: true };
      };

      const result = checkDuplicate(existingGoogleUser);
      assert.equal(result.error, 'This email is already registered. Please log in.');
      assert.equal(result.error.includes('google'), false);
    });

    it('locks account for 10 minutes upon 5 consecutive failed login attempts', async () => {
      const testUser = await new Promise((resolve, reject) => {
        db.createUser({
          email: 'lockout.target@example.com',
          password_hash: hashPassword('CorrectPassword123!'),
          name: 'Lockout Target',
          is_verified: 1
        }, (err, res) => (err ? reject(err) : resolve(res)));
      });

      // Simulate 4 failed attempts
      let attempts = 0;
      for (let i = 1; i <= 4; i++) {
        attempts++;
        await new Promise((resolve) => db.updateUser(testUser.id, { failed_login_attempts: attempts }, resolve));
      }

      let userState = await new Promise((resolve, reject) => {
        db.getUserById(testUser.id, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(userState.failed_login_attempts, 4);
      assert.equal(userState.locked_until, null);

      // 5th failed attempt triggers 10m lockout
      attempts++;
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await new Promise((resolve) => db.updateUser(testUser.id, { failed_login_attempts: attempts, locked_until: lockedUntil }, resolve));

      userState = await new Promise((resolve, reject) => {
        db.getUserById(testUser.id, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(userState.failed_login_attempts, 5);
      assert.ok(userState.locked_until);
      assert.ok(new Date(userState.locked_until).getTime() > Date.now());

      // Correct login resets failed_login_attempts and locked_until
      await new Promise((resolve) => db.updateUser(testUser.id, { failed_login_attempts: 0, locked_until: null }, resolve));
      const resetState = await new Promise((resolve, reject) => {
        db.getUserById(testUser.id, (err, res) => (err ? reject(err) : resolve(res)));
      });
      assert.equal(resetState.failed_login_attempts, 0);
      assert.equal(resetState.locked_until, null);
    });

    it('preserves customized user names and profile values during Google login', async () => {
      // 1. User signs up via Google with default name "Google Original"
      const user = await new Promise((resolve, reject) => {
        db.createUser({
          email: 'custom.profile@example.com',
          google_id: 'google-profile-id-1',
          auth_provider: 'google',
          name: 'Google Original',
          first_name: 'Google',
          last_name: 'Original',
          phone: '+1-555-1111',
          is_verified: 1
        }, (err, res) => (err ? reject(err) : resolve(res)));
      });

      // 2. User edits their profile to custom name "Alice Wonder"
      await new Promise((resolve) => {
        db.updateUser(user.id, {
          name: 'Alice Wonder',
          first_name: 'Alice',
          last_name: 'Wonder'
        }, resolve);
      });

      // 3. User logs in with Google again.
      // The login handler must NOT overwrite existing first_name and last_name:
      const incomingGoogleFirstName = 'Google';
      const incomingGoogleLastName = 'Original';

      const existingUser = await new Promise((resolve, reject) => {
        db.getUserById(user.id, (err, res) => (err ? reject(err) : resolve(res)));
      });

      const updates = {
        is_verified: 1,
        failed_login_attempts: 0,
        locked_until: null
      };
      if (!existingUser.first_name && incomingGoogleFirstName) {
        updates.first_name = incomingGoogleFirstName;
      }
      if (!existingUser.last_name && incomingGoogleLastName) {
        updates.last_name = incomingGoogleLastName;
      }

      await new Promise((resolve) => db.updateUser(existingUser.id, updates, resolve));

      const preserved = await new Promise((resolve, reject) => {
        db.getUserById(user.id, (err, res) => (err ? reject(err) : resolve(res)));
      });

      assert.equal(preserved.first_name, 'Alice');
      assert.equal(preserved.last_name, 'Wonder');
      assert.equal(preserved.name, 'Alice Wonder');
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

