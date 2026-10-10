import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser, getEffectiveUserId } from '../_auth.js';

export async function onRequestDelete(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: "D1 database binding 'DB' not configured." }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    await ensureTablesExist(db);

    const authUser = await getAuthUser(context.request, context.env);
    if (!authUser || !authUser.userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const effectiveUserId = await getEffectiveUserId(context.request, context.env, authUser, db);

    const id = parseInt(context.params.id, 10);
    if (isNaN(id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid configuration ID.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const target = await db
      .prepare("SELECT * FROM telegram_configs WHERE id = ? AND user_id = ?")
      .bind(id, effectiveUserId)
      .first();

    if (!target) {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const wasDefault = Boolean(target.is_default);

    await db.prepare("DELETE FROM telegram_configs WHERE id = ? AND user_id = ?").bind(id, effectiveUserId).run();

    if (wasDefault) {
      await db.prepare(
        "UPDATE telegram_configs SET is_default = 1 WHERE id = (SELECT id FROM telegram_configs WHERE user_id = ? ORDER BY id DESC LIMIT 1)"
      ).bind(effectiveUserId).run();
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}
