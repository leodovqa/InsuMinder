const express = require('express');
const cors = require('cors');
const db = require('./db');
const { sendTelegramMessage } = require('./telegram');
const scheduler = require('./scheduler');
const {
  isValidEmail,
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  createSessionToken,
  requireAuth,
  optionalAuth,
  resolveContext
} = require('./auth');
const { sendVerificationEmail, sendShareInviteEmail, EMAIL_ERROR_MESSAGE } = require('./email');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

/* =========================================================================
   AUTHENTICATION ENDPOINTS
   ========================================================================= */

// 1. Register with Email & Password (Triggers 6-digit verification email)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: EMAIL_ERROR_MESSAGE });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists (registered via Google or email)
    const existingUser = await new Promise((resolve, reject) => {
      db.getUserByEmail(cleanEmail, (err, user) => (err ? reject(err) : resolve(user)));
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'This email is already registered. Please log in.'
      });
    }

    // Generate 6-digit code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes expiry

    // Send verification email
    const emailResult = await sendVerificationEmail(cleanEmail, code);
    if (!emailResult.ok) {
      return res.status(400).json({
        success: false,
        error: emailResult.error || EMAIL_ERROR_MESSAGE
      });
    }

    // Hash password and store verification code
    const passwordHash = hashPassword(String(password));
    await new Promise((resolve, reject) => {
      db.createVerificationCode({
        email: cleanEmail,
        password_hash: passwordHash,
        code,
        expires_at: expiresAt
      }, (err, record) => (err ? reject(err) : resolve(record)));
    });

    res.json({
      success: true,
      email: cleanEmail,
      expiresAt,
      devCode: emailResult.devCode, // Included in dev mode for easy local verification
      message: 'Verification code sent to your email.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Registration failed.' });
  }
});

// 2. Verify 6-digit numeric verification code
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email and verification code are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const record = await new Promise((resolve, reject) => {
      db.getLatestVerificationCode(cleanEmail, (err, row) => (err ? reject(err) : resolve(row)));
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'No active verification request found. Please enter your email and password to start a new process.'
      });
    }

    // Check expiration (10 minutes)
    const isExpired = new Date().getTime() > new Date(record.expires_at).getTime();
    if (isExpired) {
      await new Promise((resolve) => db.consumeVerificationCode(record.id, resolve));
      return res.status(400).json({
        success: false,
        expired: true,
        error: 'Verification code has expired. Please enter your email and password to start a new verification process.'
      });
    }

    // Check code match
    if (record.code !== cleanCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please check your code and try again.'
      });
    }

    // If checkOnly is true, simply validate that code matches without consuming code or creating user yet
    if (req.body && req.body.checkOnly) {
      return res.json({
        success: true,
        verified: true
      });
    }

    const { firstName, lastName, phone } = req.body || {};
    const cleanFirst = firstName ? String(firstName).trim() : null;
    const cleanLast = lastName ? String(lastName).trim() : null;
    const cleanPhone = phone ? String(phone).trim() : null;

    if (!cleanFirst || !cleanLast) {
      return res.status(400).json({
        success: false,
        error: 'First name and last name are required to complete registration.'
      });
    }

    // Mark code as consumed
    await new Promise((resolve) => db.consumeVerificationCode(record.id, resolve));

    const fullName = `${cleanFirst} ${cleanLast}`.trim();

    // Create or update user
    let user = await new Promise((resolve, reject) => {
      db.getUserByEmail(cleanEmail, (err, u) => (err ? reject(err) : resolve(u)));
    });

    if (user && (user.is_verified || user.google_id || user.password_hash)) {
      return res.status(400).json({
        success: false,
        error: 'This email is already registered. Please log in.'
      });
    }

    if (user) {
      const updates = {
        password_hash: record.password_hash,
        auth_provider: 'email',
        is_verified: 1
      };
      if (cleanFirst) updates.first_name = cleanFirst;
      if (cleanLast) updates.last_name = cleanLast;
      if (cleanPhone) updates.phone = cleanPhone;
      if (cleanFirst || cleanLast) updates.name = fullName;

      await new Promise((resolve, reject) => {
        db.updateUser(user.id, updates, (err) => (err ? reject(err) : resolve()));
      });
      user = await new Promise((resolve, reject) => {
        db.getUserById(user.id, (err, u) => (err ? reject(err) : resolve(u)));
      });
    } else {
      user = await new Promise((resolve, reject) => {
        db.createUser({
          email: cleanEmail,
          password_hash: record.password_hash,
          auth_provider: 'email',
          name: fullName,
          first_name: cleanFirst,
          last_name: cleanLast,
          phone: cleanPhone,
          is_verified: 1
        }, (err, u) => (err ? reject(err) : resolve(u)));
      });
    }

    // If shareCode is provided, automatically join the shared group
    if (req.body && req.body.shareCode) {
      await new Promise((resolve) => {
        db.addSharedMemberByCode(req.body.shareCode, user.id, () => resolve());
      });
    }

    // Issue auth token
    const token = createSessionToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || cleanEmail.split('@')[0],
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
        shareCode: user.share_code || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Verification failed.' });
  }
});

// 3. Sign in with Email & Password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, shareCode } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const user = await new Promise((resolve, reject) => {
      db.getUserByEmail(cleanEmail, (err, u) => (err ? reject(err) : resolve(u)));
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid email or password' });
    }

    // Check account lockout (10 minutes after 5 failed attempts)
    if (user.locked_until) {
      const lockExpiry = new Date(user.locked_until).getTime();
      const now = Date.now();
      if (lockExpiry > now) {
        const remainingMinutes = Math.max(1, Math.ceil((lockExpiry - now) / 60000));
        return res.status(429).json({
          success: false,
          locked: true,
          error: `Too many failed login attempts. Your account has been locked. Please try again in ${remainingMinutes} minute(s).`
        });
      }
    }

    const isMatch = (user.is_verified && user.password_hash)
      ? verifyPassword(String(password), user.password_hash)
      : false;

    if (!isMatch) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await new Promise((resolve) => db.updateUser(user.id, { failed_login_attempts: attempts, locked_until: lockedUntil }, resolve));
        return res.status(429).json({
          success: false,
          locked: true,
          error: 'Too many failed login attempts. Your account has been locked for 10 minutes.'
        });
      } else {
        await new Promise((resolve) => db.updateUser(user.id, { failed_login_attempts: attempts }, resolve));
        return res.status(400).json({ success: false, error: 'Invalid email or password' });
      }
    }

    // Login successful: reset failed attempts and lockout
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await new Promise((resolve) => db.updateUser(user.id, { failed_login_attempts: 0, locked_until: null }, resolve));
    }

    if (shareCode) {
      await new Promise((resolve) => {
        db.addSharedMemberByCode(shareCode, user.id, () => resolve());
      });
    }

    const token = createSessionToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || cleanEmail.split('@')[0],
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
        shareCode: user.share_code || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Login failed.' });
  }
});

// 4. Google Sign-In (Supports real Google OAuth JWT and local test sign-in)
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential, dev, email: devEmail, name: devName, avatar: devAvatar, shareCode } = req.body || {};

    let userEmail = '';
    let userName = '';
    let userFirstName = '';
    let userLastName = '';
    let userPhone = '';
    let userAvatar = '';
    let googleId = '';

    if (dev || credential === 'dev-google-login') {
      // Local dev / test Google sign-in
      userEmail = (devEmail && String(devEmail).trim().toLowerCase()) || 'google.user@insuminder.app';
      userFirstName = req.body.firstName || (devName ? String(devName).split(' ')[0] : 'Google');
      userLastName = req.body.lastName || (devName && String(devName).split(' ').length > 1 ? String(devName).split(' ').slice(1).join(' ') : 'User');
      userName = devName || `${userFirstName} ${userLastName}`.trim();
      userPhone = req.body.phone || '';
      userAvatar = devAvatar || '';
      googleId = 'dev-google-' + userEmail;
    } else {
      // Parse Google JWT ID token
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          userEmail = payload.email ? payload.email.toLowerCase() : '';
          userFirstName = payload.given_name || (payload.name ? payload.name.split(' ')[0] : '');
          userLastName = payload.family_name || (payload.name && payload.name.split(' ').length > 1 ? payload.name.split(' ').slice(1).join(' ') : '');
          userName = payload.name || `${userFirstName} ${userLastName}`.trim() || 'Google User';
          userPhone = payload.phone_number || req.body.phone || '';
          userAvatar = payload.picture || '';
          googleId = payload.sub || '';
        }
      } catch {
        // Fallback to query google tokeninfo
        const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        const tokenInfo = await resp.json().catch(() => null);
        if (tokenInfo && tokenInfo.email) {
          userEmail = tokenInfo.email.toLowerCase();
          userFirstName = tokenInfo.given_name || (tokenInfo.name ? tokenInfo.name.split(' ')[0] : '');
          userLastName = tokenInfo.family_name || (tokenInfo.name && tokenInfo.name.split(' ').length > 1 ? tokenInfo.name.split(' ').slice(1).join(' ') : '');
          userName = tokenInfo.name || `${userFirstName} ${userLastName}`.trim() || 'Google User';
          userPhone = tokenInfo.phone_number || req.body.phone || '';
          userAvatar = tokenInfo.picture || '';
          googleId = tokenInfo.sub || '';
        }
      }

      if (!userEmail) {
        return res.status(400).json({ success: false, error: 'Failed to verify Google credentials.' });
      }
    }

    // Check if user exists by email or google_id
    let user = await new Promise((resolve, reject) => {
      db.getUserByEmail(userEmail, (err, u) => (err ? reject(err) : resolve(u)));
    });

    if (user) {
      // PRESERVE USER CUSTOM PROFILE:
      // If user has customized their profile, do NOT overwrite their name with Google default
      const updates = {
        google_id: googleId || user.google_id,
        avatar: userAvatar || user.avatar,
        is_verified: 1,
        failed_login_attempts: 0,
        locked_until: null
      };

      if (!user.first_name && userFirstName) {
        updates.first_name = userFirstName;
      }
      if (!user.last_name && userLastName) {
        updates.last_name = userLastName;
      }
      if (!user.phone && userPhone) {
        updates.phone = userPhone;
      }
      if (!user.name) {
        updates.name = userName;
      }

      await new Promise((resolve, reject) => {
        db.updateUser(user.id, updates, (err) => (err ? reject(err) : resolve()));
      });
      user = await new Promise((resolve, reject) => {
        db.getUserById(user.id, (err, u) => (err ? reject(err) : resolve(u)));
      });
    } else {
      user = await new Promise((resolve, reject) => {
        db.createUser({
          email: userEmail,
          google_id: googleId,
          auth_provider: 'google',
          name: userName,
          first_name: userFirstName,
          last_name: userLastName,
          phone: userPhone,
          avatar: userAvatar,
          is_verified: 1
        }, (err, u) => (err ? reject(err) : resolve(u)));
      });
    }

    if (shareCode) {
      await new Promise((resolve) => {
        db.addSharedMemberByCode(shareCode, user.id, () => resolve());
      });
    }

    const token = createSessionToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || userEmail.split('@')[0],
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        phone: user.phone || '',
        avatar: user.avatar || '',
        shareCode: user.share_code || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Google authentication failed.' });
  }
});

// 5. Get Current Authenticated User
app.get('/api/auth/me', requireAuth, (req, res) => {
  db.getUserById(req.user.id, (err, user) => {
    if (err || !user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    db.ensureShareCode(user.id, (codeErr, shareCode) => {
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          phone: user.phone || '',
          avatar: user.avatar || '',
          shareCode: shareCode || user.share_code || ''
        }
      });
    });
  });
});

// 6. Update User Profile (Onboarding Step & Profile Updates)
const handleProfileUpdate = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body || {};

    const cleanFirstName = String(firstName || '').trim();
    const cleanLastName = String(lastName || '').trim();
    const cleanPhone = String(phone || '').trim();

    if (!cleanFirstName || !cleanLastName) {
      return res.status(400).json({
        success: false,
        error: 'First name and last name are required.'
      });
    }

    const fullName = `${cleanFirstName} ${cleanLastName}`.trim();

    await new Promise((resolve, reject) => {
      db.updateUser(req.user.id, {
        name: fullName,
        first_name: cleanFirstName,
        last_name: cleanLastName,
        phone: cleanPhone || null
      }, (err) => (err ? reject(err) : resolve()));
    });

    const updatedUser = await new Promise((resolve, reject) => {
      db.getUserById(req.user.id, (err, u) => (err ? reject(err) : resolve(u)));
    });

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name || fullName,
        firstName: updatedUser.first_name || cleanFirstName,
        lastName: updatedUser.last_name || cleanLastName,
        phone: updatedUser.phone || '',
        avatar: updatedUser.avatar || '',
        shareCode: updatedUser.share_code || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update profile.' });
  }
};

app.put('/api/auth/profile', requireAuth, handleProfileUpdate);
app.post('/api/auth/profile', requireAuth, handleProfileUpdate);

// 7. Sign out
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

/* =========================================================================
   USER-SCOPED DATA ENDPOINTS
   ========================================================================= */

// Injections API: Log injection (Requires authentication, supports shared context)
app.post('/api/injections', requireAuth, resolveContext, (req, res) => {
  const targetUserId = req.effectiveUserId || req.user.id;
  db.insertInjectionLog(targetUserId, function(err) {
    if (err) {
      const status = err.status || 500;
      res.status(status).json({ success: false, error: err.message });
    } else {
      scheduler.checkAndDispatchNotifications();
      res.json({ success: true, id: this.lastID });
    }
  });
});

// Injection Logs API: Scoped to user or shared group
app.get('/api/logs', optionalAuth, resolveContext, (req, res) => {
  if (!req.user || !req.user.id) {
    // When logged out: return empty list so unauthenticated visitors see clean empty state
    return res.json({ success: true, logs: [] });
  }

  const targetUserId = req.effectiveUserId || req.user.id;
  db.getLogsFromLast24Hours(targetUserId, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, logs: rows || [] });
    }
  });
});

// Telegram Configurations API: Scoped to user or shared group
app.get('/api/telegram-configs', optionalAuth, resolveContext, (req, res) => {
  if (!req.user || !req.user.id) {
    return res.json({ success: true, configs: [] });
  }

  const targetUserId = req.effectiveUserId || req.user.id;
  db.getTelegramConfigs(targetUserId, (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    const configs = (rows || []).map(r => ({
      id: r.id,
      name: r.name || `Chat (${r.chat_id})`,
      botToken: r.bot_token,
      chatId: r.chat_id,
      isDefault: Boolean(r.is_default),
      createdAt: r.created_at
    }));
    res.json({ success: true, configs });
  });
});

app.post('/api/telegram-configs', requireAuth, resolveContext, (req, res) => {
  const { name, botToken, chatId } = req.body || {};
  if (!botToken || !chatId || !String(botToken).trim() || !String(chatId).trim()) {
    return res.status(400).json({
      success: false,
      error: 'Bot Token and Chat ID are required.'
    });
  }

  const rawChatId = String(chatId).trim().replace(/^-+/, '');
  const cleanChatId = `-${rawChatId}`;
  const targetUserId = req.effectiveUserId || req.user.id;

  db.addTelegramConfig(targetUserId, {
    name: name ? String(name).trim() : '',
    bot_token: String(botToken).trim(),
    chat_id: cleanChatId
  }, (err, newConfig) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    scheduler.checkAndDispatchNotifications();

    res.json({
      success: true,
      config: {
        id: newConfig.id,
        name: newConfig.name,
        botToken: newConfig.bot_token,
        chatId: newConfig.chat_id,
        isDefault: Boolean(newConfig.is_default)
      }
    });
  });
});

app.put('/api/telegram-configs/:id/default', requireAuth, resolveContext, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid configuration ID.' });
  }

  const targetUserId = req.effectiveUserId || req.user.id;
  db.setDefaultTelegramConfig(targetUserId, id, (err, updated) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    scheduler.checkAndDispatchNotifications();

    res.json({
      success: true,
      config: updated ? {
        id: updated.id,
        name: updated.name,
        botToken: updated.bot_token,
        chatId: updated.chat_id,
        isDefault: Boolean(updated.is_default)
      } : null
    });
  });
});

app.delete('/api/telegram-configs/:id', requireAuth, resolveContext, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid configuration ID.' });
  }

  const targetUserId = req.effectiveUserId || req.user.id;
  db.deleteTelegramConfig(targetUserId, id, (err) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true });
  });
});

/* =========================================================================
   SHARED ACCESS & CAREGIVER / FAMILY SHARING ENDPOINTS
   ========================================================================= */

// 1. Get Share Status, Members, and Connected Shared Accounts
app.get('/api/share/status', requireAuth, (req, res) => {
  db.getShareStatus(req.user.id, (err, status) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({
      success: true,
      ...status
    });
  });
});

// 2. Invite User by Email
app.post('/api/share/invite', requireAuth, async (req, res) => {
  try {
    const { email, inviteUrl } = req.body || {};
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, error: 'Recipient email is required.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: EMAIL_ERROR_MESSAGE });
    }

    const shareCode = await new Promise((resolve, reject) => {
      db.ensureShareCode(req.user.id, (err, code) => (err ? reject(err) : resolve(code)));
    });

    await new Promise((resolve, reject) => {
      db.createShareInvite(req.user.id, cleanEmail, (err, invite) => (err ? reject(err) : resolve(invite)));
    });

    const fallbackUrl = `${req.protocol}://${req.get('host')}/?shareCode=${shareCode}`;
    const finalInviteUrl = inviteUrl || fallbackUrl;

    const emailRes = await sendShareInviteEmail(
      cleanEmail,
      req.user.name,
      req.user.email,
      shareCode,
      finalInviteUrl
    );

    if (!emailRes.ok) {
      return res.status(400).json({ success: false, error: emailRes.error || EMAIL_ERROR_MESSAGE });
    }

    res.json({
      success: true,
      message: `Invitation sent to ${cleanEmail}!`,
      shareCode,
      inviteUrl: finalInviteUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to send invite.' });
  }
});

// 3. Join Shared Account via Share Code
app.post('/api/share/join', requireAuth, (req, res) => {
  const { shareCode } = req.body || {};
  if (!shareCode || !String(shareCode).trim()) {
    return res.status(400).json({ success: false, error: 'Share code is required.' });
  }

  db.addSharedMemberByCode(String(shareCode).trim(), req.user.id, (err, result) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.json({
      success: true,
      message: `Successfully connected to shared account (${result.ownerEmail})!`,
      owner: result
    });
  });
});

// 4. Admin removes a member from their group
app.delete('/api/share/members/:memberId', requireAuth, (req, res) => {
  const memberId = parseInt(req.params.memberId, 10);
  if (isNaN(memberId)) {
    return res.status(400).json({ success: false, error: 'Invalid member ID.' });
  }

  db.removeSharedMember(req.user.id, memberId, (err) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, message: 'Member removed from shared group.' });
  });
});

// 5. Member leaves a shared group
app.post('/api/share/leave', requireAuth, (req, res) => {
  const { ownerId } = req.body || {};
  const cleanOwnerId = parseInt(ownerId, 10);
  if (isNaN(cleanOwnerId)) {
    return res.status(400).json({ success: false, error: 'Invalid owner ID.' });
  }

  db.leaveSharedGroup(cleanOwnerId, req.user.id, (err) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, message: 'You have left the shared group.' });
  });
});

// Settings API (Backward compatibility)
app.get('/api/settings', optionalAuth, (req, res) => {
  const userId = req.user ? req.user.id : null;
  db.getDefaultTelegramConfig(userId, (err, active) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({
      success: true,
      settings: {
        telegramBotToken: active ? active.bot_token : '',
        telegramChatId: active ? active.chat_id : ''
      }
    });
  });
});

app.post('/api/settings', optionalAuth, (req, res) => {
  const userId = req.user ? req.user.id : null;
  const { telegramBotToken, telegramChatId, name } = req.body || {};
  if (!telegramBotToken || !telegramChatId || !String(telegramBotToken).trim() || !String(telegramChatId).trim()) {
    return res.status(400).json({ success: false, error: 'Bot Token and Chat ID are required.' });
  }

  const rawChatId = String(telegramChatId).trim().replace(/^-+/, '');
  const cleanChatId = `-${rawChatId}`;

  db.addTelegramConfig(userId, {
    name: name || '',
    bot_token: String(telegramBotToken).trim(),
    chat_id: cleanChatId
  }, (err) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    scheduler.checkAndDispatchNotifications();

    res.json({ success: true });
  });
});

// Test Telegram notification API
app.post('/api/telegram/test', optionalAuth, async (req, res) => {
  try {
    let { telegramBotToken, telegramChatId, configId } = req.body || {};
    const userId = req.user ? req.user.id : null;

    if (configId) {
      const configs = await new Promise((resolve, reject) => {
        db.getTelegramConfigs(userId, (err, rows) => (err ? reject(err) : resolve(rows || [])));
      });
      const found = configs.find(c => c.id === parseInt(configId, 10));
      if (found) {
        telegramBotToken = found.bot_token;
        telegramChatId = found.chat_id;
      }
    }

    if (!telegramBotToken || !telegramChatId) {
      // Fallback to active default configuration
      const active = await new Promise((resolve, reject) => {
        db.getDefaultTelegramConfig(userId, (err, result) => (err ? reject(err) : resolve(result)));
      });
      if (active) {
        telegramBotToken = active.bot_token;
        telegramChatId = active.chat_id;
      }
    }

    if (!telegramBotToken || !telegramChatId) {
      return res.status(400).json({
        success: false,
        error: 'Both Bot Token and Chat ID are required to send a test message.'
      });
    }

    const testMessage = "From InsuMinder:\nTelegram connection successful! Your injection reminders are active.";
    const result = await sendTelegramMessage(telegramBotToken, telegramChatId, testMessage);

    if (result.ok) {
      res.json({ success: true, message: 'Test message sent successfully!' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start scheduler worker
scheduler.startScheduler(30000);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
