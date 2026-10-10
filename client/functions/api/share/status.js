import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser, generateShareCode } from '../_auth.js';

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
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

    // Ensure user has a share_code
    let user = await db.prepare("SELECT id, email, name, share_code FROM users WHERE id = ?").bind(authUser.userId).first();
    let shareCode = user?.share_code;
    if (!shareCode) {
      shareCode = generateShareCode();
      await db.prepare("UPDATE users SET share_code = ? WHERE id = ?").bind(shareCode, authUser.userId).run();
    }

    // Members in my group (I am owner)
    const { results: members } = await db.prepare(
      "SELECT u.id, u.email, u.name, u.avatar, sm.created_at as joined_at " +
      "FROM shared_members sm JOIN users u ON sm.member_id = u.id " +
      "WHERE sm.owner_id = ? ORDER BY sm.created_at DESC"
    ).bind(authUser.userId).all();

    // Shared groups I belong to (I am caregiver/member)
    const { results: groups } = await db.prepare(
      "SELECT u.id as owner_id, u.email as owner_email, u.name as owner_name, u.avatar as owner_avatar, sm.created_at as joined_at " +
      "FROM shared_members sm JOIN users u ON sm.owner_id = u.id " +
      "WHERE sm.member_id = ? ORDER BY sm.created_at DESC"
    ).bind(authUser.userId).all();

    return new Response(
      JSON.stringify({
        success: true,
        shareCode,
        members: (members || []).map(m => ({
          id: m.id,
          email: m.email,
          name: m.name || m.email.split('@')[0],
          avatar: m.avatar || '',
          joinedAt: m.joined_at
        })),
        sharedGroups: (groups || []).map(g => ({
          ownerId: g.owner_id,
          ownerEmail: g.owner_email,
          ownerName: g.owner_name || g.owner_email.split('@')[0],
          ownerAvatar: g.owner_avatar || '',
          joinedAt: g.joined_at
        }))
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}

