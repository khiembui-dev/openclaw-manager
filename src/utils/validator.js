'use strict';

/**
 * Validate a domain name.
 */
function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//, '').split('/')[0];
  const re = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return re.test(domain);
}

/**
 * Validate an email address.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate a port number.
 */
function isValidPort(port) {
  const p = parseInt(port, 10);
  return Number.isInteger(p) && p >= 1 && p <= 65535;
}

/**
 * Validate an IP address (v4).
 */
function isValidIPv4(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255 && String(n) === p;
  });
}

/**
 * Sanitize a string for safe use in shell commands.
 * Removes dangerous characters.
 */
function sanitizeForShell(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[;&|`$(){}[\]!#~<>\\'\"\n\r]/g, '');
}

/**
 * Sanitize a file path to prevent directory traversal.
 */
function sanitizePath(p) {
  if (!p || typeof p !== 'string') return '';
  return p.replace(/\.\./g, '').replace(/[^a-zA-Z0-9_\-./]/g, '');
}

/**
 * Validate a provider ID.
 */
function isValidProviderId(id) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Validate a model string.
 */
function isValidModel(model) {
  if (!model || typeof model !== 'string') return false;
  return /^[a-zA-Z0-9._\-/: ]+$/.test(model) && model.length <= 200;
}

/**
 * Validate username.
 */
function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  return /^[a-zA-Z0-9_-]{3,50}$/.test(username);
}

/**
 * Validate password strength.
 */
function isStrongPassword(password) {
  return password && typeof password === 'string' && password.length >= 8;
}

module.exports = {
  isValidDomain,
  isValidEmail,
  isValidPort,
  isValidIPv4,
  sanitizeForShell,
  sanitizePath,
  isValidProviderId,
  isValidModel,
  isValidUsername,
  isStrongPassword,
};
