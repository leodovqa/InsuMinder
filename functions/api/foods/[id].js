import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser } from '../_auth.js';

export async function onRequestDelete(context) {
  const { request, env, params } = context;
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
    if (!authUser) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized. Please sign in.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const foodId = parseInt(params.id, 10);
    if (isNaN(foodId)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid food ID.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const deleteRes = await db.prepare(
      `DELETE FROM saved_foods WHERE id = ? AND user_id = ?`
    ).bind(foodId, authUser.userId).run();

    return new Response(JSON.stringify({
      success: true,
      deleted: Boolean(deleteRes.meta?.changes || deleteRes.changes)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[API] Error in DELETE /api/foods/[id]:', err);
    return new Response(JSON.stringify({ success: false, error: err.message || 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

