'use strict';

const express = require('express');
const router = express.Router();
const { auditLog } = require('../middleware/auth');
const logger = require('../utils/logger');

// Service modules
const openclaw = require('../services/openclaw');
const installer = require('../services/installer');
const domainService = require('../services/domain');
const aiService = require('../services/ai');
const agentService = require('../services/agents');
const channelService = require('../services/channels');
const backupService = require('../services/backup');
const docker = require('../services/docker');
const systemService = require('../services/system');
const jobService = require('../services/jobs');
const { isValidDomain, isValidEmail, isValidPort, isValidModel, sanitizeForShell } = require('../utils/validator');

// ==========================================
// Service Info
// ==========================================
router.get('/service/info', (req, res) => {
  try {
    const info = openclaw.getServiceInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/service/health', (req, res) => {
  try {
    const health = openclaw.healthCheck();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/service/token/regenerate', (req, res) => {
  try {
    const newToken = openclaw.regenerateGatewayToken();
    auditLog(req.session.user.id, 'regenerate_token', 'Token đã được tạo mới', req.ip);
    res.json({ success: true, token: newToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/service/account', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username và password không được để trống' });
    }
    const result = await openclaw.createOpenClawAccount(username, password);
    auditLog(req.session.user.id, 'create_account', `Tạo tài khoản: ${username}`, req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Installation
// ==========================================
router.post('/install', async (req, res) => {
  try {
    const { domain, email, installDir, gatewayPort, bridgePort, image } = req.body;

    if (domain && !isValidDomain(domain)) {
      return res.status(400).json({ error: 'Domain không hợp lệ' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }

    const jobId = jobService.createJob('install', 'Cài đặt OpenClaw');
    auditLog(req.session.user.id, 'install_start', 'Bắt đầu cài đặt OpenClaw', req.ip);

    // Run installation in background
    jobService.runJob(jobId, async (logFn, progressFn) => {
      await installer.installOpenClaw(
        { domain, email, installDir, gatewayPort, bridgePort, image },
        logFn, progressFn
      );
    });

    res.json({ success: true, jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Jobs
// ==========================================
router.get('/jobs/active', (req, res) => {
  try {
    res.json(jobService.getActiveJobs());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/jobs/recent', (req, res) => {
  try {
    res.json(jobService.getRecentJobs(20));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/jobs/:id', (req, res) => {
  try {
    const job = jobService.getJob(parseInt(req.params.id, 10));
    if (!job) return res.status(404).json({ error: 'Job không tồn tại' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Domain & SSL
// ==========================================
router.get('/domain/info', (req, res) => {
  try {
    const info = openclaw.getServiceInfo();
    res.json({
      domain: info.domain,
      ipAddress: info.ipAddress,
      email: info.email,
      sslEnabled: info.sslEnabled,
      sslExpiry: info.sslExpiry,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/domain/check-dns', (req, res) => {
  try {
    const { domain } = req.body;
    if (!isValidDomain(domain)) return res.status(400).json({ error: 'Domain không hợp lệ' });
    const info = openclaw.getServiceInfo();
    const result = domainService.checkDNS(domain, info.ipAddress);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/domain/update', async (req, res) => {
  try {
    const { domain, email } = req.body;
    if (!isValidDomain(domain)) return res.status(400).json({ error: 'Domain không hợp lệ' });
    if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ' });

    const jobId = jobService.createJob('domain_update', 'Cập nhật tên miền');
    auditLog(req.session.user.id, 'domain_update', `Cập nhật domain: ${domain}`, req.ip);

    jobService.runJob(jobId, async (logFn) => {
      await domainService.updateDomain(domain, email, logFn);
    });

    res.json({ success: true, jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/domain/ssl-info', (req, res) => {
  try {
    const info = openclaw.getServiceInfo();
    if (!info.domain) return res.json({ ssl: null });
    const sslInfo = domainService.getSSLInfo(info.domain);
    res.json({ ssl: sslInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AI Configuration
// ==========================================
router.get('/ai/config', (req, res) => {
  try {
    res.json(aiService.getAIConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/provider-model', async (req, res) => {
  try {
    const { provider, model } = req.body;
    if (!provider) return res.status(400).json({ error: 'Provider khong duoc de trong' });
    if (!model) return res.status(400).json({ error: 'Model khong duoc de trong' });
    const result = await aiService.updateProviderModel(provider, model);
    auditLog(req.session.user.id, 'update_ai', `Provider: ${provider}, Model: ${model}`, req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/api-key', async (req, res) => {
  try {
    const { provider, apiKey, label } = req.body;
    if (!provider) return res.status(400).json({ error: 'Provider khong duoc de trong' });
    if (!apiKey) return res.status(400).json({ error: 'API key khong duoc de trong' });
    const result = await aiService.addApiKey(provider, apiKey, label);
    auditLog(req.session.user.id, 'add_api_key', `Provider: ${provider}`, req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/ai/api-key/:id', async (req, res) => {
  try {
    await aiService.deleteApiKey(parseInt(req.params.id, 10));
    auditLog(req.session.user.id, 'delete_api_key', `Key ID: ${req.params.id}`, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/api-key/:id/default', async (req, res) => {
  try {
    await aiService.setDefaultApiKey(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/custom-provider', (req, res) => {
  try {
    const { name, baseUrl, apiKey, defaultModel, headers } = req.body;
    if (!name || !baseUrl) return res.status(400).json({ error: 'Tên và Base URL không được để trống' });
    const result = aiService.addCustomProvider(name, baseUrl, apiKey, defaultModel, headers);
    auditLog(req.session.user.id, 'add_custom_provider', `Provider: ${name}`, req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/ai/custom-provider/:id', (req, res) => {
  try {
    aiService.deleteCustomProvider(parseInt(req.params.id, 10));
    auditLog(req.session.user.id, 'delete_custom_provider', `Provider ID: ${req.params.id}`, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/oauth/generate-url', async (req, res) => {
  try {
    const { execCommand } = require('../utils/shell');
    const info = openclaw.getServiceInfo();
    const installDir = info.installDir;

    // Try to get OAuth URL from OpenClaw CLI
    const result = execCommand(
      `cd ${installDir} && docker compose exec -T openclaw-gateway openclaw channels login chatgpt --no-open 2>&1 | head -10`,
      { timeout: 15000 }
    );

    let url = null;
    if (result.success && result.stdout) {
      // Parse URL from CLI output
      const urlMatch = result.stdout.match(/(https?:\/\/[^\s]+auth[^\s]+)/);
      if (urlMatch) {
        url = urlMatch[1];
      }
    }

    // If CLI didn't work, construct URL manually with PKCE
    if (!url) {
      const crypto = require('crypto');
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      const state = crypto.randomBytes(16).toString('hex');

      // Save code_verifier for token exchange later
      const { getDb } = require('../database');
      const db = getDb();
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('oauth_code_verifier', ?, datetime('now'))").run(codeVerifier);
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('oauth_state', ?, datetime('now'))").run(state);

      url = 'https://auth.openai.com/oauth/authorize?' + [
        'response_type=code',
        'client_id=app_EMoamEEZ73f0CkXaXp7hrann',
        'redirect_uri=' + encodeURIComponent('http://localhost:1455/auth/callback'),
        'scope=' + encodeURIComponent('openid profile email offline_access'),
        'code_challenge=' + codeChallenge,
        'code_challenge_method=S256',
        'state=' + state,
        'id_token_add_organizations=true',
        'codex_cli_simplified_flow=true',
        'originator=pi',
      ].join('&');
    }

    res.json({ url, fromCli: !!url });
  } catch (err) {
    res.status(500).json({ error: err.message, url: null });
  }
});

router.post('/ai/oauth/save', async (req, res) => {
  try {
    const { accessToken, model } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Access token khong duoc de trong' });
    const result = await aiService.saveOAuthToken(accessToken, model || 'gpt-5.4');
    auditLog(req.session.user.id, 'oauth_connect', 'ChatGPT OAuth connected', req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/ai/oauth/disconnect', async (req, res) => {
  try {
    await aiService.disconnectOAuth();
    auditLog(req.session.user.id, 'oauth_disconnect', 'ChatGPT OAuth disconnected', req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Agents
// ==========================================
router.get('/agents', (req, res) => {
  try {
    const agents = agentService.getAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agents', (req, res) => {
  try {
    const { name, model, provider, systemPrompt, temperature, maxTokens } = req.body;
    if (!name) return res.status(400).json({ error: 'Tên agent không được để trống' });
    const result = agentService.createAgent({ name, model, provider, systemPrompt, temperature, maxTokens });
    auditLog(req.session.user.id, 'create_agent', `Agent: ${name}`, req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/agents/:agentId', (req, res) => {
  try {
    agentService.updateAgent(req.params.agentId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/agents/:agentId', (req, res) => {
  try {
    agentService.deleteAgent(req.params.agentId);
    auditLog(req.session.user.id, 'delete_agent', `Agent: ${req.params.agentId}`, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agents/:agentId/default', (req, res) => {
  try {
    agentService.setDefaultAgent(req.params.agentId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/agents/bindings', (req, res) => {
  try {
    res.json(agentService.getRoutingBindings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agents/bindings', (req, res) => {
  try {
    const { channel, pattern, agentId } = req.body;
    if (!channel || !agentId) return res.status(400).json({ error: 'Channel và Agent ID không được để trống' });
    const result = agentService.addRoutingBinding(channel, pattern, agentId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/agents/bindings/:id', (req, res) => {
  try {
    agentService.deleteRoutingBinding(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Channels
// ==========================================
router.get('/channels', (req, res) => {
  try {
    res.json(channelService.getChannels());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/channels/:channelType', (req, res) => {
  try {
    const { token, enabled } = req.body;
    channelService.updateChannel(req.params.channelType, token, enabled);
    auditLog(req.session.user.id, 'update_channel', `Channel: ${req.params.channelType}`, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/channels/:channelType/test', async (req, res) => {
  try {
    const result = await channelService.testChannel(req.params.channelType);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Version & Upgrade
// ==========================================
router.get('/version/info', (req, res) => {
  try {
    const info = openclaw.getServiceInfo();
    res.json({
      version: info.version,
      dockerImage: info.dockerImage,
      imageDigest: info.imageDigest,
      managerVersion: require('../../package.json').version,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/version/upgrade', async (req, res) => {
  try {
    const jobId = jobService.createJob('upgrade', 'Nâng cấp OpenClaw');
    auditLog(req.session.user.id, 'upgrade_start', 'Bắt đầu nâng cấp OpenClaw', req.ip);

    jobService.runJob(jobId, async (logFn, progressFn) => {
      const info = openclaw.getServiceInfo();
      const installDir = info.installDir;

      logFn('Backup cấu hình trước khi nâng cấp...');
      progressFn(10, 'Backup...');
      try {
        await backupService.createBackup();
        logFn('✓ Backup hoàn tất');
      } catch (e) {
        logFn(`⚠ Backup lỗi: ${e.message} - Tiếp tục nâng cấp...`);
      }

      logFn('Pull image mới nhất...');
      progressFn(30, 'Tải image...');
      await docker.pullImage(info.dockerImage || 'ghcr.io/openclaw/openclaw:latest', logFn);

      logFn('Tạo lại container...');
      progressFn(60, 'Recreate container...');
      await docker.composeRebuild(installDir, logFn);

      logFn('Health check...');
      progressFn(85, 'Kiểm tra...');
      const { execCommand } = require('../utils/shell');
      let healthy = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const check = execCommand(`curl -sf --max-time 3 http://127.0.0.1:${info.gatewayPort}/healthz`);
        if (check.success) { healthy = true; break; }
        const portCheck = execCommand(`curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://127.0.0.1:${info.gatewayPort}/`);
        if (portCheck.success && portCheck.stdout !== '000') { healthy = true; break; }
        logFn(`  Dang cho... (${i + 1}/20)`);
      }
      if (!healthy) {
        throw new Error('Health check thất bại sau khi nâng cấp');
      }
      logFn('✓ Nâng cấp hoàn tất');
    });

    res.json({ success: true, jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/version/update-manager', async (req, res) => {
  try {
    const jobId = jobService.createJob('update_manager', 'Cập nhật Management API');
    auditLog(req.session.user.id, 'update_manager', 'Cập nhật Management API', req.ip);

    jobService.runJob(jobId, async (logFn, progressFn) => {
      const { execCommand: exec, execStream: stream } = require('../utils/shell');

      logFn('Cập nhật mã nguồn...');
      progressFn(20, 'Git pull...');

      const managerDir = require('../config').managerDir;
      await stream('git', ['pull', 'origin', 'main'], { cwd: managerDir, onData: logFn });

      logFn('Cài đặt dependencies...');
      progressFn(50, 'npm install...');
      await stream('npm', ['install', '--production'], { cwd: managerDir, onData: logFn });

      logFn('Restart service...');
      progressFn(80, 'Restart...');
      exec('systemctl restart openclaw-manager');

      logFn('✓ Cập nhật hoàn tất');
    });

    res.json({ success: true, jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Service Control
// ==========================================
router.post('/control/restart', async (req, res) => {
  try {
    const jobId = jobService.createJob('restart', 'Khởi động lại OpenClaw');
    auditLog(req.session.user.id, 'restart', 'Khởi động lại dịch vụ', req.ip);

    jobService.runJob(jobId, async (logFn) => {
      const info = openclaw.getServiceInfo();
      await docker.composeRestart(info.installDir, logFn);
      logFn('✓ Đã khởi động lại');
    });

    res.json({ success: true, jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/control/stop', async (req, res) => {
  try {
    const info = openclaw.getServiceInfo();
    await docker.composeDown(info.installDir);
    auditLog(req.session.user.id, 'stop', 'Dừng dịch vụ', req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/control/rebuild', async (req, res) => {
  try {
    const jobId = jobService.createJob('rebuild', 'Rebuild OpenClaw');
    auditLog(req.session.user.id, 'rebuild', 'Rebuild dịch vụ', req.ip);

    jobService.runJob(jobId, async (logFn) => {
      const info = openclaw.getServiceInfo();
      await docker.composeRebuild(info.installDir, logFn);
      logFn('✓ Rebuild hoàn tất');
    });

    res.json({ success: true, jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/control/reset', async (req, res) => {
  try {
    const { confirmation, keepToken, keepDomain } = req.body;
    if (confirmation !== 'RESET') {
      return res.status(400).json({ error: 'Vui lòng nhập RESET để xác nhận' });
    }

    const jobId = jobService.createJob('reset', 'Reset toàn bộ OpenClaw');
    auditLog(req.session.user.id, 'reset', 'Reset toàn bộ dịch vụ', req.ip);

    jobService.runJob(jobId, async (logFn) => {
      await installer.uninstallOpenClaw({ keepToken, keepDomain }, logFn);
    });

    res.json({ success: true, jobId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Logs
// ==========================================
router.get('/logs/openclaw', (req, res) => {
  try {
    const info = openclaw.getServiceInfo();
    const lines = parseInt(req.query.lines, 10) || 200;
    const logs = docker.getContainerLogs(info.installDir, lines);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs/manager', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(require('../config').log.dir, 'combined.log');
    if (!fs.existsSync(logPath)) return res.json({ logs: '' });
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    const tail = lines.slice(-200).join('\n');
    res.json({ logs: tail });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs/install', (req, res) => {
  try {
    const job = jobService.getLatestJob('install');
    res.json({ logs: job?.log || 'Chưa có log cài đặt', job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs/audit', (req, res) => {
  try {
    const { getDb } = require('../database');
    const db = getDb();
    const logs = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100').all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// System
// ==========================================
router.get('/system/info', (req, res) => {
  try {
    res.json(systemService.getSystemInfo());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Backup
// ==========================================
router.get('/backup/list', (req, res) => {
  try {
    res.json(backupService.listBackups());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/backup/create', async (req, res) => {
  try {
    const result = await backupService.createBackup();
    auditLog(req.session.user.id, 'backup', `Backup: ${result.filename}`, req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/backup/restore', async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename required' });
    const backupPath = require('path').join(require('../config').openclaw.installDir, 'backups', filename);
    const result = await backupService.restoreBackup(backupPath);
    auditLog(req.session.user.id, 'restore', `Restore: ${filename}`, req.ip);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
