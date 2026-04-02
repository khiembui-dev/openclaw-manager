'use strict';

const { getDb } = require('../database');
const { encrypt, decrypt, maskSecret } = require('../crypto');
const openclaw = require('./openclaw');
const { execCommand } = require('../utils/shell');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Get all channel configurations.
 */
function getChannels() {
  const db = getDb();
  const channels = db.prepare('SELECT * FROM channels').all();

  // Build full list with definitions
  return config.channels.map(def => {
    const saved = channels.find(c => c.channel_type === def.id);
    return {
      id: def.id,
      name: def.name,
      icon: def.icon,
      tokenField: def.tokenField,
      isEnabled: saved ? !!saved.is_enabled : false,
      status: saved?.status || 'disconnected',
      hasToken: saved ? !!saved.token_encrypted : false,
      tokenMasked: saved?.token_encrypted ? maskSecret(decrypt(saved.token_encrypted)) : '',
      lastChecked: saved?.last_checked || null,
    };
  });
}

/**
 * Update channel configuration.
 */
function updateChannel(channelType, token, enabled) {
  const db = getDb();
  const def = config.channels.find(c => c.id === channelType);
  if (!def) throw new Error('Kênh không hợp lệ');

  const encrypted = token ? encrypt(token) : null;
  const existing = db.prepare('SELECT id FROM channels WHERE channel_type = ?').get(channelType);

  if (existing) {
    if (token) {
      db.prepare(`
        UPDATE channels SET
          token_encrypted = ?,
          is_enabled = ?,
          updated_at = datetime('now')
        WHERE channel_type = ?
      `).run(encrypted, enabled ? 1 : 0, channelType);
    } else {
      db.prepare(`
        UPDATE channels SET
          is_enabled = ?,
          updated_at = datetime('now')
        WHERE channel_type = ?
      `).run(enabled ? 1 : 0, channelType);
    }
  } else {
    db.prepare(`
      INSERT INTO channels (channel_type, token_encrypted, is_enabled, status)
      VALUES (?, ?, ?, 'disconnected')
    `).run(channelType, encrypted, enabled ? 1 : 0);
  }

  // Sync to OpenClaw env and config
  syncChannelToEnv(channelType);
  syncChannelToConfig(channelType);

  return { success: true };
}

/**
 * Test channel connection.
 */
async function testChannel(channelType) {
  const db = getDb();
  const channel = db.prepare('SELECT * FROM channels WHERE channel_type = ?').get(channelType);
  if (!channel?.token_encrypted) {
    return { success: false, error: 'Token chưa được cấu hình' };
  }

  const token = decrypt(channel.token_encrypted);
  let result = { success: false, error: 'Unknown channel type' };

  switch (channelType) {
    case 'telegram': {
      const resp = execCommand(
        `curl -sf --max-time 10 "https://api.telegram.org/bot${token}/getMe"`,
        { timeout: 15000 }
      );
      if (resp.success) {
        try {
          const data = JSON.parse(resp.stdout);
          if (data.ok) {
            result = { success: true, info: `Bot: @${data.result.username}` };
          } else {
            result = { success: false, error: data.description || 'Token không hợp lệ' };
          }
        } catch {
          result = { success: false, error: 'Phản hồi không hợp lệ' };
        }
      } else {
        result = { success: false, error: 'Không thể kết nối đến Telegram API' };
      }
      break;
    }
    case 'discord': {
      const resp = execCommand(
        `curl -sf --max-time 10 -H "Authorization: Bot ${token}" "https://discord.com/api/v10/users/@me"`,
        { timeout: 15000 }
      );
      if (resp.success) {
        try {
          const data = JSON.parse(resp.stdout);
          if (data.id) {
            result = { success: true, info: `Bot: ${data.username}#${data.discriminator}` };
          } else {
            result = { success: false, error: 'Token không hợp lệ' };
          }
        } catch {
          result = { success: false, error: 'Phản hồi không hợp lệ' };
        }
      } else {
        result = { success: false, error: 'Không thể kết nối đến Discord API' };
      }
      break;
    }
    case 'slack': {
      const resp = execCommand(
        `curl -sf --max-time 10 -H "Authorization: Bearer ${token}" "https://slack.com/api/auth.test"`,
        { timeout: 15000 }
      );
      if (resp.success) {
        try {
          const data = JSON.parse(resp.stdout);
          if (data.ok) {
            result = { success: true, info: `Team: ${data.team}, Bot: ${data.user}` };
          } else {
            result = { success: false, error: data.error || 'Token không hợp lệ' };
          }
        } catch {
          result = { success: false, error: 'Phản hồi không hợp lệ' };
        }
      } else {
        result = { success: false, error: 'Không thể kết nối đến Slack API' };
      }
      break;
    }
    case 'zalo': {
      // Zalo API test - basic validation
      result = { success: true, info: 'Token đã được lưu (kiểm tra kết nối khi khởi động)' };
      break;
    }
  }

  // Update status
  const newStatus = result.success ? 'connected' : 'error';
  db.prepare(`
    UPDATE channels SET status = ?, last_checked = datetime('now') WHERE channel_type = ?
  `).run(newStatus, channelType);

  return result;
}

/**
 * Sync channel token to OpenClaw .env file.
 */
function syncChannelToEnv(channelType) {
  const db = getDb();
  const channel = db.prepare('SELECT * FROM channels WHERE channel_type = ?').get(channelType);
  const def = config.channels.find(c => c.id === channelType);
  if (!def || !channel) return;

  if (channel.is_enabled && channel.token_encrypted) {
    const token = decrypt(channel.token_encrypted);
    openclaw.updateEnvFile(def.tokenField, token);
  }
}

/**
 * Sync channel to OpenClaw config.
 */
function syncChannelToConfig(channelType) {
  try {
    const db = getDb();
    const channel = db.prepare('SELECT * FROM channels WHERE channel_type = ?').get(channelType);
    const cfg = openclaw.readOpenClawConfig();
    if (!cfg.channels) cfg.channels = {};

    cfg.channels[channelType] = {
      enabled: channel ? !!channel.is_enabled : false,
    };

    openclaw.writeOpenClawConfig(cfg);
  } catch (e) {
    logger.warn('Failed to sync channel config:', e.message);
  }
}

module.exports = { getChannels, updateChannel, testChannel };
