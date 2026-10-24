import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser } from '../_auth.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return onRequestOptions();
  }

  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed.' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding (DB) is missing.' }), {
      status: 500,
      headers: corsHeaders
    });
  }

  await ensureTablesExist(db);

  try {
    const authUser = await getAuthUser(request, env);
    if (!authUser || !authUser.userId) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }), {
        status: 401,
        headers: corsHeaders
      });
    }

    const body = await request.json().catch(() => ({}));
    const { firstName, lastName, phone, language, basalTime, theme, notificationPreferences, privacyAccepted, therapyMode } = body;
    const cleanTherapyMode = (therapyMode && ['pen', 'pump'].includes(therapyMode)) ? therapyMode : null;
    const cleanLang = (language && ['en', 'he', 'ru'].includes(language)) ? language : null;
    const cleanBasalTime = (basalTime && typeof basalTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(basalTime)) ? basalTime : null;
    const cleanTheme = (theme && ['dark', 'light'].includes(theme)) ? theme : null;
    const cleanNotificationPrefs = notificationPreferences !== undefined
      ? (typeof notificationPreferences === 'object' ? JSON.stringify(notificationPreferences) : String(notificationPreferences))
      : null;
    const hasPrivacyAccepted = privacyAccepted !== undefined;

    if ((cleanLang || cleanBasalTime || cleanTheme || cleanNotificationPrefs !== null || hasPrivacyAccepted || cleanTherapyMode) && firstName === undefined && lastName === undefined) {
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
      if (cleanNotificationPrefs !== null) {
        updates.push('notification_preferences = ?');
        params.push(cleanNotificationPrefs);
      }
      if (hasPrivacyAccepted) {
        updates.push('privacy_accepted_at = CURRENT_TIMESTAMP');
      }
      if (cleanTherapyMode) {
        updates.push('therapy_mode = ?');
        params.push(cleanTherapyMode);
      }
      params.push(authUser.userId);

      await db
        .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

      const updatedUser = await db
        .prepare('SELECT id, email, name, first_name, last_name, phone, avatar, share_code, is_verified, language, basal_time, theme, notification_preferences, privacy_accepted_at, therapy_mode FROM users WHERE id = ?')
        .bind(authUser.userId)
        .first();

      let parsedPrefs = null;
      if (updatedUser.notification_preferences) {
        try {
          parsedPrefs = JSON.parse(updatedUser.notification_preferences);
        } catch {
          parsedPrefs = null;
        }
      }

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
          theme: updatedUser.theme || cleanTheme || 'dark',
          notificationPreferences: parsedPrefs,
          privacyAcceptedAt: updatedUser.privacy_accepted_at || null,
          therapyMode: updatedUser.therapy_mode || null
        }
      }), {
        status: 200,
        headers: corsHeaders
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
        headers: corsHeaders
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
    if (cleanNotificationPrefs !== null) {
      fullUpdates.push('notification_preferences = ?');
      fullParams.push(cleanNotificationPrefs);
    }
    if (hasPrivacyAccepted) {
      fullUpdates.push('privacy_accepted_at = CURRENT_TIMESTAMP');
    }
    if (cleanTherapyMode) {
      fullUpdates.push('therapy_mode = ?');
      fullParams.push(cleanTherapyMode);
    }
    fullParams.push(authUser.userId);

    await db
      .prepare(`UPDATE users SET ${fullUpdates.join(', ')} WHERE id = ?`)
      .bind(...fullParams)
      .run();

    const updatedUser = await db
      .prepare('SELECT id, email, name, first_name, last_name, phone, avatar, share_code, is_verified, language, basal_time, theme, notification_preferences, privacy_accepted_at, therapy_mode FROM users WHERE id = ?')
      .bind(authUser.userId)
      .first();

    let parsedPrefs = null;
    if (updatedUser.notification_preferences) {
      try {
        parsedPrefs = JSON.parse(updatedUser.notification_preferences);
      } catch {
        parsedPrefs = null;
      }
    }

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
        theme: updatedUser.theme || 'dark',
        notificationPreferences: parsedPrefs,
        privacyAcceptedAt: updatedUser.privacy_accepted_at || null,
        therapyMode: updatedUser.therapy_mode || null
      }
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Failed to update profile.' }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
