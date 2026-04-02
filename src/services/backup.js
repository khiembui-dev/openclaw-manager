'use strict';

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { getDb } = require('../database');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Create a backup archive of OpenClaw config and manager data.
 */
async function createBackup(outputDir) {
  const db = getDb();
  const installation = db.prepare('SELECT * FROM installation WHERE id = 1').get();

  if (!outputDir) {
    outputDir = path.join(config.openclaw.installDir, 'backups');
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `openclaw-backup-${timestamp}.tar.gz`;
  const outputPath = path.join(outputDir, filename);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('tar', { gzip: true, gzipOptions: { level: 9 } });

    output.on('close', () => {
      resolve({
        path: outputPath,
        filename,
        size: archive.pointer(),
      });
    });

    archive.on('error', reject);
    archive.pipe(output);

    // Backup manager database
    const dbPath = config.db.path;
    if (fs.existsSync(dbPath)) {
      archive.file(dbPath, { name: 'manager.db' });
    }

    // Backup manager .env
    const managerEnvPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(managerEnvPath)) {
      archive.file(managerEnvPath, { name: 'manager.env' });
    }

    // Backup OpenClaw config
    if (installation?.install_dir) {
      const configDir = path.join(installation.install_dir, 'config');
      if (fs.existsSync(configDir)) {
        archive.directory(configDir, 'openclaw-config');
      }

      // Backup docker-compose.yml
      const composePath = path.join(installation.install_dir, 'docker-compose.yml');
      if (fs.existsSync(composePath)) {
        archive.file(composePath, { name: 'docker-compose.yml' });
      }

      // Backup .env
      const envPath = path.join(installation.install_dir, '.env');
      if (fs.existsSync(envPath)) {
        archive.file(envPath, { name: 'openclaw.env' });
      }
    }

    archive.finalize();
  });
}

/**
 * Restore from a backup file.
 */
async function restoreBackup(backupPath) {
  // This is intentionally simple - in production you'd want more robust restore logic
  const extractZip = require('extract-zip');
  const tmpDir = path.join(config.openclaw.installDir, 'backups', 'restore-tmp');

  if (!fs.existsSync(backupPath)) {
    throw new Error('File backup không tồn tại');
  }

  // For tar.gz, we use shell command
  const { execCommand } = require('../utils/shell');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  execCommand(`tar -xzf "${backupPath}" -C "${tmpDir}"`);

  const db = getDb();
  const installation = db.prepare('SELECT * FROM installation WHERE id = 1').get();
  const installDir = installation?.install_dir || config.openclaw.installDir;

  // Restore OpenClaw config
  const configBackupDir = path.join(tmpDir, 'openclaw-config');
  if (fs.existsSync(configBackupDir)) {
    const configDir = path.join(installDir, 'config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    execCommand(`cp -r "${configBackupDir}"/* "${configDir}"/`);
  }

  // Restore docker-compose.yml
  const composeBackup = path.join(tmpDir, 'docker-compose.yml');
  if (fs.existsSync(composeBackup)) {
    fs.copyFileSync(composeBackup, path.join(installDir, 'docker-compose.yml'));
  }

  // Restore .env
  const envBackup = path.join(tmpDir, 'openclaw.env');
  if (fs.existsSync(envBackup)) {
    fs.copyFileSync(envBackup, path.join(installDir, '.env'));
  }

  // Cleanup
  execCommand(`rm -rf "${tmpDir}"`);

  return { success: true };
}

/**
 * List available backups.
 */
function listBackups() {
  const backupDir = path.join(config.openclaw.installDir, 'backups');
  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir)
    .filter(f => f.startsWith('openclaw-backup-') && f.endsWith('.tar.gz'))
    .map(f => {
      const stat = fs.statSync(path.join(backupDir, f));
      return {
        filename: f,
        path: path.join(backupDir, f),
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

module.exports = { createBackup, restoreBackup, listBackups };
