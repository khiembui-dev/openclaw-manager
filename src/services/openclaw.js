'use strict';

const fs = require('fs');
const path = require('path');
const { getDb } = require('../database');
const config = require('../config');
const docker = require('./docker');
const { execCommand } = require('../utils/shell');
const { decrypt, encrypt, generateToken, maskSecret } = require('../crypto');
const logger = require('../utils/logger');

/**
 * Get full service info.
 */
function getServiceInfo() {
  const db = getDb();
  const installation = db.prepare('SELECT * FROM installation WHERE id = 1').get();
  const aiConfig = db.prepare('SELECT * FROM ai_config WHERE id = 1').get();
  const agentCount = db.prepare('SELECT COUNT(*) as cnt FROM agents WHERE is_active = 1').get().cnt;
  const channelCount = db.prepare("SELECT COUNT(*) as cnt FROM channels WHERE is_enabled = 1").get().cnt;

  let containerStatus = 'unknown';
  let containerDetails = [];

  if (installation && installation.install_dir && installation.status !== 'not_installed') {
    try {
      containerDetails = docker.getContainerStatus(installation.install_dir);
      if (containerDetails.length > 0) {
        const gateway = containerDetails.find(c =>
          c.Name?.includes('openclaw') || c.Service?.includes('openclaw')
        );
        if (gateway) {
          const state = (gateway.State || gateway.Status || '').toLowerCase();
          if (state.includes('running') || state.includes('up')) {
            containerStatus = 'running';
          } else if (state.includes('exited') || state.includes('dead')) {
            containerStatus = 'stopped';
          } else {
            containerStatus = 'error';
          }
        } else {
          containerStatus = 'stopped';
        }
      } else {
        containerStatus = 'stopped';
      }
    } catch {
      containerStatus = 'error';
    }

    // Update status in DB if changed
    if (containerStatus !== installation.status &&
        installation.status !== 'installing' &&
        installation.status !== 'upgrading') {
      db.prepare('UPDATE installation SET status = ?, updated_at = datetime(\'now\') WHERE id = 1')
        .run(containerStatus);
    }
  }

  const gatewayToken = installation?.gateway_token ? decrypt(installation.gateway_token) : '';

  return {
    status: installation?.status === 'not_installed' ? 'not_installed' : containerStatus,
    domain: installation?.domain || '',
    ipAddress: installation?.ip_address || '',
    version: installation?.openclaw_version || '',
    dockerImage: installation?.docker_image || '',
    imageDigest: installation?.image_digest || '',
    gatewayToken: gatewayToken,
    gatewayTokenMasked: maskSecret(gatewayToken),
    gatewayPort: installation?.gateway_port || config.openclaw.gatewayPort,
    bridgePort: installation?.bridge_port || config.openclaw.bridgePort,
    installDir: installation?.install_dir || config.openclaw.installDir,
    sslEnabled: !!installation?.ssl_enabled,
    sslExpiry: installation?.ssl_expiry || '',
    email: installation?.email || '',
    installedAt: installation?.installed_at || '',
    provider: aiConfig?.provider || 'openai',
    model: aiConfig?.model || 'gpt-4o',
    agentCount,
    channelCount,
    containerDetails,
  };
}

/**
 * Get dashboard URL.
 */
function getDashboardUrl() {
  const info = getServiceInfo();
  const proto = info.sslEnabled ? 'https' : 'http';
  const host = info.domain || info.ipAddress;
  const port = info.sslEnabled ? '' : `:${info.gatewayPort}`;
  return `${proto}://${host}${port}`;
}

/**
 * Regenerate gateway token.
 */
function regenerateGatewayToken() {
  const db = getDb();
  const installation = db.prepare('SELECT install_dir FROM installation WHERE id = 1').get();
  const newToken = generateToken(32);

  // Update DB
  db.prepare('UPDATE installation SET gateway_token = ?, updated_at = datetime(\'now\') WHERE id = 1')
    .run(encrypt(newToken));

  // Update .env file
  if (installation?.install_dir) {
    const envPath = path.join(installation.install_dir, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(
        /OPENCLAW_GATEWAY_TOKEN=.*/,
        `OPENCLAW_GATEWAY_TOKEN=${newToken}`
      );
      fs.writeFileSync(envPath, envContent);
    }

    // Restart container to pick up new token
    try {
      docker.composeRestart(installation.install_dir);
    } catch (e) {
      logger.warn('Failed to restart after token change:', e.message);
    }
  }

  return newToken;
}

/**
 * Create an OpenClaw user account via CLI.
 * This is an abstraction - the actual mechanism depends on OpenClaw's user system.
 */
async function createOpenClawAccount(username, password) {
  const db = getDb();
  const installation = db.prepare('SELECT * FROM installation WHERE id = 1').get();
  if (!installation || installation.status === 'not_installed') {
    throw new Error('OpenClaw chưa được cài đặt');
  }

  // OpenClaw uses gateway auth (token/password) rather than user accounts.
  // This creates a device pairing or sets up password auth.
  // For the manager, we store the credentials and configure gateway auth.

  const configPath = path.join(installation.install_dir, 'config', 'openclaw.json');
  let cfg = {};
  if (fs.existsSync(configPath)) {
    cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  // Set up password auth mode
  if (!cfg.gateway) cfg.gateway = {};
  if (!cfg.gateway.auth) cfg.gateway.auth = {};
  cfg.gateway.auth.mode = 'password';
  cfg.gateway.auth.password = password;

  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

  // Restart to apply
  try {
    await docker.composeRestart(installation.install_dir);
  } catch (e) {
    logger.warn('Restart after account creation:', e.message);
  }

  return {
    username,
    loginUrl: getDashboardUrl(),
  };
}

/**
 * Health check for OpenClaw.
 */
function healthCheck() {
  const db = getDb();
  const installation = db.prepare('SELECT * FROM installation WHERE id = 1').get();
  if (!installation || installation.status === 'not_installed') {
    return { ok: false, reason: 'not_installed' };
  }

  const checks = {
    container: false,
    gateway: false,
    reverseProxy: false,
    ssl: false,
    disk: false,
  };

  // Container check
  const containers = docker.getContainerStatus(installation.install_dir);
  checks.container = containers.some(c => {
    const state = (c.State || c.Status || '').toLowerCase();
    return state.includes('running') || state.includes('up');
  });

  // Gateway HTTP check
  const port = installation.gateway_port || config.openclaw.gatewayPort;
  const healthResult = execCommand(`curl -sf --max-time 5 http://127.0.0.1:${port}/healthz`);
  checks.gateway = healthResult.success;

  // Reverse proxy check (if domain set)
  if (installation.domain) {
    const proxyResult = execCommand(`curl -sf --max-time 5 http://${installation.domain}/healthz`);
    checks.reverseProxy = proxyResult.success;
  } else {
    checks.reverseProxy = true; // N/A
  }

  // SSL check
  if (installation.ssl_enabled && installation.domain) {
    const sslResult = execCommand(
      `echo | openssl s_client -connect ${installation.domain}:443 -servername ${installation.domain} 2>/dev/null | openssl x509 -noout -dates`,
      { timeout: 10000 }
    );
    checks.ssl = sslResult.success;
  } else {
    checks.ssl = true; // N/A
  }

  // Disk check (at least 1GB free)
  const dfResult = execCommand("df -BG / | tail -1 | awk '{print $4}'");
  if (dfResult.success) {
    const freeGB = parseInt(dfResult.stdout, 10);
    checks.disk = freeGB >= 1;
  }

  const ok = checks.container && checks.gateway;

  return { ok, checks };
}

/**
 * Read OpenClaw config file.
 */
function readOpenClawConfig() {
  const db = getDb();
  const installation = db.prepare('SELECT install_dir FROM installation WHERE id = 1').get();
  if (!installation?.install_dir) return {};

  const configPath = path.join(installation.install_dir, 'config', 'openclaw.json');
  if (!fs.existsSync(configPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Write OpenClaw config file.
 */
function writeOpenClawConfig(cfg) {
  const db = getDb();
  const installation = db.prepare('SELECT install_dir FROM installation WHERE id = 1').get();
  if (!installation?.install_dir) throw new Error('OpenClaw chưa được cài đặt');

  const configPath = path.join(installation.install_dir, 'config', 'openclaw.json');
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

/**
 * Read .env file from OpenClaw install dir.
 */
function readEnvFile() {
  const db = getDb();
  const installation = db.prepare('SELECT install_dir FROM installation WHERE id = 1').get();
  if (!installation?.install_dir) return {};

  const envPath = path.join(installation.install_dir, '.env');
  if (!fs.existsSync(envPath)) return {};

  const env = {};
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        env[trimmed.substring(0, eqIndex)] = trimmed.substring(eqIndex + 1);
      }
    }
  });
  return env;
}

/**
 * Update a key in the .env file.
 */
function updateEnvFile(key, value) {
  const db = getDb();
  const installation = db.prepare('SELECT install_dir FROM installation WHERE id = 1').get();
  if (!installation?.install_dir) return;

  const envPath = path.join(installation.install_dir, '.env');
  if (!fs.existsSync(envPath)) return;

  let content = fs.readFileSync(envPath, 'utf8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, content);
}

module.exports = {
  getServiceInfo,
  getDashboardUrl,
  regenerateGatewayToken,
  createOpenClawAccount,
  healthCheck,
  readOpenClawConfig,
  writeOpenClawConfig,
  readEnvFile,
  updateEnvFile,
};
