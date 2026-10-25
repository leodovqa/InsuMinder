import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser } from '../_auth.js';
import { sendWebPush } from '../_webpush.js';
import { sendFcmNotification } from '../_fcm.js';

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
    let { language } = body;

    if (!language && authUser) {
      const user = await db.prepare('SELECT language FROM users WHERE id = ?').bind(userId).first();
      if (user && user.language) {
        language = user.language;
      }
    }
    const userLang = language || 'en';

    const { results: subscriptions } = await db.prepare(
      'SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
    ).bind(userId).all();

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: userLang === 'he'
          ? 'לא נמצאו מכשירים רשומים להתראות פוש. אנא אשר התראות במכשיר זה תחילה.'
          : (userLang === 'ru'
            ? 'Нет зарегистрированных устройств для push-уведомлений. Пожалуйста, разрешите уведомления на этом устройстве.'
            : 'No registered push devices found. Please enable push notifications on this device first.')
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const title = userLang === 'he'
      ? '🔔 בדיקת התראות InsuMinder ⏰'
      : (userLang === 'ru'
        ? '🔔 Проверка уведомлений InsuMinder ⏰'
        : '🔔 InsuMinder Test Alert ⏰');

    const desc = userLang === 'he'
      ? 'חיבור ההתראות הצליח! תזכורות ההזרקה שלך פעילות.'
      : (userLang === 'ru'
        ? 'Подключение уведомлений успешно! Напоминания об инъекциях активны.'
        : 'Notification connection successful! Your injection reminders are active.');

    const payload = {
      title,
      body: desc,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: '/?page=notifications' }
    };

    let sentCount = 0;
    for (const sub of subscriptions) {
      let result;
      if (sub.endpoint && sub.endpoint.startsWith('fcm:')) {
        const token = sub.endpoint.slice(4);
        const fRes = await sendFcmNotification(token, {
          reminderId: 'test-push',
          title: payload.title,
          body: payload.body,
          targetUrl: payload.data?.url || '/?page=notifications'
        }, { env });
        result = { ok: fRes.success, expired: fRes.expired, error: fRes.error };
      } else {
        result = await sendWebPush(sub, payload, { env });
      }

      if (result.ok) {
        sentCount++;
      } else if (result.expired) {
        // Prune expired subscription
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sentCount,
      message: userLang === 'he'
        ? 'התראת בדיקה נשלחה למכשיר שלך!'
        : (userLang === 'ru'
          ? 'Тестовое уведомление отправлено на ваше устройство!'
          : 'Test notification sent to your device!')
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

