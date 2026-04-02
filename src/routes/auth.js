'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getDb } = require('../database');
const { auditLog } = require('../middleware/auth');
const { isValidUsername, isStrongPassword } = require('../utils/validator');
const logger = require('../utils/logger');

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Đăng nhập', error: null });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = getDb();

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      logger.warn(`Login failed: user not found - ${username}`);
      return res.render('login', { title: 'Đăng nhập', error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logger.warn(`Login failed: wrong password - ${username}`);
      return res.render('login', { title: 'Đăng nhập', error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    auditLog(user.id, 'login', 'Đăng nhập thành công', req.ip);
    logger.info(`User logged in: ${username}`);
    res.redirect('/');
  } catch (err) {
    logger.error('Login error:', err);
    res.render('login', { title: 'Đăng nhập', error: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
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

  if (!isValidUsername(username)) {
    return res.render('setup', { title: 'Thiết lập ban đầu', error: 'Tên đăng nhập phải từ 3-50 ký tự (chữ, số, -, _)' });
  }
  if (!isStrongPassword(password)) {
    return res.render('setup', { title: 'Thiết lập ban đầu', error: 'Mật khẩu phải ít nhất 8 ký tự' });
  }
  if (password !== confirmPassword) {
    return res.render('setup', { title: 'Thiết lập ban đầu', error: 'Mật khẩu xác nhận không khớp' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, 'admin');

    req.session.user = { id: 1, username, role: 'admin' };
    auditLog(1, 'setup', 'Tạo tài khoản admin đầu tiên', req.ip);
    logger.info(`First admin created: ${username}`);
    res.redirect('/');
  } catch (err) {
    logger.error('Setup error:', err);
    res.render('setup', { title: 'Thiết lập ban đầu', error: 'Đã xảy ra lỗi. Vui lòng thử lại.' });
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  if (req.session.user) {
    auditLog(req.session.user.id, 'logout', 'Đăng xuất', req.ip);
  }
  req.session.destroy();
  res.redirect('/auth/login');
});

// POST /auth/change-password
router.post('/change-password', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });

  const { currentPassword, newPassword } = req.body;
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 8 ký tự' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hash, user.id);

  auditLog(user.id, 'change_password', 'Đổi mật khẩu', req.ip);
  res.json({ success: true, message: 'Đổi mật khẩu thành công' });
});

module.exports = router;
