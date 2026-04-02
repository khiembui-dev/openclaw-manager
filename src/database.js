'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');

let db = null;

function initDatabase() {
  const dbDir = path.dirname(config.db.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.db.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Admin users for the manager UI
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Installation metadata
    CREATE TABLE IF NOT EXISTS installation (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT DEFAULT 'not_installed',
      domain TEXT,
      ip_address TEXT,
      email TEXT,
      install_dir TEXT,
      openclaw_version TEXT,
      docker_image TEXT,
      image_digest TEXT,
      gateway_token TEXT,
      gateway_port INTEGER DEFAULT 18789,
      bridge_port INTEGER DEFAULT 18790,
      ssl_enabled INTEGER DEFAULT 0,
      ssl_expiry TEXT,
      installed_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- AI provider API keys (encrypted)
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      api_key_encrypted TEXT NOT NULL,
      label TEXT,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Current AI config
    CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      provider TEXT DEFAULT 'openai',
      model TEXT DEFAULT 'gpt-4o',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Custom providers (OpenAI-compatible)
    CREATE TABLE IF NOT EXISTS custom_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      base_url TEXT NOT NULL,
      api_key_encrypted TEXT,
      default_model TEXT,
      headers TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- ChatGPT OAuth tokens
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      provider TEXT DEFAULT 'chatgpt',
      access_token_encrypted TEXT,
      refresh_token_encrypted TEXT,
      model TEXT,
      status TEXT DEFAULT 'disconnected',
      connected_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Agents
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      agent_id TEXT UNIQUE NOT NULL,
      model TEXT,
      provider TEXT,
      system_prompt TEXT,
      temperature REAL,
      max_tokens INTEGER,
      is_main INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Routing bindings
    CREATE TABLE IF NOT EXISTS routing_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      pattern TEXT,
      agent_id TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
    );

    -- Channel configurations
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_type TEXT UNIQUE NOT NULL,
      token_encrypted TEXT,
      extra_config TEXT,
      is_enabled INTEGER DEFAULT 0,
      status TEXT DEFAULT 'disconnected',
      last_checked TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Jobs / task queue
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      message TEXT,
      result TEXT,
      error TEXT,
      log TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Settings key-value store
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed default data if empty
  const installRow = db.prepare('SELECT id FROM installation WHERE id = 1').get();
  if (!installRow) {
    db.prepare('INSERT INTO installation (id, status) VALUES (1, ?)').run('not_installed');
  }

  const aiRow = db.prepare('SELECT id FROM ai_config WHERE id = 1').get();
  if (!aiRow) {
    db.prepare('INSERT INTO ai_config (id, provider, model) VALUES (1, ?, ?)').run('openai', 'gpt-4o');
  }

  const mainAgent = db.prepare('SELECT id FROM agents WHERE is_main = 1').get();
  if (!mainAgent) {
    db.prepare(`
      INSERT INTO agents (name, agent_id, is_main, is_default, is_active)
      VALUES (?, ?, 1, 1, 1)
    `).run('Main Agent', 'main');
  }

  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = { initDatabase, getDb };
