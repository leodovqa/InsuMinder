CREATE TABLE IF NOT EXISTS injection_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    injected_at TIMESTAMP NOT NULL,
    notify_10m_at TIMESTAMP NOT NULL,
    notify_2h_at TIMESTAMP NOT NULL,
    notify_3h_at TIMESTAMP NOT NULL,
    status_10m_sent BOOLEAN DEFAULT 0,
    status_2h_sent BOOLEAN DEFAULT 0,
    status_3h_sent BOOLEAN DEFAULT 0,
    error_10m TEXT,
    error_2h TEXT,
    error_3h TEXT
);

CREATE TABLE IF NOT EXISTS telegram_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    bot_token TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
