import { ensureTablesExist } from './_telegram.js';
import { getAuthUser, getEffectiveUserId } from './_auth.js';

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({
          success: false,
          configs: [],
          error: "D1 database binding 'DB' not configured."
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    await ensureTablesExist(db);

    const authUser = await getAuthUser(context.request, context.env);
    if (!authUser || !authUser.userId) {
      return new Response(
        JSON.stringify({ success: true, configs: [] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    const effectiveUserId = await getEffectiveUserId(context.request, context.env, authUser, db);

    const { results } = await db
      .prepare("SELECT * FROM telegram_configs WHERE user_id = ? ORDER BY is_default DESC, id DESC")
      .bind(effectiveUserId)
      .all();

    const configs = (results || []).map((row) => ({
      id: row.id,
      name: row.name,
      botToken: row.bot_token,
      chatId: row.chat_id,
      isDefault: Boolean(row.is_default)
    }));

    return new Response(
      JSON.stringify({ success: true, configs }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message, configs: [] }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: "D1 database binding 'DB' not configured." }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    await ensureTablesExist(db);

    const authUser = await getAuthUser(context.request, context.env);
    if (!authUser || !authUser.userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required. Please sign in.' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    const body = await context.request.json().catch(() => ({}));
    const { name, botToken, chatId } = body || {};

    if (!botToken || !chatId || !String(botToken).trim() || !String(chatId).trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Both Bot Token and Chat ID are required.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    const effectiveUserId = await getEffectiveUserId(context.request, context.env, authUser, db);
    const cleanToken = String(botToken).trim();
    const rawChatId = String(chatId).trim().replace(/^-+/, '');
    const cleanChatId = `-${rawChatId}`;
    const cleanName = (name && String(name).trim()) || '';

    // Mark user's existing configs as not default
    await db.prepare("UPDATE telegram_configs SET is_default = 0 WHERE user_id = ?").bind(effectiveUserId).run();

    // Insert new default config
    const insertInfo = await db
      .prepare("INSERT INTO telegram_configs (user_id, name, bot_token, chat_id, is_default) VALUES (?, ?, ?, ?, 1)")
      .bind(effectiveUserId, cleanName, cleanToken, cleanChatId)
      .run();

    const newId = insertInfo.meta?.last_row_id || 1;

    return new Response(
      JSON.stringify({
        success: true,
        config: {
          id: newId,
          name: cleanName,
          botToken: cleanToken,
          chatId: cleanChatId,
          isDefault: true
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-auth-token, x-active-context, x-active-owner-id'
    }
  });
}
