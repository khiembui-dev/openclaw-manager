'use strict';

const { getDb } = require('../database');

/**
 * Require authenticated session to access route.
 */
function requireAuth(req, res, next) {
  // Check if any admin user exists
  const db = getDb();
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;

  if (userCount === 0) {
    // No admin user exists, redirect to setup
    if (req.path !== '/setup') {
      return res.redirect('/setup');
    }
    return next();
  }

  if (req.session && req.session.user) {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.redirect('/auth/login');
}

/**
 * Only allow access to setup page when no users exist.
 */
function requireSetup(req, res, next) {
  const db = getDb();
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;

  if (userCount > 0) {
    return res.redirect('/auth/login');
  }
  next();
}

/**
 * Add audit log entry.
 */
function auditLog(userId, action, details, ipAddress) {
  const db = getDb();
  db.prepare(
    'INSERT INTO audit_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)'
  ).run(userId, action, details, ipAddress);
}

module.exports = { requireAuth, requireSetup, auditLog };
