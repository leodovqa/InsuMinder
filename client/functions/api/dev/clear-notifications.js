import { getAuthUser } from '../_telegram.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const authUser = await getAuthUser(request, env);
  const userId = authUser ? authUser.userId : null;

  if (userId) {
    await db.prepare(
      `UPDATE injection_logs
       SET status_10m_sent = 1, status_2h_sent = 1, status_3h_sent = 1,
           error_10m = 'Queue cleared (Dev)', error_2h = 'Queue cleared (Dev)', error_3h = 'Queue cleared (Dev)'
       WHERE user_id = ? AND (status_10m_sent = 0 OR status_2h_sent = 0 OR status_3h_sent = 0)`
    ).bind(userId).run();

    await db.prepare(
      `UPDATE basal_reminders
       SET status_sent = 1, error = 'Queue cleared (Dev)'
       WHERE user_id = ? AND status_sent = 0`
    ).bind(userId).run();
  } else {
    await db.prepare(
      `UPDATE injection_logs
       SET status_10m_sent = 1, status_2h_sent = 1, status_3h_sent = 1,
           error_10m = 'Queue cleared (Dev)', error_2h = 'Queue cleared (Dev)', error_3h = 'Queue cleared (Dev)'
       WHERE status_10m_sent = 0 OR status_2h_sent = 0 OR status_3h_sent = 0`
    ).run();

    await db.prepare(
      `UPDATE basal_reminders
       SET status_sent = 1, error = 'Queue cleared (Dev)'
       WHERE status_sent = 0`
    ).run();
  }

  return new Response(JSON.stringify({ success: true, message: 'Notification queue cleared successfully.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

