#!/usr/bin/env node
'use strict';

/**
 * OpenClaw Manager - Initial Setup Script
 * Run: node src/setup.js
 *
 * Creates necessary directories, copies .env.example, initializes database.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultValue = '') {
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     OpenClaw Manager - Initial Setup     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Create directories
  console.log('Creating directories...');
  [DATA_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`  Created: ${dir}`);
    }
  });

  // Create .env if not exists
  if (!fs.existsSync(ENV_FILE)) {
    console.log('\nCreating .env file...');
    let envContent = fs.readFileSync(ENV_EXAMPLE, 'utf8');

    // Generate secrets
    const sessionSecret = crypto.randomBytes(64).toString('hex');
    const encryptionKey = crypto.randomBytes(32).toString('hex');

    envContent = envContent.replace('change-this-to-a-random-string', sessionSecret);
    envContent = envContent.replace('change-this-to-a-64-char-hex-string', encryptionKey);

    // Ask for configuration
    const port = await ask('Manager port', '3847');
    envContent = envContent.replace('PORT=3847', `PORT=${port}`);

    fs.writeFileSync(ENV_FILE, envContent);
    console.log('  Created: .env (with generated secrets)');
  } else {
    console.log('\n.env already exists, skipping.');
  }

  // Initialize database
  console.log('\nInitializing database...');
  require('dotenv').config({ path: ENV_FILE });
  const { initDatabase } = require('./database');
  initDatabase();
  console.log('  Database initialized.');

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║           Setup Complete!                ║');
  console.log('║                                          ║');
  console.log('║  Start the server:                       ║');
  console.log('║    npm start                             ║');
  console.log('║                                          ║');
  console.log('║  Or for development:                     ║');
  console.log('║    npm run dev                           ║');
  console.log('╚══════════════════════════════════════════╝\n');

  rl.close();
}

main().catch(err => {
  console.error('Setup failed:', err);
  rl.close();
  process.exit(1);
});
