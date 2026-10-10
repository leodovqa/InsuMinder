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
    const { credential, dev, email: devEmail, name: devName, avatar: devAvatar, shareCode } = body;

    let userEmail = '';
    let userName = '';
    let userAvatar = '';
    let googleId = '';

    if (dev || !credential || credential === 'dev-google-login') {
      userEmail = (devEmail && String(devEmail).trim().toLowerCase()) || 'google.user@insuminder.app';
      userName = devName || 'Google User';
      userAvatar = devAvatar || '';
      googleId = 'dev-google-' + userEmail;
    } else {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          userEmail = payload.email ? payload.email.toLowerCase() : '';
          userName = payload.name || payload.given_name || '';
          userAvatar = payload.picture || '';
          googleId = payload.sub || '';
        }
      } catch {
        const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        const tokenInfo = await resp.json().catch(() => null);
        if (tokenInfo && tokenInfo.email) {
          userEmail = tokenInfo.email.toLowerCase();
          userName = tokenInfo.name || '';
          userAvatar = tokenInfo.picture || '';
          googleId = tokenInfo.sub || '';
        }
      }

      if (!userEmail) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to verify Google credentials.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(userEmail).first();

    if (user) {
      await db
        .prepare('UPDATE users SET google_id = ?, name = COALESCE(NULLIF(?, ""), name), avatar = COALESCE(NULLIF(?, ""), avatar), is_verified = 1 WHERE id = ?')
        .bind(googleId, userName, userAvatar, user.id)
        .run();
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    } else {
      const initialShareCode = generateShareCode();
      const result = await db
        .prepare('INSERT INTO users (email, google_id, name, avatar, is_verified, share_code) VALUES (?, ?, ?, ?, 1, ?)')
        .bind(userEmail, googleId, userName, userAvatar, initialShareCode)
        .run();
      user = {
        id: result.meta.last_row_id,
        email: userEmail,
        name: userName,
        avatar: userAvatar,
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
        name: user.name || userEmail.split('@')[0],
        avatar: user.avatar || '',
        shareCode: user.share_code
      },
      joinedGroup
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Google authentication failed.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

