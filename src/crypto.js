'use strict';

const crypto = require('crypto');
const config = require('./config');

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;

function getKey() {
  const hex = config.encryptionKey;
  if (hex.length === 64) {
    return Buffer.from(hex, 'hex');
  }
  // Derive 32-byte key from whatever string was provided
  return crypto.createHash('sha256').update(hex).digest();
}

/**
 * Encrypt a plaintext string. Returns base64-encoded ciphertext.
 */
function encrypt(plaintext) {
  if (!plaintext) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let enc = cipher.update(plaintext, 'utf8', 'base64');
  enc += cipher.final('base64');
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc}`;
}

/**
 * Decrypt a string previously encrypted with encrypt().
 */
function decrypt(encryptedStr) {
  if (!encryptedStr || !encryptedStr.includes(':')) return '';
  try {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) return '';
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const enc = parts[2];
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    let dec = decipher.update(enc, 'base64', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return '';
  }
}

/**
 * Mask a secret string for display: show first 4 and last 4 chars.
 */
function maskSecret(str) {
  if (!str || str.length < 10) return '••••••••';
  return str.substring(0, 4) + '••••••••' + str.substring(str.length - 4);
}

/**
 * Generate a random token.
 */
function generateToken(len = 32) {
  return crypto.randomBytes(len).toString('hex');
}

module.exports = { encrypt, decrypt, maskSecret, generateToken };
