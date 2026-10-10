import { ensureTablesExist } from '../../_telegram.js';
import { getAuthUser, getEffectiveUserId } from '../../_auth.js';

export async function onRequestPut(context) {
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

    await db.prepare("UPDATE telegram_configs SET is_default = 0 WHERE user_id = ?").bind(effectiveUserId).run();
    await db.prepare("UPDATE telegram_configs SET is_default = 1 WHERE id = ? AND user_id = ?").bind(id, effectiveUserId).run();

    const updated = await db
      .prepare("SELECT * FROM telegram_configs WHERE id = ? AND user_id = ?")
      .bind(id, effectiveUserId)
      .first();

    return new Response(
      JSON.stringify({
        success: true,
        config: updated ? {
          id: updated.id,
          name: updated.name,
          botToken: updated.bot_token,
          chatId: updated.chat_id,
          isDefault: Boolean(updated.is_default)
        } : null
      }),
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
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}
