import { ensureTablesExist, dispatchDueNotifications } from './_telegram.js';
import { getAuthUser, getEffectiveUserId } from './_auth.js';

export async function onRequestGet(context) {
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
      // Return empty logs when logged out
      return new Response(
        JSON.stringify({
          success: true,
          logs: []
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

    const effectiveUserId = await getEffectiveUserId(request, env, authUser, db);

    const { results } = await db
      .prepare("SELECT * FROM injection_logs WHERE user_id = ? ORDER BY injected_at DESC")
      .bind(effectiveUserId)
      .all();

    // Opportunistically check and dispatch notifications in background
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}

