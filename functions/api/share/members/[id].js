import { ensureTablesExist } from '../../_telegram.js';
import { getAuthUser } from '../../_auth.js';

export async function onRequestDelete(context) {
  try {
    const { request, env, params } = context;
    const db = env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: "Database binding 'DB' not configured." }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    await ensureTablesExist(db);

    const authUser = await getAuthUser(request, env);
    if (!authUser || !authUser.userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const memberId = parseInt(params.id, 10);
    if (isNaN(memberId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid member ID.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    await db.prepare("DELETE FROM shared_members WHERE owner_id = ? AND member_id = ?")
      .bind(authUser.userId, memberId)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: 'Member removed from shared group.' }),
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

