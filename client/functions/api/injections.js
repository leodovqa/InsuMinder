import { ensureTablesExist, dispatchDueNotifications, getJerusalemDateAndTime } from './_telegram.js';
import { getAuthUser, getEffectiveUserId } from './_auth.js';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const db = env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "D1 database binding 'DB' not configured. Please bind a D1 database in Cloudflare Pages Settings > Bindings with variable name 'DB'."
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    await ensureTablesExist(db);

    const authUser = await getAuthUser(request, env);
    if (!authUser || !authUser.userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authentication required. Please sign in.'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const userId = await getEffectiveUserId(request, env, authUser, db);
    const now = new Date();
    const currentMinute = now.toISOString().slice(0, 16);

    // Check if an injection was already logged this same minute by this user
    const latest = await db
      .prepare("SELECT injected_at FROM injection_logs WHERE user_id = ? ORDER BY injected_at DESC LIMIT 1")
      .bind(userId)
      .first();

    if (latest && latest.injected_at && latest.injected_at.slice(0, 16) === currentMinute) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "An injection has already been recorded this minute. You can only log once per minute."
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { type = 'bolus' } = body || {};
    const cleanType = type === 'basal' ? 'basal' : 'bolus';
    const isBasal = cleanType === 'basal';

    const injected_at = now.toISOString();
    const notify_10m_at = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const notify_2h_at = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const notify_3h_at = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
    const status_sent = isBasal ? 1 : 0;

    const info = await db
      .prepare("INSERT INTO injection_logs (user_id, injected_at, notify_10m_at, notify_2h_at, notify_3h_at, status_10m_sent, status_2h_sent, status_3h_sent, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(userId, injected_at, notify_10m_at, notify_2h_at, notify_3h_at, status_sent, status_sent, status_sent, cleanType)
      .run();

    // Opportunistically check and dispatch notifications in background (bolus only)
    if (!isBasal && context.waitUntil) {
      context.waitUntil(dispatchDueNotifications(db));
    } else if (isBasal) {
      const { dateStr: todayDate } = getJerusalemDateAndTime(now);
      const userRow = await db.prepare("SELECT basal_time FROM users WHERE id = ?").bind(userId).first();
      const basalTime = (userRow && userRow.basal_time) ? userRow.basal_time : '20:00';
      await db
        .prepare(
          `INSERT INTO basal_reminders (user_id, reminder_date, scheduled_time, status_sent, sent_at, error)
           VALUES (?, ?, ?, 0, NULL, 'Already injected')
           ON CONFLICT(user_id, reminder_date) DO UPDATE SET
             status_sent = CASE WHEN basal_reminders.status_sent = 1 THEN 1 ELSE 0 END,
             error = CASE WHEN basal_reminders.status_sent = 1 THEN NULL ELSE 'Already injected' END`
        )
        .bind(userId, todayDate, basalTime)
        .run();
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: info.meta.last_row_id,
        type: cleanType
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}

