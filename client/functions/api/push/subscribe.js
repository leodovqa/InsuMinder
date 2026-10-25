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
    const userId = authUser ? authUser.userId : 1;

    const body = await request.json().catch(() => ({}));
    let endpoint, p256dh, auth, ua;

    if (body.fcmToken) {
      endpoint = 'fcm:' + body.fcmToken;
      p256dh = 'fcm';
      auth = 'fcm';
      ua = body.userAgent || request.headers.get('user-agent') || 'InsuMinder-Android';
    } else {
      const { subscription, userAgent } = body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return new Response(JSON.stringify({ success: false, error: 'Valid push subscription or FCM token is required.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      endpoint = subscription.endpoint;
      p256dh = subscription.keys.p256dh;
      auth = subscription.keys.auth;
      ua = userAgent || request.headers.get('user-agent') || '';
    }

    await db.prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         created_at = CURRENT_TIMESTAMP`
    ).bind(userId, endpoint, p256dh, auth, ua).run();

    return new Response(JSON.stringify({ success: true, message: 'Push subscription saved successfully.' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

