import { dispatchDueNotifications } from './_telegram.js';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
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

    // Ensure table exists
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS injection_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        injected_at TIMESTAMP NOT NULL,
        notify_2h_at TIMESTAMP NOT NULL,
        notify_3h_at TIMESTAMP NOT NULL,
        status_2h_sent BOOLEAN DEFAULT 0,
        status_3h_sent BOOLEAN DEFAULT 0
      )`
    ).run();

    const now = new Date();
    const currentMinute = now.toISOString().slice(0, 16);

    // Check if an injection was already logged this same minute
    const latest = await db
      .prepare("SELECT injected_at FROM injection_logs ORDER BY injected_at DESC LIMIT 1")
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

    const injected_at = now.toISOString();
    const notify_2h_at = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const notify_3h_at = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();

    const info = await db
      .prepare("INSERT INTO injection_logs (injected_at, notify_2h_at, notify_3h_at) VALUES (?, ?, ?)")
      .bind(injected_at, notify_2h_at, notify_3h_at)
      .run();

    // Opportunistically check and dispatch notifications in background
    if (context.waitUntil) {
      context.waitUntil(dispatchDueNotifications(db));
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: info.meta?.last_row_id || 1
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
      JSON.stringify({ success: false, error: err.message }),
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
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
