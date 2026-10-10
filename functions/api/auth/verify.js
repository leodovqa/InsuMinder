import { ensureTablesExist } from '../_telegram.js';
import { createSessionToken, generateShareCode } from '../_auth.js';

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
    const { email, code, shareCode } = body;

    if (!email || !code) {
      return new Response(JSON.stringify({ success: false, error: 'Email and verification code are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const record = await db
      .prepare('SELECT * FROM verification_codes WHERE email = ? AND consumed = 0 ORDER BY id DESC LIMIT 1')
      .bind(cleanEmail)
      .first();

    if (!record) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No active verification request found. Please enter your email and password to start a new process.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isExpired = new Date().getTime() > new Date(record.expires_at).getTime();
    if (isExpired) {
      await db.prepare('UPDATE verification_codes SET consumed = 1 WHERE id = ?').bind(record.id).run();
      return new Response(JSON.stringify({
        success: false,
        expired: true,
        error: 'Verification code has expired. Please enter your email and password to start a new verification process.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (record.code !== cleanCode) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid verification code. Please check your code and try again.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await db.prepare('UPDATE verification_codes SET consumed = 1 WHERE id = ?').bind(record.id).run();

    let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail).first();

    if (user) {
      await db
        .prepare('UPDATE users SET password_hash = ?, is_verified = 1 WHERE id = ?')
        .bind(record.password_hash, user.id)
        .run();
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    } else {
      const defaultName = cleanEmail.split('@')[0];
      const initialShareCode = generateShareCode();
      const result = await db
        .prepare('INSERT INTO users (email, password_hash, name, is_verified, share_code) VALUES (?, ?, ?, 1, ?)')
        .bind(cleanEmail, record.password_hash, defaultName, initialShareCode)
        .run();
      user = {
        id: result.meta.last_row_id,
        email: cleanEmail,
        name: defaultName,
        is_verified: 1,
        share_code: initialShareCode
      };
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

    const token = await createSessionToken(user, env.AUTH_SECRET);

    return new Response(JSON.stringify({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || cleanEmail.split('@')[0],
        shareCode: user.share_code
      },
      joinedGroup
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Verification failed.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

