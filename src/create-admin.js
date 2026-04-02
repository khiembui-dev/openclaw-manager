#!/usr/bin/env node
'use strict';

/**
 * Tao tai khoan admin qua command line
 * Chay: node src/create-admin.js <username> <password>
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { initDatabase, getDb } = require('./database');

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.log('');
    console.log('Su dung: node src/create-admin.js <username> <password>');
    console.log('Vi du:   node src/create-admin.js admin 12345678');
    console.log('');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Loi: Mat khau phai it nhat 8 ky tu');
    process.exit(1);
  }

  try {
    initDatabase();
    const db = getDb();

    // Check existing
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      console.log('User "' + username + '" da ton tai. Cap nhat mat khau...');
      const hash = await bcrypt.hash(password, 12);
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE username = ?").run(hash, username);
      console.log('Da cap nhat mat khau thanh cong!');
    } else {
      const hash = await bcrypt.hash(password, 12);
      db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, 'admin');
      console.log('Da tao tai khoan admin thanh cong!');
    }

    console.log('');
    console.log('  Username: ' + username);
    console.log('  Login:    http://IP-VPS:3847/auth/login');
    console.log('');
  } catch (err) {
    console.error('Loi:', err.message);
    process.exit(1);
  }
}

main();
