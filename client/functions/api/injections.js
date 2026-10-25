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
    const body = await request.json().catch(() => ({}));
    const { type = 'bolus', manual = false, date, time, injected_at: customInjectedAt, delivery_method } = body || {};
    const cleanDeliveryMethod = (delivery_method && ['pen', 'pump'].includes(delivery_method)) ? delivery_method : null;
    const cleanType = type === 'basal' ? 'basal' : 'bolus';
    const isBasal = cleanType === 'basal';

    const userRow = await db.prepare("SELECT basal_time, therapy_mode FROM users WHERE id = ?").bind(userId).first();
    const dbTherapyMode = (userRow && userRow.therapy_mode === 'pump') ? 'pump' : 'pen';
    const therapyMode = cleanDeliveryMethod || dbTherapyMode;
    if (cleanDeliveryMethod && userRow && userRow.therapy_mode !== cleanDeliveryMethod) {
      await db.prepare("UPDATE users SET therapy_mode = ? WHERE id = ?").bind(cleanDeliveryMethod, userId).run();
    }

    if (isBasal && therapyMode === 'pump') {
      return new Response(
        JSON.stringify({ success: false, error: "Basal injections are not applicable in pump mode." }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Handle Manual Injection Logging
    if (manual || date || customInjectedAt) {
      let finalDateObj;
      if (customInjectedAt) {
        finalDateObj = new Date(customInjectedAt);
      } else if (date && time) {
        finalDateObj = new Date(`${date}T${time}:00`);
      }

      if (!finalDateObj || isNaN(finalDateObj.getTime())) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid injection date/time format." }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      if (finalDateObj.getTime() > now.getTime()) {
        return new Response(
          JSON.stringify({ success: false, error: "Future date and time are not allowed." }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 31);
      oneMonthAgo.setHours(0, 0, 0, 0);
      if (finalDateObj.getTime() < oneMonthAgo.getTime()) {
        return new Response(
          JSON.stringify({ success: false, error: "Cannot log injection older than 1 month." }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }

      const { results: allLogs } = await db
        .prepare("SELECT * FROM injection_logs WHERE user_id = ? ORDER BY injected_at DESC")
        .bind(userId)
        .all();

      const { dateStr: targetDate, timeStr: targetTime } = getJerusalemDateAndTime(finalDateObj);

      const sameDayLogs = (allLogs || []).filter(l => {
        const { dateStr } = getJerusalemDateAndTime(new Date(l.injected_at));
        return dateStr === targetDate;
      });

      if (isBasal) {
        const existingBasal = sameDayLogs.find(l => l.type === 'basal');
        if (existingBasal) {
          return new Response(
            JSON.stringify({ success: false, error: "You cannot have 2 basal injections in one day." }),
            { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
          );
        }
      } else {
        const bolusLogs = sameDayLogs.filter(l => !l.type || l.type === 'bolus');
        const maxBolus = therapyMode === 'pump' ? 20 : 10;
        if (bolusLogs.length >= maxBolus) {
          return new Response(
            JSON.stringify({ success: false, error: `Maximum ${maxBolus} bolus injections allowed per day.` }),
            { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
          );
        }

        const duplicateMinute = bolusLogs.find(l => {
          const { timeStr } = getJerusalemDateAndTime(new Date(l.injected_at));
          return timeStr === targetTime;
        });
        if (duplicateMinute) {
          return new Response(
            JSON.stringify({ success: false, error: "Can't add, this exact time already appears." }),
            { status: 409, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
          );
        }
      }

      const isOfflineSync = Boolean(body.is_offline_sync);
      const injected_at = finalDateObj.toISOString();
      const notify_10m_at = new Date(finalDateObj.getTime() + 10 * 60 * 1000).toISOString();
      const notify_2h_at = new Date(finalDateObj.getTime() + 2 * 60 * 60 * 1000).toISOString();
      const notify_3h_at = new Date(finalDateObj.getTime() + 3 * 60 * 60 * 1000).toISOString();
      const status_10m_sent = (isBasal || (!isOfflineSync && finalDateObj < now) || new Date(notify_10m_at) <= now) ? 1 : 0;
      const status_2h_sent = (isBasal || (!isOfflineSync && finalDateObj < now) || new Date(notify_2h_at) <= now) ? 1 : 0;
      const status_3h_sent = (isBasal || (!isOfflineSync && finalDateObj < now) || new Date(notify_3h_at) <= now) ? 1 : 0;
      const err_10m = status_10m_sent === 1 ? (isOfflineSync ? 'Sync after reminder time' : 'Manual entry') : null;
      const err_2h = status_2h_sent === 1 ? (isOfflineSync ? 'Sync after reminder time' : 'Manual entry') : null;
      const err_3h = status_3h_sent === 1 ? (isOfflineSync ? 'Sync after reminder time' : 'Manual entry') : null;

      const info = await db
        .prepare(
          "INSERT INTO injection_logs (user_id, injected_at, notify_10m_at, notify_2h_at, notify_3h_at, status_10m_sent, status_2h_sent, status_3h_sent, error_10m, error_2h, error_3h, type, delivery_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(userId, injected_at, notify_10m_at, notify_2h_at, notify_3h_at, status_10m_sent, status_2h_sent, status_3h_sent, err_10m, err_2h, err_3h, cleanType, therapyMode)
        .run();

      if (!isBasal && isOfflineSync && context.waitUntil) {
        context.waitUntil(dispatchDueNotifications(db, context.env));
      }

      if (isBasal) {
        const { dateStr: todayDate } = getJerusalemDateAndTime(now);
        if (targetDate === todayDate) {
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
      }

      return new Response(
        JSON.stringify({
          success: true,
          id: info.meta.last_row_id,
          type: cleanType,
          injected_at,
          manual: true,
          delivery_method: therapyMode
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Live Injection: Check rate-limit (one per minute)
    const currentMinute = now.toISOString().slice(0, 16);
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

    const { results: allLogs } = await db
      .prepare("SELECT injected_at, type FROM injection_logs WHERE user_id = ? ORDER BY injected_at DESC")
      .bind(userId)
      .all();
    const { dateStr: todayDate } = getJerusalemDateAndTime(now);

    if (isBasal) {
      const existingBasal = (allLogs || []).find(l => {
        if (l.type !== 'basal') return false;
        const { dateStr } = getJerusalemDateAndTime(new Date(l.injected_at));
        return dateStr === todayDate;
      });
      if (existingBasal) {
        return new Response(
          JSON.stringify({ success: false, error: "You cannot have 2 basal injections in one day." }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }
    } else {
      const bolusLogs = (allLogs || []).filter(l => {
        if (l.type === 'basal') return false;
        const { dateStr } = getJerusalemDateAndTime(new Date(l.injected_at));
        return dateStr === todayDate;
      });
      const maxBolus = therapyMode === 'pump' ? 20 : 10;
      if (bolusLogs.length >= maxBolus) {
        return new Response(
          JSON.stringify({ success: false, error: `Maximum ${maxBolus} bolus injections allowed per day.` }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }
    }

    const injected_at = now.toISOString();
    const notify_10m_at = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const notify_2h_at = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const notify_3h_at = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
    const status_sent = isBasal ? 1 : 0;

    const info = await db
      .prepare("INSERT INTO injection_logs (user_id, injected_at, notify_10m_at, notify_2h_at, notify_3h_at, status_10m_sent, status_2h_sent, status_3h_sent, type, delivery_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(userId, injected_at, notify_10m_at, notify_2h_at, notify_3h_at, status_sent, status_sent, status_sent, cleanType, therapyMode)
      .run();

    // Opportunistically check and dispatch notifications in background (bolus only)
    if (!isBasal && context.waitUntil) {
      context.waitUntil(dispatchDueNotifications(db, context.env));
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
        type: cleanType,
        delivery_method: therapyMode
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

