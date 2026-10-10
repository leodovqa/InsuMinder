import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser } from '../_auth.js';

export async function onRequestPost(context) {
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

    const body = await request.json().catch(() => ({}));
    const { shareCode } = body || {};

    if (!shareCode || !String(shareCode).trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Share code is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const cleanCode = String(shareCode).trim().toUpperCase();
    const owner = await db.prepare("SELECT id, email, name FROM users WHERE share_code = ?").bind(cleanCode).first();

    if (!owner) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid share code. Please check the code and try again.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (owner.id === authUser.userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'You cannot join your own shared group.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const existing = await db.prepare("SELECT id FROM shared_members WHERE owner_id = ? AND member_id = ?")
      .bind(owner.id, authUser.userId)
      .first();

    if (!existing) {
      await db.prepare("INSERT INTO shared_members (owner_id, member_id) VALUES (?, ?)")
        .bind(owner.id, authUser.userId)
        .run();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully connected to shared account (${owner.email})!`,
        owner: {
          ownerId: owner.id,
          ownerEmail: owner.email,
          ownerName: owner.name || owner.email.split('@')[0]
        }
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}

