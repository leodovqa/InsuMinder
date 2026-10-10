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
    let userFirstName = '';
    let userLastName = '';
    let userPhone = '';
    let userAvatar = '';
    let googleId = '';

    if (dev || credential === 'dev-google-login') {
      userEmail = (devEmail && String(devEmail).trim().toLowerCase()) || 'google.user@insuminder.app';
      userFirstName = body.firstName || (devName ? String(devName).split(' ')[0] : 'Google');
      userLastName = body.lastName || (devName && String(devName).split(' ').length > 1 ? String(devName).split(' ').slice(1).join(' ') : 'User');
      userName = devName || `${userFirstName} ${userLastName}`.trim();
      userPhone = body.phone || '';
      userAvatar = devAvatar || '';
      googleId = 'dev-google-' + userEmail;
    } else {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          userEmail = payload.email ? payload.email.toLowerCase() : '';
          userFirstName = payload.given_name || (payload.name ? payload.name.split(' ')[0] : '');
          userLastName = payload.family_name || (payload.name && payload.name.split(' ').length > 1 ? payload.name.split(' ').slice(1).join(' ') : '');
          userName = payload.name || `${userFirstName} ${userLastName}`.trim() || 'Google User';
          userPhone = payload.phone_number || body.phone || '';
          userAvatar = payload.picture || '';
          googleId = payload.sub || '';
        }
      } catch {
        const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        const tokenInfo = await resp.json().catch(() => null);
        if (tokenInfo && tokenInfo.email) {
          userEmail = tokenInfo.email.toLowerCase();
          userFirstName = tokenInfo.given_name || (tokenInfo.name ? tokenInfo.name.split(' ')[0] : '');
          userLastName = tokenInfo.family_name || (tokenInfo.name && tokenInfo.name.split(' ').length > 1 ? tokenInfo.name.split(' ').slice(1).join(' ') : '');
          userName = tokenInfo.name || `${userFirstName} ${userLastName}`.trim() || 'Google User';
          userPhone = tokenInfo.phone_number || body.phone || '';
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
      // PRESERVE CUSTOM USER PROFILE:
      // If user has customized their profile, do not overwrite their name with Google default
      await db
        .prepare(`UPDATE users SET 
          google_id = ?, 
          avatar = COALESCE(NULLIF(?, ""), avatar), 
          first_name = COALESCE(first_name, NULLIF(?, "")),
          last_name = COALESCE(last_name, NULLIF(?, "")),
          name = COALESCE(name, NULLIF(?, "")),
          phone = COALESCE(phone, NULLIF(?, "")),
          failed_login_attempts = 0,
          locked_until = NULL,
          is_verified = 1 
          WHERE id = ?`)
        .bind(googleId, userAvatar, userFirstName, userLastName, userName, userPhone, user.id)
        .run();
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
    } else {
      const initialShareCode = generateShareCode();
      const result = await db
        .prepare('INSERT INTO users (email, google_id, auth_provider, name, first_name, last_name, phone, avatar, is_verified, share_code) VALUES (?, ?, "google", ?, ?, ?, ?, ?, 1, ?)')
        .bind(userEmail, googleId, userName, userFirstName, userLastName, userPhone, userAvatar, initialShareCode)
        .run();
      user = {
        id: result.meta.last_row_id,
        email: userEmail,
        name: userName,
        first_name: userFirstName,
        last_name: userLastName,
        phone: userPhone,
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
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        phone: user.phone || '',
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

