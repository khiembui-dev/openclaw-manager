'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb } = require('../database');
const { auditLog } = require('../middleware/auth');
const { isStrongPassword } = require('../utils/validator');
const logger = require('../utils/logger');

/**
 * Validate username: allow letters, numbers, -, _, @, .
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 100) return false;
  return /^[a-zA-Z0-9@._\-]+$/.test(trimmed);
}

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/');
  res.render('login', { title: 'Dang nhap', error: null });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('[AUTH] Login attempt:', username);

  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.render('login', { title: 'Dang nhap', error: 'Ten dang nhap hoac mat khau khong dung' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.render('login', { title: 'Dang nhap', error: 'Ten dang nhap hoac mat khau khong dung' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    req.session.save((err) => {
      if (err) console.error('[AUTH] Session save error:', err);
      auditLog(user.id, 'login', 'Login thanh cong', req.ip);
      console.log('[AUTH] Login success:', username);
      res.redirect('/');
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.render('login', { title: 'Dang nhap', error: 'Loi: ' + err.message });
  }
});

// POST /auth/setup - Create first admin user
router.post('/setup', async (req, res) => {
  console.log('[SETUP] === Setup request received ===');
  console.log('[SETUP] Body:', JSON.stringify(req.body || {}));

  try {
    const db = getDb();
    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    console.log('[SETUP] Current user count:', userCount);

    if (userCount > 0) {
      console.log('[SETUP] Users already exist, redirecting to login');
      return res.redirect('/auth/login');
    }

    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    const confirmPassword = req.body.confirmPassword || '';

    console.log('[SETUP] Username:', username, 'Password length:', password.length);

    // Validate
    if (!username || username.length < 3) {
      console.log('[SETUP] Username too short');
      return res.render('setup', { title: 'Thiet lap', error: 'Ten dang nhap phai co it nhat 3 ky tu' });
    }

    if (password.length < 8) {
      console.log('[SETUP] Password too short');
      return res.render('setup', { title: 'Thiet lap', error: 'Mat khau phai it nhat 8 ky tu' });
    }

    if (password !== confirmPassword) {
      console.log('[SETUP] Password mismatch');
      return res.render('setup', { title: 'Thiet lap', error: 'Mat khau xac nhan khong khop' });
    }

    // Create user
    console.log('[SETUP] Hashing password...');
    const hash = await bcrypt.hash(password, 12);
    console.log('[SETUP] Hash done, inserting user...');

    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, 'admin');
    console.log('[SETUP] User inserted!');

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    console.log('[SETUP] User found:', user ? user.id : 'NULL');

    // Set session
    req.session.user = { id: user.id, username: user.username, role: user.role };
    req.session.save((err) => {
      if (err) {
        console.error('[SETUP] Session save error:', err);
        // Still redirect even if session save fails
      }
      console.log('[SETUP] Redirecting to /');
      auditLog(user.id, 'setup', 'Tao tai khoan admin', req.ip);
      res.redirect('/');
    });

  } catch (err) {
    console.error('[SETUP] ERROR:', err.message);
    console.error('[SETUP] Stack:', err.stack);
    res.render('setup', { title: 'Thiet lap', error: 'Loi: ' + err.message });
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  if (req.session && req.session.user) {
    auditLog(req.session.user.id, 'logout', 'Dang xuat', req.ip);
  }
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

// POST /auth/change-password
router.post('/change-password', async (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  const { currentPassword, newPassword } = req.body;

  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Mat khau hien tai khong dung' });

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: 'Mat khau moi phai it nhat 8 ky tu' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);

    auditLog(user.id, 'change_password', 'Doi mat khau', req.ip);
    res.json({ success: true, message: 'Doi mat khau thanh cong' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug test endpoint
router.get('/test', (req, res) => {
  res.json({
    ok: true,
    session: !!req.session,
    hasUser: !!(req.session && req.session.user),
    csrf: !!(req.session && req.session.csrfToken),
  });
});

module.exports = router;
