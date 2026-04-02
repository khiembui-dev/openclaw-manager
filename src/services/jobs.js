'use strict';

const { getDb } = require('../database');
const logger = require('../utils/logger');

// In-memory lock to prevent duplicate jobs
const runningJobs = new Map();

/**
 * Create a new job.
 */
function createJob(type, message = '') {
  const db = getDb();

  // Check for already running job of same type
  const existing = db.prepare(
    "SELECT id FROM jobs WHERE type = ? AND status IN ('pending', 'running')"
  ).get(type);
  if (existing) {
    throw new Error(`Tác vụ "${type}" đang chạy. Vui lòng đợi hoàn tất.`);
  }

  const result = db.prepare(
    'INSERT INTO jobs (type, status, message) VALUES (?, ?, ?)'
  ).run(type, 'pending', message);

  return result.lastInsertRowid;
}

/**
 * Update job status and progress.
 */
function updateJob(jobId, updates) {
  const db = getDb();
  const fields = [];
  const values = [];

  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.progress !== undefined) { fields.push('progress = ?'); values.push(updates.progress); }
  if (updates.message !== undefined) { fields.push('message = ?'); values.push(updates.message); }
  if (updates.result !== undefined) { fields.push('result = ?'); values.push(updates.result); }
  if (updates.error !== undefined) { fields.push('error = ?'); values.push(updates.error); }
  if (updates.log !== undefined) { fields.push('log = ?'); values.push(updates.log); }
  if (updates.status === 'running') { fields.push("started_at = datetime('now')"); }
  if (updates.status === 'success' || updates.status === 'failed') { fields.push("completed_at = datetime('now')"); }

  if (fields.length === 0) return;

  values.push(jobId);
  db.prepare(`UPDATE jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

/**
 * Append to job log.
 */
function appendJobLog(jobId, text) {
  const db = getDb();
  const job = db.prepare('SELECT log FROM jobs WHERE id = ?').get(jobId);
  const currentLog = job ? (job.log || '') : '';
  const newLog = currentLog + text;
  // Keep last 50KB of log
  const trimmed = newLog.length > 50000 ? newLog.slice(-50000) : newLog;
  db.prepare('UPDATE jobs SET log = ? WHERE id = ?').run(trimmed, jobId);
}

/**
 * Get job by ID.
 */
function getJob(jobId) {
  const db = getDb();
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
}

/**
 * Get latest job of a type.
 */
function getLatestJob(type) {
  const db = getDb();
  return db.prepare('SELECT * FROM jobs WHERE type = ? ORDER BY id DESC LIMIT 1').get(type);
}

/**
 * Get active (running/pending) jobs.
 */
function getActiveJobs() {
  const db = getDb();
  return db.prepare("SELECT * FROM jobs WHERE status IN ('pending', 'running') ORDER BY id DESC").all();
}

/**
 * Get recent jobs.
 */
function getRecentJobs(limit = 20) {
  const db = getDb();
  return db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT ?').all(limit);
}

/**
 * Run a job function asynchronously with tracking.
 */
async function runJob(jobId, fn) {
  const type = getJob(jobId)?.type || 'unknown';

  if (runningJobs.has(type)) {
    updateJob(jobId, { status: 'failed', error: 'Tác vụ cùng loại đang chạy' });
    return;
  }

  runningJobs.set(type, jobId);
  updateJob(jobId, { status: 'running', progress: 0 });

  try {
    const logFn = (text) => {
      appendJobLog(jobId, text + '\n');
    };

    const progressFn = (pct, msg) => {
      updateJob(jobId, { progress: pct, message: msg });
    };

    await fn(logFn, progressFn);

    updateJob(jobId, { status: 'success', progress: 100, message: 'Hoàn tất' });
    logger.info(`Job ${jobId} (${type}) completed successfully`);
  } catch (err) {
    updateJob(jobId, {
      status: 'failed',
      error: err.message,
      message: `Lỗi: ${err.message}`,
    });
    logger.error(`Job ${jobId} (${type}) failed:`, err);
  } finally {
    runningJobs.delete(type);
  }
}

/**
 * Initialize job runner - clean up stale jobs on startup.
 */
function initJobRunner() {
  const db = getDb();
  // Mark any previously running jobs as failed (server restart)
  db.prepare(
    "UPDATE jobs SET status = 'failed', error = 'Server khởi động lại', completed_at = datetime('now') WHERE status IN ('pending', 'running')"
  ).run();
}

module.exports = {
  createJob,
  updateJob,
  appendJobLog,
  getJob,
  getLatestJob,
  getActiveJobs,
  getRecentJobs,
  runJob,
  initJobRunner,
};
