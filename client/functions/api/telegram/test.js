import { ensureTablesExist, sendTelegramMessage, buildTestMessage } from '../_telegram.js';
import { getAuthUser } from '../_auth.js';

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    let { telegramBotToken, telegramChatId, configId, language } = (await context.request.json().catch(() => ({}))) || {};

    let userLang = language;

    if (db) {
      await ensureTablesExist(db);

      if (!userLang) {
        const authUser = await getAuthUser(context.request, context.env);
        if (authUser && authUser.userId) {
          const userRow = await db
            .prepare("SELECT language FROM users WHERE id = ?")
            .bind(authUser.userId)
            .first();
          if (userRow && userRow.language) {
            userLang = userRow.language;
          }
        }
      }

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
          error: userLang === 'he'
            ? 'נדרשים גם טוקן בוט וגם מזהה שיחה לשליחת הודעת בדיקה.'
            : (userLang === 'ru'
              ? 'Для отправки тестового сообщения требуются токен бота и ID чата.'
              : 'Both Bot Token and Chat ID are required to send a test message.')
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const url = new URL(context.request.url);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const testMessage = buildTestMessage(userLang || 'en', isLocal);
    const result = await sendTelegramMessage(telegramBotToken, telegramChatId, testMessage);

    if (result.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          message: userLang === 'he'
            ? 'הודעת בדיקה נשלחה בהצלחה!'
            : (userLang === 'ru'
              ? 'Тестовое сообщение успешно отправлено!'
              : 'Test message sent successfully!')
        }),
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

