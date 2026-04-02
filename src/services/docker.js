'use strict';

const { execCommand, execStream, commandExists } = require('../utils/shell');
const logger = require('../utils/logger');

/**
 * Check if Docker is installed.
 */
function isDockerInstalled() {
  return commandExists('docker');
}

/**
 * Check if Docker Compose (v2 plugin) is available.
 */
function isComposeInstalled() {
  const result = execCommand('docker compose version');
  return result.success;
}

/**
 * Get Docker version.
 */
function getDockerVersion() {
  const result = execCommand('docker --version');
  return result.success ? result.stdout : null;
}

/**
 * Get Docker Compose version.
 */
function getComposeVersion() {
  const result = execCommand('docker compose version --short');
  return result.success ? result.stdout : null;
}

/**
 * Install Docker on Ubuntu/Debian.
 */
async function installDocker(onLog) {
  const steps = [
    { cmd: 'apt-get update', desc: 'Cập nhật package list' },
    { cmd: 'apt-get install -y ca-certificates curl gnupg lsb-release', desc: 'Cài dependencies' },
    { cmd: 'install -m 0755 -d /etc/apt/keyrings', desc: 'Tạo thư mục keyrings' },
    { cmd: 'curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc', desc: 'Tải Docker GPG key' },
    { cmd: 'chmod a+r /etc/apt/keyrings/docker.asc', desc: 'Set permissions' },
    {
      cmd: `echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null`,
      desc: 'Thêm Docker repository'
    },
    { cmd: 'apt-get update', desc: 'Cập nhật package list' },
    { cmd: 'apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin', desc: 'Cài Docker Engine + Compose' },
    { cmd: 'systemctl enable docker', desc: 'Enable Docker service' },
    { cmd: 'systemctl start docker', desc: 'Khởi động Docker' },
  ];

  for (const step of steps) {
    if (onLog) onLog(`[Docker] ${step.desc}...\n`);
    logger.info(`Docker install: ${step.desc}`);
    try {
      await execStream(step.cmd, [], {
        timeout: 300000,
        onData: (data) => { if (onLog) onLog(data); },
      });
    } catch (err) {
      const msg = `Docker install failed at: ${step.desc} - ${err.message}`;
      logger.error(msg);
      throw new Error(msg);
    }
  }
}

/**
 * Pull a Docker image.
 */
async function pullImage(image, onLog) {
  if (onLog) onLog(`[Docker] Pulling image: ${image}`);
  return execStream('docker', ['pull', image], {
    timeout: 600000,
    onData: onLog,
  });
}

/**
 * Run docker compose up in a directory.
 */
async function composeUp(dir, onLog) {
  if (onLog) onLog('[Docker] Starting containers...');
  return execStream('docker', ['compose', 'up', '-d'], {
    cwd: dir,
    timeout: 300000,
    onData: onLog,
  });
}

/**
 * Run docker compose down in a directory.
 */
async function composeDown(dir, onLog) {
  if (onLog) onLog('[Docker] Stopping containers...');
  return execStream('docker', ['compose', 'down'], {
    cwd: dir,
    timeout: 120000,
    onData: onLog,
  });
}

/**
 * Restart containers.
 */
async function composeRestart(dir, onLog) {
  if (onLog) onLog('[Docker] Restarting containers...');
  return execStream('docker', ['compose', 'restart'], {
    cwd: dir,
    timeout: 120000,
    onData: onLog,
  });
}

/**
 * Rebuild containers.
 */
async function composeRebuild(dir, onLog) {
  if (onLog) onLog('[Docker] Rebuilding containers...');
  await execStream('docker', ['compose', 'down'], { cwd: dir, timeout: 120000, onData: onLog });
  await execStream('docker', ['compose', 'up', '-d', '--force-recreate'], { cwd: dir, timeout: 300000, onData: onLog });
}

/**
 * Get container status for a compose project in a directory.
 */
function getContainerStatus(dir) {
  const result = execCommand(`docker compose ps --format json`, { cwd: dir });
  if (!result.success) return [];
  try {
    // docker compose ps --format json outputs one JSON object per line
    const lines = result.stdout.split('\n').filter(l => l.trim());
    return lines.map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

/**
 * Get logs from a container.
 */
function getContainerLogs(dir, lines = 200) {
  const result = execCommand(`docker compose logs --tail ${lines} --no-color`, { cwd: dir, timeout: 15000 });
  return result.success ? result.stdout : result.stderr;
}

/**
 * Get the image digest for a running container.
 */
function getImageDigest(dir) {
  const result = execCommand(
    `docker compose images --format json`,
    { cwd: dir }
  );
  if (!result.success) return null;
  try {
    const images = JSON.parse(`[${result.stdout.split('\n').filter(l => l.trim()).join(',')}]`);
    return images.length > 0 ? images[0] : null;
  } catch {
    return null;
  }
}

/**
 * Check if a specific image has updates available.
 */
async function checkImageUpdate(image) {
  // Pull with dry-run to check
  const result = execCommand(`docker pull --quiet ${image}`, { timeout: 60000 });
  return result.success;
}

/**
 * Get docker system info.
 */
function getDockerInfo() {
  const result = execCommand('docker info --format json');
  if (!result.success) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

module.exports = {
  isDockerInstalled,
  isComposeInstalled,
  getDockerVersion,
  getComposeVersion,
  installDocker,
  pullImage,
  composeUp,
  composeDown,
  composeRestart,
  composeRebuild,
  getContainerStatus,
  getContainerLogs,
  getImageDigest,
  checkImageUpdate,
  getDockerInfo,
};
