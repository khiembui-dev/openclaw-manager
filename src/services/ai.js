'use strict';

const { getDb } = require('../database');
const { encrypt, decrypt, maskSecret } = require('../crypto');
const openclaw = require('./openclaw');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Get current AI configuration.
 */
function getAIConfig() {
  const db = getDb();
  const aiConfig = db.prepare('SELECT * FROM ai_config WHERE id = 1').get();
  const apiKeys = db.prepare('SELECT * FROM api_keys WHERE is_active = 1 ORDER BY is_default DESC, created_at DESC').all();
  const customProviders = db.prepare('SELECT * FROM custom_providers WHERE is_active = 1').all();
  const oauthToken = db.prepare('SELECT * FROM oauth_tokens WHERE id = 1').get();

  return {
    provider: aiConfig?.provider || 'openai',
    model: aiConfig?.model || 'gpt-4o',
    apiKeys: apiKeys.map(k => ({
      id: k.id,
      provider: k.provider,
      label: k.label,
      keyMasked: maskSecret(decrypt(k.api_key_encrypted)),
      isDefault: !!k.is_default,
      createdAt: k.created_at,
    })),
    customProviders: customProviders.map(p => ({
      id: p.id,
      name: p.name,
      baseUrl: p.base_url,
      defaultModel: p.default_model,
      hasKey: !!p.api_key_encrypted,
      createdAt: p.created_at,
    })),
    oauthStatus: oauthToken?.status || 'disconnected',
    oauthModel: oauthToken?.model || '',
    providers: config.providers,
    models: config.models,
  };
}

/**
 * Update provider and model.
 */
function updateProviderModel(provider, model) {
  const db = getDb();
  db.prepare('UPDATE ai_config SET provider = ?, model = ?, updated_at = datetime(\'now\') WHERE id = 1')
    .run(provider, model);

  // Update OpenClaw config
  try {
    const cfg = openclaw.readOpenClawConfig();
    if (!cfg.agents) cfg.agents = {};
    if (!cfg.agents.defaults) cfg.agents.defaults = {};
    if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {};
    cfg.agents.defaults.model.primary = `${provider}/${model}`;
    openclaw.writeOpenClawConfig(cfg);
  } catch (e) {
    logger.warn('Failed to update OpenClaw config:', e.message);
  }

  return { provider, model };
}

/**
 * Add an API key.
 */
function addApiKey(provider, apiKey, label = '') {
  const db = getDb();
  const encrypted = encrypt(apiKey);

  const result = db.prepare(
    'INSERT INTO api_keys (provider, api_key_encrypted, label) VALUES (?, ?, ?)'
  ).run(provider, encrypted, label || provider);

  // If this is the first key for this provider, set as default
  const count = db.prepare('SELECT COUNT(*) as cnt FROM api_keys WHERE provider = ?').get(provider).cnt;
  if (count === 1) {
    db.prepare('UPDATE api_keys SET is_default = 1 WHERE id = ?').run(result.lastInsertRowid);
  }

  // Update OpenClaw .env file
  syncApiKeysToEnv();

  return { id: result.lastInsertRowid };
}

/**
 * Delete an API key.
 */
function deleteApiKey(keyId) {
  const db = getDb();
  db.prepare('DELETE FROM api_keys WHERE id = ?').run(keyId);
  syncApiKeysToEnv();
}

/**
 * Set default API key for a provider.
 */
function setDefaultApiKey(keyId) {
  const db = getDb();
  const key = db.prepare('SELECT provider FROM api_keys WHERE id = ?').get(keyId);
  if (!key) throw new Error('API key không tồn tại');

  db.prepare('UPDATE api_keys SET is_default = 0 WHERE provider = ?').run(key.provider);
  db.prepare('UPDATE api_keys SET is_default = 1 WHERE id = ?').run(keyId);
  syncApiKeysToEnv();
}

/**
 * Sync API keys from database to OpenClaw .env file.
 */
function syncApiKeysToEnv() {
  const db = getDb();
  const defaultKeys = db.prepare(
    'SELECT provider, api_key_encrypted FROM api_keys WHERE is_default = 1 AND is_active = 1'
  ).all();

  for (const key of defaultKeys) {
    const providerDef = config.providers.find(p => p.id === key.provider);
    if (providerDef?.envKey) {
      const plainKey = decrypt(key.api_key_encrypted);
      if (plainKey) {
        openclaw.updateEnvFile(providerDef.envKey, plainKey);
      }
    }
  }
}

/**
 * Add custom provider.
 */
function addCustomProvider(name, baseUrl, apiKey, defaultModel, headers) {
  const db = getDb();
  const encrypted = apiKey ? encrypt(apiKey) : null;

  const result = db.prepare(
    'INSERT INTO custom_providers (name, base_url, api_key_encrypted, default_model, headers) VALUES (?, ?, ?, ?, ?)'
  ).run(name, baseUrl, encrypted, defaultModel, headers ? JSON.stringify(headers) : null);

  // Add to OpenClaw config
  try {
    const cfg = openclaw.readOpenClawConfig();
    if (!cfg.models) cfg.models = {};
    if (!cfg.models.providers) cfg.models.providers = {};
    cfg.models.providers[name.toLowerCase().replace(/\s+/g, '-')] = {
      baseUrl,
      api: 'openai-completions',
      models: defaultModel ? [{ id: defaultModel, name: defaultModel }] : [],
    };
    openclaw.writeOpenClawConfig(cfg);
  } catch (e) {
    logger.warn('Failed to add custom provider to config:', e.message);
  }

  return { id: result.lastInsertRowid };
}

/**
 * Delete custom provider.
 */
function deleteCustomProvider(providerId) {
  const db = getDb();
  const provider = db.prepare('SELECT name FROM custom_providers WHERE id = ?').get(providerId);
  db.prepare('DELETE FROM custom_providers WHERE id = ?').run(providerId);

  // Remove from OpenClaw config
  if (provider) {
    try {
      const cfg = openclaw.readOpenClawConfig();
      const key = provider.name.toLowerCase().replace(/\s+/g, '-');
      if (cfg.models?.providers?.[key]) {
        delete cfg.models.providers[key];
        openclaw.writeOpenClawConfig(cfg);
      }
    } catch (e) {
      logger.warn('Failed to remove custom provider from config:', e.message);
    }
  }
}

/**
 * Save ChatGPT OAuth token.
 */
function saveOAuthToken(accessToken, model) {
  const db = getDb();
  const encrypted = encrypt(accessToken);

  const existing = db.prepare('SELECT id FROM oauth_tokens WHERE id = 1').get();
  if (existing) {
    db.prepare(`
      UPDATE oauth_tokens SET
        access_token_encrypted = ?,
        model = ?,
        status = 'connected',
        connected_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = 1
    `).run(encrypted, model);
  } else {
    db.prepare(`
      INSERT INTO oauth_tokens (id, provider, access_token_encrypted, model, status, connected_at)
      VALUES (1, 'chatgpt', ?, ?, 'connected', datetime('now'))
    `).run(encrypted, model);
  }

  // Update env
  const plainToken = accessToken;
  openclaw.updateEnvFile('COPILOT_GITHUB_TOKEN', plainToken);

  return { status: 'connected', model };
}

/**
 * Disconnect ChatGPT OAuth.
 */
function disconnectOAuth() {
  const db = getDb();
  db.prepare(`
    UPDATE oauth_tokens SET
      access_token_encrypted = NULL,
      status = 'disconnected',
      updated_at = datetime('now')
    WHERE id = 1
  `).run();
}

module.exports = {
  getAIConfig,
  updateProviderModel,
  addApiKey,
  deleteApiKey,
  setDefaultApiKey,
  addCustomProvider,
  deleteCustomProvider,
  saveOAuthToken,
  disconnectOAuth,
};
