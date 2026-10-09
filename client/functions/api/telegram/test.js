import { ensureTablesExist, sendTelegramMessage } from '../_telegram.js';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    let { telegramBotToken, telegramChatId, configId } = (await context.request.json().catch(() => ({}))) || {};

    if (db) {
      await ensureTablesExist(db);

      if (configId) {
        const found = await db
          .prepare("SELECT * FROM telegram_configs WHERE id = ?")
          .bind(parseInt(configId, 10))
          .first();
        if (found) {
          telegramBotToken = found.bot_token;
          telegramChatId = found.chat_id;
        }
      }

      if (!telegramBotToken || !telegramChatId) {
        const active = await db
          .prepare("SELECT * FROM telegram_configs WHERE is_default = 1 LIMIT 1")
          .first();
        if (active) {
          telegramBotToken = active.bot_token;
          telegramChatId = active.chat_id;
        }
      }
    }

    if (!telegramBotToken || !telegramChatId || !String(telegramBotToken).trim() || !String(telegramChatId).trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Both Bot Token and Chat ID are required to send a test message.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const testMessage = "From InsuMinder:\nTelegram connection successful! Your injection reminders are active.";
    const result = await sendTelegramMessage(telegramBotToken, telegramChatId, testMessage);

    if (result.ok) {
      return new Response(
        JSON.stringify({ success: true, message: 'Test message sent successfully!' }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }
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
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

