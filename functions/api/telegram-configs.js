import { ensureTablesExist } from './_telegram.js';

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

    const { results } = await db
      .prepare("SELECT * FROM telegram_configs ORDER BY is_default DESC, id DESC")
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

    const cleanToken = String(botToken).trim();
    const rawChatId = String(chatId).trim().replace(/^-+/, '');
    const cleanChatId = `-${rawChatId}`;
    const cleanName = (name && String(name).trim()) || '';

    // Mark all existing as not default
    await db.prepare("UPDATE telegram_configs SET is_default = 0").run();

    // Insert new default config
    const insertInfo = await db
      .prepare("INSERT INTO telegram_configs (name, bot_token, chat_id, is_default) VALUES (?, ?, ?, 1)")
      .bind(cleanName, cleanToken, cleanChatId)
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
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

