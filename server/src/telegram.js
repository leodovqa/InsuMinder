const TELEGRAM_API_BASE = 'https://api.telegram.org';

async function postToTelegramApi(token, targetChatId, text) {
  try {
    const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: text,
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || !data.ok) {
      const errorMsg = (data && data.description) ? data.description : `Telegram API error (${response.status})`;
      return { ok: false, error: errorMsg };
    }

    return { ok: true, result: data.result };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error reaching Telegram API.' };
  }
}

/**
 * Send a message to a Telegram chat using Telegram Bot API
 * Automatically handles Telegram Web K formats (e.g. -4304245048) by falling back to -1004304245048
 * @param {string} botToken
 * @param {string|number} chatId
 * @param {string} text
 * @returns {Promise<{ ok: boolean, error?: string, result?: any }>}
 */
async function sendTelegramMessage(botToken, chatId, text) {
  if (!botToken || !chatId) {
    return { ok: false, error: 'Telegram bot token and chat ID are required.' };
  }

  const cleanToken = String(botToken).trim();
  let cleanChatId = String(chatId).trim();

  if (!cleanToken || !cleanChatId) {
    return { ok: false, error: 'Telegram bot token and chat ID cannot be empty.' };
  }

  // Ensure leading '-' is present for channel/group IDs
  if (!cleanChatId.startsWith('-')) {
    cleanChatId = `-${cleanChatId}`;
  }

  // First try the exact chat ID provided
  const initialResult = await postToTelegramApi(cleanToken, cleanChatId, text);
  if (initialResult.ok) {
    return initialResult;
  }

  // If chat was not found and chatId was copied from Telegram Web K without 100 (e.g. -4304245048),
  // automatically try with the canonical channel prefix: -1004304245048
  if (initialResult.error && /chat not found/i.test(initialResult.error)) {
    if (cleanChatId.startsWith('-') && !cleanChatId.startsWith('-100')) {
      const altChatId = `-100${cleanChatId.slice(1)}`;
      const altResult = await postToTelegramApi(cleanToken, altChatId, text);
      if (altResult.ok) {
        return altResult;
      }
    } else if (!cleanChatId.startsWith('-') && cleanChatId.length >= 9) {
      const altChatId = `-100${cleanChatId}`;
      const altResult = await postToTelegramApi(cleanToken, altChatId, text);
      if (altResult.ok) {
        return altResult;
      }
    }
  }

  return initialResult;
}

module.exports = {
  sendTelegramMessage
};
