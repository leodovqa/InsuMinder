import { dispatchDueNotifications } from './_telegram.js';

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({
          success: false,
          logs: [],
          error: "D1 database binding 'DB' not configured. Please bind a D1 database in Cloudflare Pages Settings > Functions > D1 database bindings with variable name 'DB'."
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
        status_3h_sent BOOLEAN DEFAULT 0,
        error_2h TEXT,
        error_3h TEXT
      )`
    ).run();

    try {
      await db.prepare(`ALTER TABLE injection_logs ADD COLUMN error_2h TEXT`).run();
    } catch (err) {
      void err;
    }
    try {
      await db.prepare(`ALTER TABLE injection_logs ADD COLUMN error_3h TEXT`).run();
    } catch (err) {
      void err;
    }

    // Retrieve all historical logs ordered by most recent first
    const { results } = await db
      .prepare("SELECT * FROM injection_logs ORDER BY injected_at DESC")
      .all();

    // Opportunistically check and dispatch due notifications in background
    if (context.waitUntil) {
      context.waitUntil(dispatchDueNotifications(db));
    }

    return new Response(
      JSON.stringify({
        success: true,
        logs: results || []
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
      JSON.stringify({ success: false, error: err.message, logs: [] }),
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
