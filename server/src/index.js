const express = require('express');
const cors = require('cors');
const db = require('./db');
const { sendTelegramMessage } = require('./telegram');
const scheduler = require('./scheduler');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Injections API
app.post('/api/injections', (req, res) => {
  db.insertInjectionLog(function(err) {
    if (err) {
      const status = err.status || 500;
      res.status(status).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, id: this.lastID });
    }
  });
});

app.get('/api/logs', (req, res) => {
  db.getLogsFromLast24Hours(function(err, rows) {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ success: true, logs: rows });
    }
  });
});

// Telegram Configurations API
app.get('/api/telegram-configs', (req, res) => {
  db.getTelegramConfigs((err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    const configs = (rows || []).map(r => ({
      id: r.id,
      name: r.name || `Chat (${r.chat_id})`,
      botToken: r.bot_token,
      chatId: r.chat_id,
      isDefault: Boolean(r.is_default),
      createdAt: r.created_at
    }));
    res.json({ success: true, configs });
  });
});

app.post('/api/telegram-configs', (req, res) => {
  const { name, botToken, chatId } = req.body || {};
  if (!botToken || !chatId || !String(botToken).trim() || !String(chatId).trim()) {
    return res.status(400).json({
      success: false,
      error: 'Bot Token and Chat ID are required.'
    });
  }

  const rawChatId = String(chatId).trim().replace(/^-+/, '');
  const cleanChatId = `-${rawChatId}`;

  db.addTelegramConfig({
    name: name ? String(name).trim() : '',
    bot_token: String(botToken).trim(),
    chat_id: cleanChatId
  }, (err, newConfig) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    scheduler.checkAndDispatchNotifications();

    res.json({
      success: true,
      config: {
        id: newConfig.id,
        name: newConfig.name,
        botToken: newConfig.bot_token,
        chatId: newConfig.chat_id,
        isDefault: Boolean(newConfig.is_default)
      }
    });
  });
});

app.put('/api/telegram-configs/:id/default', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid configuration ID.' });
  }

  db.setDefaultTelegramConfig(id, (err, updated) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    scheduler.checkAndDispatchNotifications();

    res.json({
      success: true,
      config: updated ? {
        id: updated.id,
        name: updated.name,
        botToken: updated.bot_token,
        chatId: updated.chat_id,
        isDefault: Boolean(updated.is_default)
      } : null
    });
  });
});

app.delete('/api/telegram-configs/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid configuration ID.' });
  }

  db.deleteTelegramConfig(id, (err) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    res.json({ success: true });
  });
});

// Settings API (Backward compatibility)
app.get('/api/settings', (req, res) => {
  db.getDefaultTelegramConfig((err, active) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({
      success: true,
      settings: {
        telegramBotToken: active ? active.bot_token : '',
        telegramChatId: active ? active.chat_id : ''
      }
    });
  });
});

app.post('/api/settings', (req, res) => {
  const { telegramBotToken, telegramChatId, name } = req.body || {};
  if (!telegramBotToken || !telegramChatId || !String(telegramBotToken).trim() || !String(telegramChatId).trim()) {
    return res.status(400).json({ success: false, error: 'Bot Token and Chat ID are required.' });
  }

  const rawChatId = String(telegramChatId).trim().replace(/^-+/, '');
  const cleanChatId = `-${rawChatId}`;

  db.addTelegramConfig({
    name: name || '',
    bot_token: String(telegramBotToken).trim(),
    chat_id: cleanChatId
  }, (err) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    scheduler.checkAndDispatchNotifications();

    res.json({ success: true });
  });
});

// Test Telegram notification API
app.post('/api/telegram/test', async (req, res) => {
  try {
    let { telegramBotToken, telegramChatId, configId } = req.body || {};

    if (configId) {
      const configs = await new Promise((resolve, reject) => {
        db.getTelegramConfigs((err, rows) => (err ? reject(err) : resolve(rows || [])));
      });
      const found = configs.find(c => c.id === parseInt(configId, 10));
      if (found) {
        telegramBotToken = found.bot_token;
        telegramChatId = found.chat_id;
      }
    }

    if (!telegramBotToken || !telegramChatId) {
      // Fallback to active default configuration
      const active = await new Promise((resolve, reject) => {
        db.getDefaultTelegramConfig((err, result) => (err ? reject(err) : resolve(result)));
      });
      if (active) {
        telegramBotToken = active.bot_token;
        telegramChatId = active.chat_id;
      }
    }

    if (!telegramBotToken || !telegramChatId) {
      return res.status(400).json({
        success: false,
        error: 'Both Bot Token and Chat ID are required to send a test message.'
      });
    }

    const testMessage = "From InsuMinder:\nTelegram connection successful! Your injection reminders are active.";
    const result = await sendTelegramMessage(telegramBotToken, telegramChatId, testMessage);

    if (result.ok) {
      res.json({ success: true, message: 'Test message sent successfully!' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start scheduler worker
scheduler.startScheduler(30000);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
