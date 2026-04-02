'use strict';

const { getDb } = require('../database');
const { execCommand } = require('../utils/shell');
const { setupNginx } = require('./installer');
const docker = require('./docker');
const logger = require('../utils/logger');

/**
 * Check DNS records for a domain.
 */
function checkDNS(domain, expectedIP) {
  // Check A record
  const aResult = execCommand(`dig +short A ${domain}`);
  const aRecords = aResult.success ? aResult.stdout.split('\n').filter(l => l.trim()) : [];

  // Check AAAA record
  const aaaaResult = execCommand(`dig +short AAAA ${domain}`);
  const aaaaRecords = aaaaResult.success ? aaaaResult.stdout.split('\n').filter(l => l.trim()) : [];

  const matchesA = aRecords.includes(expectedIP);
  const matchesAAAA = aaaaRecords.includes(expectedIP);

  return {
    aRecords,
    aaaaRecords,
    matches: matchesA || matchesAAAA,
    expectedIP,
  };
}

/**
 * Get SSL certificate info for a domain.
 */
function getSSLInfo(domain) {
  const result = execCommand(
    `echo | openssl s_client -connect ${domain}:443 -servername ${domain} 2>/dev/null | openssl x509 -noout -subject -issuer -dates`,
    { timeout: 10000 }
  );

  if (!result.success) return null;

  const info = {};
  result.stdout.split('\n').forEach(line => {
    if (line.startsWith('subject=')) info.subject = line.replace('subject=', '').trim();
    if (line.startsWith('issuer=')) info.issuer = line.replace('issuer=', '').trim();
    if (line.startsWith('notBefore=')) info.notBefore = line.replace('notBefore=', '').trim();
    if (line.startsWith('notAfter=')) info.notAfter = line.replace('notAfter=', '').trim();
  });

  return info;
}

/**
 * Update domain and reconfigure SSL.
 */
async function updateDomain(domain, email, logFn) {
  const db = getDb();
  const installation = db.prepare('SELECT * FROM installation WHERE id = 1').get();
  if (!installation) throw new Error('OpenClaw chưa được cài đặt');

  const log = logFn || (() => {});
  const gatewayPort = installation.gateway_port || 18789;

  // Remove old nginx config if exists
  const oldDomain = installation.domain;
  if (oldDomain && oldDomain !== domain) {
    const oldConf = `/etc/nginx/sites-enabled/openclaw-${oldDomain}`;
    const oldAvail = `/etc/nginx/sites-available/openclaw-${oldDomain}`;
    execCommand(`rm -f ${oldConf} ${oldAvail}`);
    log(`Đã xoá cấu hình Nginx cũ cho ${oldDomain}`);
  }

  // Setup new nginx config
  await setupNginx(domain, gatewayPort, email, log);

  // Update database
  db.prepare(`
    UPDATE installation SET
      domain = ?,
      email = ?,
      ssl_enabled = 1,
      updated_at = datetime('now')
    WHERE id = 1
  `).run(domain, email);

  // Get SSL expiry
  const sslInfo = getSSLInfo(domain);
  if (sslInfo?.notAfter) {
    db.prepare('UPDATE installation SET ssl_expiry = ? WHERE id = 1').run(sslInfo.notAfter);
  }

  log('✓ Domain đã được cập nhật');
  return { success: true, domain };
}

module.exports = { checkDNS, getSSLInfo, updateDomain };
