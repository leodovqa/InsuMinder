import { ensureTablesExist } from '../_telegram.js';
import { verifyPassword, createSessionToken, generateShareCode, hashPassword } from '../_auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding (DB) is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  await ensureTablesExist(db);

  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, shareCode } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, error: 'Email and password are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let cleanEmail = String(email).trim().toLowerCase();
    if (cleanEmail === 'qa-tester') {
      cleanEmail = 'qa@insuminder.com';
    }

    // Dedicated QA test user for in-app diagnostics and mobile validation
    const QA_EMAIL = 'qa@insuminder.com';
    const isQaAttempt = cleanEmail === QA_EMAIL && String(password) === 'A123456!';

    let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail).first();

    if (!user && isQaAttempt) {
      const qaHash = await hashPassword('A123456!');
      const newCode = generateShareCode();
      try {
        await db.prepare(
          'INSERT INTO users (email, password_hash, name, is_verified, share_code) VALUES (?, ?, ?, 1, ?)'
        ).bind(QA_EMAIL, qaHash, 'QA Tester', newCode).run();
        user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(QA_EMAIL).first();
      } catch (e) {
        void e;
      }
    }

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check account lockout (10 minutes after 5 failed attempts) - bypass for QA tester
    if (user.locked_until && !isQaAttempt) {
      const lockExpiry = new Date(user.locked_until).getTime();
      const now = Date.now();
      if (lockExpiry > now) {
        const remainingMinutes = Math.max(1, Math.ceil((lockExpiry - now) / 60000));
        return new Response(JSON.stringify({
          success: false,
          locked: true,
          error: `Too many failed login attempts. Your account has been locked. Please try again in ${remainingMinutes} minute(s).`
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const isMatch = isQaAttempt
      ? true
      : ((user.is_verified && user.password_hash)
        ? await verifyPassword(String(password), user.password_hash)
        : false);

    if (!isMatch) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?')
          .bind(attempts, lockedUntil, user.id)
          .run();
        return new Response(JSON.stringify({
          success: false,
          locked: true,
          error: 'Too many failed login attempts. Your account has been locked for 10 minutes.'
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        await db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?')
          .bind(attempts, user.id)
          .run();
        return new Response(JSON.stringify({ success: false, error: 'Invalid email or password' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Reset failed attempts upon successful login
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?')
        .bind(user.id)
        .run();
    }

    if (!user.share_code) {
      const newCode = generateShareCode();
      await db.prepare('UPDATE users SET share_code = ? WHERE id = ?').bind(newCode, user.id).run();
      user.share_code = newCode;
    }

    let joinedGroup = null;
    if (shareCode && String(shareCode).trim()) {
      const cleanShare = String(shareCode).trim().toUpperCase();
      const owner = await db.prepare('SELECT id, email, name FROM users WHERE share_code = ?').bind(cleanShare).first();
      if (owner && owner.id !== user.id) {
        const existing = await db.prepare('SELECT id FROM shared_members WHERE owner_id = ? AND member_id = ?').bind(owner.id, user.id).first();
        if (!existing) {
          await db.prepare('INSERT INTO shared_members (owner_id, member_id) VALUES (?, ?)').bind(owner.id, user.id).run();
        }
        joinedGroup = {
          ownerId: owner.id,
          ownerEmail: owner.email,
          ownerName: owner.name || owner.email.split('@')[0]
        };
      }
    }

    let userTherapyMode = user.therapy_mode;
    if (!userTherapyMode) {
      userTherapyMode = 'pen';
      await db.prepare('UPDATE users SET therapy_mode = ? WHERE id = ?').bind('pen', user.id).run();
    }

    const token = await createSessionToken(user, env.AUTH_SECRET);

    return new Response(JSON.stringify({
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
        shareCode: user.share_code,
        language: user.language || 'en',
        privacyAcceptedAt: user.privacy_accepted_at || null,
        therapyMode: userTherapyMode,
        is_qa: isQaAttempt || user.email === QA_EMAIL
      },
      joinedGroup
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Login failed.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
