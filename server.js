#!/usr/bin/env node
'use strict';

require('dotenv').config();

const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { initDatabase } = require('./src/database');
const { initJobRunner } = require('./src/services/jobs');

const PORT = config.port;
const HOST = config.host;

async function start() {
  try {
    // Initialize database
    initDatabase();
    logger.info('Database initialized');

    // Initialize job runner
    initJobRunner();
    logger.info('Job runner initialized');

    // Start server
    app.listen(PORT, HOST, () => {
      logger.info(`OpenClaw Manager running at http://${HOST}:${PORT}`);
      console.log(`\n  ╔══════════════════════════════════════════╗`);
      console.log(`  ║       OpenClaw Manager v${config.version}            ║`);
      console.log(`  ║──────────────────────────────────────────║`);
      console.log(`  ║  URL: http://${HOST}:${PORT}`.padEnd(47) + `║`);
      console.log(`  ║  ENV: ${config.nodeEnv}`.padEnd(47) + `║`);
      console.log(`  ╚══════════════════════════════════════════╝\n`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}

start();
