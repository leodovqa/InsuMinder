import { ensureTablesExist, dispatchDueNotifications } from './_telegram.js';
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

    const injected_at = now.toISOString();
    const notify_10m_at = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const notify_2h_at = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const notify_3h_at = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();

    const info = await db
      .prepare("INSERT INTO injection_logs (user_id, injected_at, notify_10m_at, notify_2h_at, notify_3h_at) VALUES (?, ?, ?, ?, ?)")
      .bind(userId, injected_at, notify_10m_at, notify_2h_at, notify_3h_at)
      .run();

    // Opportunistically check and dispatch notifications in background
    if (context.waitUntil) {
      context.waitUntil(dispatchDueNotifications(db));
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: info.meta.last_row_id
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

