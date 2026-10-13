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
    const { firstName, lastName, phone, language, basalTime } = body;
    const cleanLang = (language && ['en', 'he', 'ru'].includes(language)) ? language : null;
    const cleanBasalTime = (basalTime && typeof basalTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(basalTime)) ? basalTime : null;

    if ((cleanLang || cleanBasalTime) && firstName === undefined && lastName === undefined) {
      if (cleanLang && cleanBasalTime) {
        await db
          .prepare('UPDATE users SET language = ?, basal_time = ? WHERE id = ?')
          .bind(cleanLang, cleanBasalTime, authUser.userId)
          .run();
      } else if (cleanLang) {
        await db
          .prepare('UPDATE users SET language = ? WHERE id = ?')
          .bind(cleanLang, authUser.userId)
          .run();
      } else if (cleanBasalTime) {
        await db
          .prepare('UPDATE users SET basal_time = ? WHERE id = ?')
          .bind(cleanBasalTime, authUser.userId)
          .run();
      }

      const updatedUser = await db
        .prepare('SELECT id, email, name, first_name, last_name, phone, avatar, share_code, is_verified, language, basal_time FROM users WHERE id = ?')
        .bind(authUser.userId)
        .first();

      return new Response(JSON.stringify({
        success: true,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name || updatedUser.email.split('@')[0],
          firstName: updatedUser.first_name || '',
          lastName: updatedUser.last_name || '',
          phone: updatedUser.phone || '',
          avatar: updatedUser.avatar || '',
          shareCode: updatedUser.share_code || '',
          language: updatedUser.language || cleanLang || 'en',
          basalTime: updatedUser.basal_time || '20:00'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    if (cleanLang && cleanBasalTime) {
      await db
        .prepare('UPDATE users SET name = ?, first_name = ?, last_name = ?, phone = ?, language = ?, basal_time = ? WHERE id = ?')
        .bind(fullName, cleanFirstName, cleanLastName, cleanPhone || null, cleanLang, cleanBasalTime, authUser.userId)
        .run();
    } else if (cleanLang) {
      await db
        .prepare('UPDATE users SET name = ?, first_name = ?, last_name = ?, phone = ?, language = ? WHERE id = ?')
        .bind(fullName, cleanFirstName, cleanLastName, cleanPhone || null, cleanLang, authUser.userId)
        .run();
    } else if (cleanBasalTime) {
      await db
        .prepare('UPDATE users SET name = ?, first_name = ?, last_name = ?, phone = ?, basal_time = ? WHERE id = ?')
        .bind(fullName, cleanFirstName, cleanLastName, cleanPhone || null, cleanBasalTime, authUser.userId)
        .run();
    } else {
      await db
        .prepare('UPDATE users SET name = ?, first_name = ?, last_name = ?, phone = ? WHERE id = ?')
        .bind(fullName, cleanFirstName, cleanLastName, cleanPhone || null, authUser.userId)
        .run();
    }

    const updatedUser = await db
      .prepare('SELECT id, email, name, first_name, last_name, phone, avatar, share_code, is_verified, language, basal_time FROM users WHERE id = ?')
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
        shareCode: updatedUser.share_code || '',
        language: updatedUser.language || 'en',
        basalTime: updatedUser.basal_time || '20:00'
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

