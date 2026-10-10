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
    .prepare('SELECT id, email, name, avatar, share_code, is_verified, created_at FROM users WHERE id = ?')
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

  return new Response(JSON.stringify({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      avatar: user.avatar || '',
      shareCode: user.share_code
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

