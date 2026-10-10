import { ensureTablesExist } from '../_telegram.js';
import { isValidEmail, hashPassword, generateVerificationCode } from '../_auth.js';
import { sendVerificationEmail, EMAIL_ERROR_MESSAGE } from '../_email.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding (DB) is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  await ensureTablesExist(db);

  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    if (!email || !String(email).trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Email address is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      return new Response(JSON.stringify({ success: false, error: EMAIL_ERROR_MESSAGE }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!password || String(password).length < 6) {
      return new Response(JSON.stringify({ success: false, error: 'Password must be at least 6 characters long.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existingUser = await db
      .prepare('SELECT id, is_verified, auth_provider, google_id FROM users WHERE email = ?')
      .bind(cleanEmail)
      .first();

    if (existingUser) {
      return new Response(JSON.stringify({ success: false, error: 'This email is already registered. Please log in.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const emailResult = await sendVerificationEmail(env, cleanEmail, code);
    if (!emailResult.ok) {
      return new Response(JSON.stringify({ success: false, error: emailResult.error || EMAIL_ERROR_MESSAGE }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const passwordHash = await hashPassword(String(password));

    await db
      .prepare('INSERT INTO verification_codes (email, password_hash, code, expires_at, consumed) VALUES (?, ?, ?, ?, 0)')
      .bind(cleanEmail, passwordHash, code, expiresAt)
      .run();

    return new Response(JSON.stringify({
      success: true,
      email: cleanEmail,
      expiresAt,
      devCode: emailResult.devCode,
      message: 'Verification code sent to your email.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Registration failed.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

