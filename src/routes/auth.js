'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb } = require('../database');
const { auditLog } = require('../middleware/auth');
const { isStrongPassword } = require('../utils/validator');
const logger = require('../utils/logger');

/**
 * Validate username: allow letters, numbers, -, _, @, . (for email-style usernames)
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 100) return false;
  // Allow email-style usernames and simple names
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
  const db = getDb();

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      logger.warn(`Login failed: user not found - ${username}`);
      return res.render('login', { title: 'Dang nhap', error: 'Ten dang nhap hoac mat khau khong dung' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logger.warn(`Login failed: wrong password - ${username}`);
      return res.render('login', { title: 'Dang nhap', error: 'Ten dang nhap hoac mat khau khong dung' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    auditLog(user.id, 'login', 'Login thanh cong', req.ip);
    logger.info(`User logged in: ${username}`);
    res.redirect('/');
  } catch (err) {
    logger.error('Login error:', err);
    res.render('login', { title: 'Dang nhap', error: 'Da xay ra loi. Vui long thu lai.' });
  }
});

// POST /auth/setup - Create first admin user
router.post('/setup', async (req, res) => {
  const db = getDb();
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;

  if (userCount > 0) {
    return res.redirect('/auth/login');
  }

  const { username, password, confirmPassword } = req.body;

  if (!validateUsername(username)) {
    return res.render('setup', { title: 'Thiet lap', error: 'Ten dang nhap khong hop le (3-100 ky tu, cho phep chu, so, @, ., -, _)' });
  }
  if (!isStrongPassword(password)) {
    return res.render('setup', { title: 'Thiet lap', error: 'Mat khau phai it nhat 8 ky tu' });
  }
  if (password !== confirmPassword) {
    return res.render('setup', { title: 'Thiet lap', error: 'Mat khau xac nhan khong khop' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username.trim(), hash, 'admin');

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    req.session.user = { id: user.id, username: user.username, role: user.role };
    auditLog(user.id, 'setup', 'Tao tai khoan admin dau tien', req.ip);
    logger.info(`First admin created: ${username}`);
    res.redirect('/');
  } catch (err) {
    logger.error('Setup error:', err);
    res.render('setup', { title: 'Thiet lap', error: 'Da xay ra loi: ' + err.message });
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
});

module.exports = router;
