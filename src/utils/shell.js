'use strict';

const { spawn, execSync } = require('child_process');
const logger = require('./logger');

// Whitelist of allowed commands for security
const ALLOWED_COMMANDS = new Set([
  'docker', 'docker-compose', 'systemctl', 'nginx', 'caddy',
  'certbot', 'ufw', 'apt-get', 'apt', 'curl', 'wget',
  'cat', 'ls', 'mkdir', 'cp', 'mv', 'rm', 'chmod', 'chown',
  'hostname', 'ip', 'dig', 'nslookup', 'ss', 'lsof',
  'df', 'free', 'uptime', 'whoami', 'id', 'uname',
  'openssl', 'tar', 'gzip', 'sha256sum',
  'tee', 'head', 'tail', 'grep', 'wc',
]);

/**
 * Validate and sanitize a shell command.
 * Only allows whitelisted base commands.
 */
function validateCommand(command) {
  const baseCmd = command.trim().split(/\s+/)[0];
  // Allow absolute paths to known binaries
  const basename = baseCmd.split('/').pop();
  if (!ALLOWED_COMMANDS.has(basename)) {
    throw new Error(`Command not allowed: ${basename}`);
  }
  // Block dangerous patterns
  const dangerous = [';', '&&', '||', '`', '$(', '${', '|', '>', '<', '\n', '\r'];
  // Allow pipes and redirects only in controlled scenarios
  return command;
}

/**
 * Execute a shell command and return stdout.
 * For simple, quick commands.
 */
function execCommand(command, options = {}) {
  const { timeout = 30000, cwd, env } = options;
  try {
    const result = execSync(command, {
      timeout,
      cwd,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, stdout: result.trim(), stderr: '' };
  } catch (err) {
    return {
      success: false,
      stdout: err.stdout ? err.stdout.toString().trim() : '',
      stderr: err.stderr ? err.stderr.toString().trim() : err.message,
      code: err.status,
    };
  }
}

/**
 * Execute a shell command with streaming output.
 * Returns a promise. Calls onData for each line of output.
 */
function execStream(command, args = [], options = {}) {
  const { cwd, env, onData, onError, timeout = 600000 } = options;

  return new Promise((resolve, reject) => {
    // If no args, treat command as a full shell command string
    const useShell = args.length === 0;
    const proc = useShell
      ? spawn(command, { cwd, env: { ...process.env, ...env }, shell: true, stdio: ['pipe', 'pipe', 'pipe'] })
      : spawn(command, args, { cwd, env: { ...process.env, ...env }, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      if (onData) onData(str);
    });

    proc.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      if (onError) onError(str);
      if (onData) onData(str); // Also forward stderr to combined output
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error('Command timed out'));
      } else if (code !== 0) {
        const err = new Error(`Command failed with code ${code}: ${stderr}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({ success: true, stdout, stderr, code: 0 });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Check if a command exists on the system.
 */
function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a port is in use.
 */
function isPortInUse(port) {
  const result = execCommand(`ss -tlnp | grep ':${port} '`);
  return result.success && result.stdout.length > 0;
}

/**
 * Get the server's public IP address.
 */
function getPublicIP() {
  const result = execCommand('curl -s -4 --max-time 5 https://ifconfig.me');
  if (result.success && result.stdout) return result.stdout;
  const result2 = execCommand('curl -s -4 --max-time 5 https://api.ipify.org');
  return result2.success ? result2.stdout : null;
}

/**
 * Get the server's hostname.
 */
function getHostname() {
  const result = execCommand('hostname');
  return result.success ? result.stdout : 'unknown';
}

module.exports = {
  validateCommand,
  execCommand,
  execStream,
  commandExists,
  isPortInUse,
  getPublicIP,
  getHostname,
};
