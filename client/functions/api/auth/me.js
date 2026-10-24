import { getAuthUser, generateShareCode } from '../_auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding (DB) is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const authUser = await getAuthUser(request, env);
  if (!authUser || !authUser.userId) {
    return new Response(JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let user = await db
    .prepare('SELECT id, email, name, first_name, last_name, phone, avatar, share_code, is_verified, language, basal_time, theme, notification_preferences, privacy_accepted_at, therapy_mode, created_at FROM users WHERE id = ?')
    .bind(authUser.userId)
    .first();

  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'User not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!user.share_code) {
    const newCode = generateShareCode();
    await db.prepare('UPDATE users SET share_code = ? WHERE id = ?').bind(newCode, user.id).run();
    user.share_code = newCode;
  }

  let parsedPrefs = null;
  if (user.notification_preferences) {
    try {
      parsedPrefs = JSON.parse(user.notification_preferences);
    } catch {
      parsedPrefs = null;
    }
  }

  return new Response(JSON.stringify({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      phone: user.phone || '',
      avatar: user.avatar || '',
      shareCode: user.share_code,
      language: user.language || 'en',
      basalTime: user.basal_time || '20:00',
      theme: user.theme || 'dark',
      notificationPreferences: parsedPrefs,
      privacyAcceptedAt: user.privacy_accepted_at || null,
      therapyMode: user.therapy_mode || null
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding (DB) is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const authUser = await getAuthUser(request, env);
  if (!authUser || !authUser.userId) {
    return new Response(JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const userId = authUser.userId;

    const existingUser = await db
      .prepare('SELECT email FROM users WHERE id = ?')
      .bind(userId)
      .first();

    const email = existingUser ? existingUser.email : null;

    const statements = [
      db.prepare('DELETE FROM injection_logs WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM telegram_configs WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM basal_reminders WHERE user_id = ?').bind(userId),
      db.prepare('DELETE FROM shared_members WHERE owner_id = ? OR member_id = ?').bind(userId, userId),
      db.prepare('DELETE FROM share_invites WHERE owner_id = ?').bind(userId)
    ];

    if (email) {
      statements.push(db.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email));
    }

    statements.push(db.prepare('DELETE FROM users WHERE id = ?').bind(userId));

    await db.batch(statements);

    return new Response(JSON.stringify({
      success: true,
      message: 'Account and associated data deleted successfully.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Failed to delete account.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}

