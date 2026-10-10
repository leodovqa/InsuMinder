import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding (DB) is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  await ensureTablesExist(db);

  try {
    const authUser = await getAuthUser(request, env);
    if (!authUser || !authUser.userId) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json().catch(() => ({}));
    const { firstName, lastName, phone } = body;

    const cleanFirstName = String(firstName || '').trim();
    const cleanLastName = String(lastName || '').trim();
    const cleanPhone = String(phone || '').trim();

    if (!cleanFirstName || !cleanLastName) {
      return new Response(JSON.stringify({
        success: false,
        error: 'First name and last name are required.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fullName = `${cleanFirstName} ${cleanLastName}`.trim();

    await db
      .prepare('UPDATE users SET name = ?, first_name = ?, last_name = ?, phone = ? WHERE id = ?')
      .bind(fullName, cleanFirstName, cleanLastName, cleanPhone || null, authUser.userId)
      .run();

    const updatedUser = await db
      .prepare('SELECT id, email, name, first_name, last_name, phone, avatar, share_code, is_verified FROM users WHERE id = ?')
      .bind(authUser.userId)
      .first();

    return new Response(JSON.stringify({
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
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Failed to update profile.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

