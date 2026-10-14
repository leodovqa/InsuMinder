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
    const { firstName, lastName, phone, language, basalTime, theme } = body;
    const cleanLang = (language && ['en', 'he', 'ru'].includes(language)) ? language : null;
    const cleanBasalTime = (basalTime && typeof basalTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(basalTime)) ? basalTime : null;
    const cleanTheme = (theme && ['dark', 'light'].includes(theme)) ? theme : null;

    if ((cleanLang || cleanBasalTime || cleanTheme) && firstName === undefined && lastName === undefined) {
      const updates = [];
      const params = [];
      if (cleanLang) {
        updates.push('language = ?');
        params.push(cleanLang);
      }
      if (cleanBasalTime) {
        updates.push('basal_time = ?');
        params.push(cleanBasalTime);
      }
      if (cleanTheme) {
        updates.push('theme = ?');
        params.push(cleanTheme);
      }
      params.push(authUser.userId);

      await db
        .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

      const updatedUser = await db
        .prepare('SELECT id, email, name, first_name, last_name, phone, avatar, share_code, is_verified, language, basal_time, theme FROM users WHERE id = ?')
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
          basalTime: updatedUser.basal_time || '20:00',
          theme: updatedUser.theme || cleanTheme || 'dark'
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
    const fullUpdates = ['name = ?', 'first_name = ?', 'last_name = ?', 'phone = ?'];
    const fullParams = [fullName, cleanFirstName, cleanLastName, cleanPhone || null];

    if (cleanLang) {
      fullUpdates.push('language = ?');
      fullParams.push(cleanLang);
    }
    if (cleanBasalTime) {
      fullUpdates.push('basal_time = ?');
      fullParams.push(cleanBasalTime);
    }
    if (cleanTheme) {
      fullUpdates.push('theme = ?');
      fullParams.push(cleanTheme);
    }
    fullParams.push(authUser.userId);

    await db
      .prepare(`UPDATE users SET ${fullUpdates.join(', ')} WHERE id = ?`)
      .bind(...fullParams)
      .run();

    const updatedUser = await db
      .prepare('SELECT id, email, name, first_name, last_name, phone, avatar, share_code, is_verified, language, basal_time, theme FROM users WHERE id = ?')
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
        basalTime: updatedUser.basal_time || '20:00',
        theme: updatedUser.theme || 'dark'
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

