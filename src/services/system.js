'use strict';

const os = require('os');
const { execCommand, getPublicIP, getHostname } = require('../utils/shell');

/**
 * Get system resource usage.
 */
function getSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const uptime = os.uptime();

  // CPU usage (average load)
  const loadAvg = os.loadavg();
  const cpuCount = cpus.length;

  // Disk usage
  let disk = { total: 0, used: 0, free: 0, percent: 0 };
  const dfResult = execCommand("df -B1 / | tail -1 | awk '{print $2,$3,$4,$5}'");
  if (dfResult.success) {
    const parts = dfResult.stdout.split(/\s+/);
    if (parts.length >= 4) {
      disk = {
        total: parseInt(parts[0], 10),
        used: parseInt(parts[1], 10),
        free: parseInt(parts[2], 10),
        percent: parseInt(parts[3], 10),
      };
    }
  }

  return {
    hostname: getHostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    uptime,
    cpu: {
      model: cpus.length > 0 ? cpus[0].model : 'Unknown',
      count: cpuCount,
      loadAvg: loadAvg.map(l => Math.round(l * 100) / 100),
      usagePercent: Math.round((loadAvg[0] / cpuCount) * 100),
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percent: Math.round((usedMem / totalMem) * 100),
    },
    disk,
  };
}

/**
 * Get OS distribution info.
 */
function getOSInfo() {
  const result = execCommand('cat /etc/os-release');
  if (!result.success) return { name: os.type(), version: os.release() };

  const info = {};
  result.stdout.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) {
      info[key.trim()] = vals.join('=').replace(/"/g, '').trim();
    }
  });

  return {
    name: info.PRETTY_NAME || info.NAME || os.type(),
    id: info.ID || '',
    version: info.VERSION_ID || os.release(),
    codename: info.VERSION_CODENAME || '',
  };
}

/**
 * Check if running as root.
 */
function isRoot() {
  const result = execCommand('id -u');
  return result.success && result.stdout.trim() === '0';
}

/**
 * Check supported OS.
 */
function isSupportedOS() {
  const osInfo = getOSInfo();
  const supported = ['ubuntu', 'debian'];
  return supported.includes(osInfo.id.toLowerCase());
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format uptime seconds to human-readable string.
 */
function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d} ngày`);
  if (h > 0) parts.push(`${h} giờ`);
  if (m > 0) parts.push(`${m} phút`);
  return parts.join(' ') || '< 1 phút';
}

module.exports = {
  getSystemInfo,
  getOSInfo,
  isRoot,
  isSupportedOS,
  formatBytes,
  formatUptime,
  getPublicIP,
};
