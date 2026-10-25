import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser } from '../_auth.js';

export async function onRequestDelete(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding (DB) is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  await ensureTablesExist(db);

  try {
    const authUser = await getAuthUser(request, env);
    if (!authUser || !authUser.userId) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

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
      db.prepare('DELETE FROM share_invites WHERE owner_id = ?').bind(userId),
      db.prepare('DELETE FROM saved_foods WHERE user_id = ?').bind(userId)
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
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}

