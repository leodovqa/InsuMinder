import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser, generateShareCode, isValidEmail } from '../_auth.js';
import { sendShareInviteEmail, EMAIL_ERROR_MESSAGE } from '../_email.js';

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
    const { email, inviteUrl } = body || {};

    if (!email || !String(email).trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Recipient email is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: EMAIL_ERROR_MESSAGE }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Ensure share code
    let user = await db.prepare("SELECT id, email, name, share_code FROM users WHERE id = ?").bind(authUser.userId).first();
    let shareCode = user?.share_code;
    if (!shareCode) {
      shareCode = generateShareCode();
      await db.prepare("UPDATE users SET share_code = ? WHERE id = ?").bind(shareCode, authUser.userId).run();
    }

    // Insert invite record
    await db.prepare("INSERT INTO share_invites (owner_id, invite_email, share_code) VALUES (?, ?, ?)")
      .bind(authUser.userId, cleanEmail, shareCode)
      .run();

    const url = new URL(request.url);
    const fallbackUrl = `${url.origin}/?shareCode=${shareCode}`;
    const finalInviteUrl = inviteUrl || fallbackUrl;

    const emailRes = await sendShareInviteEmail(
      env,
      cleanEmail,
      authUser.name,
      authUser.email,
      shareCode,
      finalInviteUrl
    );

    if (!emailRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: emailRes.error || EMAIL_ERROR_MESSAGE }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${cleanEmail}!`,
        shareCode,
        inviteUrl: finalInviteUrl
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

