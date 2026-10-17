import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser } from '../_auth.js';

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
    const authUser = await getAuthUser(request, env);
    if (!authUser || !authUser.userId) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const nowIso = new Date().toISOString();
    await db
      .prepare('UPDATE users SET privacy_accepted_at = ? WHERE id = ?')
      .bind(nowIso, authUser.userId)
      .run();

    const updatedUser = await db
      .prepare('SELECT id, email, name, first_name, last_name, phone, avatar, share_code, is_verified, language, basal_time, theme, notification_preferences, privacy_accepted_at FROM users WHERE id = ?')
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
        language: updatedUser.language || 'en',
        basalTime: updatedUser.basal_time || '20:00',
        theme: updatedUser.theme || 'dark',
        notificationPreferences: parsedPrefs,
        privacyAcceptedAt: updatedUser.privacy_accepted_at || nowIso
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Failed to record privacy agreement acceptance.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

