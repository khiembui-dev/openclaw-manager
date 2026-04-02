'use strict';

const fs = require('fs');
const path = require('path');
const { getDb } = require('../database');
const config = require('../config');
const docker = require('./docker');
const { execCommand, isPortInUse, getPublicIP } = require('../utils/shell');
const { generateToken } = require('../crypto');
const logger = require('../utils/logger');

/**
 * Full OpenClaw installation pipeline.
 * This is the 1-click install logic.
 */
async function installOpenClaw(options, logFn, progressFn) {
  const {
    domain = '',
    email = '',
    installDir = config.openclaw.installDir,
    gatewayPort = config.openclaw.gatewayPort,
    bridgePort = config.openclaw.bridgePort,
    image = config.openclaw.image,
  } = options;

  const db = getDb();
  const configDir = path.join(installDir, 'config');
  const dataDir = path.join(installDir, 'data');
  const logsDir = path.join(installDir, 'logs');

  const steps = [
    { name: 'check_os', label: 'Kiểm tra hệ điều hành', pct: 5 },
    { name: 'check_root', label: 'Kiểm tra quyền root', pct: 8 },
    { name: 'check_ports', label: 'Kiểm tra cổng mạng', pct: 12 },
    { name: 'install_docker', label: 'Cài đặt Docker', pct: 35 },
    { name: 'create_dirs', label: 'Tạo thư mục', pct: 40 },
    { name: 'pull_image', label: 'Tải Docker image', pct: 60 },
    { name: 'gen_config', label: 'Tạo file cấu hình', pct: 70 },
    { name: 'start_containers', label: 'Khởi chạy container', pct: 85 },
    { name: 'health_check', label: 'Kiểm tra hoạt động', pct: 92 },
    { name: 'save_metadata', label: 'Lưu thông tin', pct: 98 },
  ];

  let currentStep = 0;
  const log = (msg) => { if (logFn) logFn(msg); };
  const progress = (pct, msg) => { if (progressFn) progressFn(pct, msg); };

  try {
    // Step 1: Check OS
    progress(steps[0].pct, steps[0].label);
    log(`\n>>> ${steps[0].label}`);
    const osResult = execCommand('cat /etc/os-release');
    if (osResult.success) {
      log(osResult.stdout);
      const osId = osResult.stdout.match(/^ID=(.*)$/m);
      if (osId) {
        const distro = osId[1].replace(/"/g, '').toLowerCase();
        if (!['ubuntu', 'debian'].includes(distro)) {
          log(`⚠ Cảnh báo: Hệ điều hành ${distro} chưa được kiểm thử đầy đủ`);
        }
      }
    }
    log('✓ Kiểm tra hệ điều hành hoàn tất');

    // Step 2: Check root
    progress(steps[1].pct, steps[1].label);
    log(`\n>>> ${steps[1].label}`);
    const idResult = execCommand('id -u');
    if (!idResult.success || idResult.stdout.trim() !== '0') {
      throw new Error('Cần chạy với quyền root. Hãy chạy manager bằng sudo hoặc root user.');
    }
    log('✓ Đang chạy với quyền root');

    // Step 3: Check ports
    progress(steps[2].pct, steps[2].label);
    log(`\n>>> ${steps[2].label}`);
    if (domain) {
      if (isPortInUse(80)) {
        log('⚠ Cổng 80 đang được sử dụng - sẽ cần kiểm tra nginx config');
      }
      if (isPortInUse(443)) {
        log('⚠ Cổng 443 đang được sử dụng - sẽ cần kiểm tra nginx config');
      }
    }
    if (isPortInUse(gatewayPort)) {
      throw new Error(`Cổng ${gatewayPort} đã bị chiếm. Vui lòng chọn cổng khác.`);
    }
    if (isPortInUse(bridgePort)) {
      throw new Error(`Cổng ${bridgePort} đã bị chiếm. Vui lòng chọn cổng khác.`);
    }
    log('✓ Các cổng mạng khả dụng');

    // Step 4: Install Docker if needed
    progress(steps[3].pct, steps[3].label);
    log(`\n>>> ${steps[3].label}`);
    if (docker.isDockerInstalled()) {
      log('✓ Docker đã được cài đặt: ' + docker.getDockerVersion());
      if (!docker.isComposeInstalled()) {
        log('Cài đặt Docker Compose plugin...');
        await docker.installDocker(log); // Will install compose as part of docker
      } else {
        log('✓ Docker Compose đã sẵn sàng: ' + docker.getComposeVersion());
      }
    } else {
      log('Docker chưa được cài đặt. Bắt đầu cài Docker...');
      await docker.installDocker(log);
      log('✓ Docker đã được cài đặt thành công');
    }

    // Step 5: Create directories
    progress(steps[4].pct, steps[4].label);
    log(`\n>>> ${steps[4].label}`);
    const dirs = [installDir, configDir, dataDir, logsDir];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log(`  Tạo: ${dir}`);
      }
    }
    // Set permissions
    execCommand(`chown -R 1000:1000 ${configDir} ${dataDir}`);
    log('✓ Thư mục đã được tạo');

    // Step 6: Pull image
    progress(steps[5].pct, steps[5].label);
    log(`\n>>> ${steps[5].label}: ${image}`);
    await docker.pullImage(image, log);
    log('✓ Image đã được tải');

    // Step 7: Generate config files
    progress(steps[6].pct, steps[6].label);
    log(`\n>>> ${steps[6].label}`);
    const gatewayToken = generateToken(32);

    // Create docker-compose.yml
    const composeContent = generateComposeFile({
      image, gatewayPort, bridgePort, configDir, dataDir, gatewayToken,
    });
    fs.writeFileSync(path.join(installDir, 'docker-compose.yml'), composeContent);
    log('  Tạo: docker-compose.yml');

    // Create .env file
    const envContent = generateEnvFile({
      image, gatewayPort, bridgePort, configDir, dataDir, gatewayToken, domain,
    });
    fs.writeFileSync(path.join(installDir, '.env'), envContent);
    log('  Tạo: .env');

    // Create openclaw.json config
    const openclawConfig = generateOpenClawConfig({ domain });
    fs.writeFileSync(path.join(configDir, 'openclaw.json'), JSON.stringify(openclawConfig, null, 2));
    log('  Tạo: openclaw.json');

    log('✓ File cấu hình đã được tạo');

    // Step 8: Start containers
    progress(steps[7].pct, steps[7].label);
    log(`\n>>> ${steps[7].label}`);
    await docker.composeUp(installDir, log);
    log('✓ Container đã khởi chạy');

    // Step 9: Health check
    progress(steps[8].pct, steps[8].label);
    log(`\n>>> ${steps[8].label}`);
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      // Try /healthz first, fallback to checking if port responds
      const check = execCommand(`curl -sf --max-time 3 http://127.0.0.1:${gatewayPort}/healthz`);
      if (check.success) { healthy = true; break; }
      const portCheck = execCommand(`curl -s --max-time 3 -o /dev/null -w "%{http_code}" http://127.0.0.1:${gatewayPort}/`);
      if (portCheck.success && portCheck.stdout !== '000') { healthy = true; break; }
      log(`  Dang cho... (${i + 1}/30)`);
    }
    if (!healthy) {
      log('⚠ Health check chưa phản hồi, container có thể cần thêm thời gian khởi động');
    } else {
      log('✓ OpenClaw đang hoạt động');
    }

    // Step 10: Save metadata
    progress(steps[9].pct, steps[9].label);
    log(`\n>>> ${steps[9].label}`);
    const publicIP = getPublicIP() || '127.0.0.1';

    // Get image digest
    let imageDigest = '';
    const digestResult = execCommand(`docker inspect --format='{{index .RepoDigests 0}}' ${image}`);
    if (digestResult.success) {
      imageDigest = digestResult.stdout;
    }

    db.prepare(`
      UPDATE installation SET
        status = 'running',
        domain = ?,
        ip_address = ?,
        email = ?,
        install_dir = ?,
        openclaw_version = ?,
        docker_image = ?,
        image_digest = ?,
        gateway_token = ?,
        gateway_port = ?,
        bridge_port = ?,
        installed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = 1
    `).run(
      domain || publicIP,
      publicIP,
      email,
      installDir,
      'latest',
      image,
      imageDigest,
      require('../crypto').encrypt(gatewayToken),
      gatewayPort,
      bridgePort
    );

    log('✓ Thông tin đã được lưu');
    log(`\n${'='.repeat(50)}`);
    log('✅ CÀI ĐẶT OPENCLAW HOÀN TẤT!');
    log(`${'='.repeat(50)}`);
    log(`IP: ${publicIP}`);
    log(`Domain: ${domain || publicIP}`);
    log(`Gateway: http://${domain || publicIP}:${gatewayPort}`);
    log(`Gateway Token: ${gatewayToken}`);
    log(`Thư mục cài đặt: ${installDir}`);

    // Setup nginx if domain is provided
    if (domain) {
      log('\n>>> Cấu hình Nginx reverse proxy...');
      try {
        await setupNginx(domain, gatewayPort, email, log);
        log('✓ Nginx đã được cấu hình');

        db.prepare('UPDATE installation SET ssl_enabled = 1 WHERE id = 1').run();
      } catch (err) {
        log(`⚠ Không thể cấu hình Nginx: ${err.message}`);
        log('  Bạn có thể cấu hình thủ công sau trong mục "Tên miền & SSL"');
      }
    }

    progress(100, 'Hoàn tất cài đặt');

  } catch (err) {
    log(`\n❌ LỖI: ${err.message}`);
    throw err;
  }
}

/**
 * Generate docker-compose.yml content.
 */
function generateComposeFile(opts) {
  return `# OpenClaw Docker Compose - Generated by OpenClaw Manager

services:
  openclaw-gateway:
    image: \${OPENCLAW_IMAGE:-${opts.image}}
    container_name: openclaw-gateway
    restart: unless-stopped
    init: true
    ports:
      - "\${OPENCLAW_GATEWAY_PORT:-${opts.gatewayPort}}:18789"
      - "\${OPENCLAW_BRIDGE_PORT:-${opts.bridgePort}}:18790"
    environment:
      HOME: /home/node
      TERM: xterm-256color
      OPENCLAW_GATEWAY_TOKEN: \${OPENCLAW_GATEWAY_TOKEN:-}
      TZ: \${TZ:-UTC}
    volumes:
      - \${OPENCLAW_CONFIG_DIR:-${opts.configDir}}:/home/node/.openclaw
      - \${OPENCLAW_DATA_DIR:-./data}:/home/node/.openclaw/workspace
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://127.0.0.1:18789/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
`;
}

/**
 * Generate .env file content.
 */
function generateEnvFile(opts) {
  return `# OpenClaw Environment - Generated by OpenClaw Manager
OPENCLAW_IMAGE=${opts.image}
OPENCLAW_GATEWAY_PORT=${opts.gatewayPort}
OPENCLAW_BRIDGE_PORT=${opts.bridgePort}
OPENCLAW_CONFIG_DIR=${opts.configDir}
OPENCLAW_DATA_DIR=${opts.dataDir || './data'}
OPENCLAW_GATEWAY_TOKEN=${opts.gatewayToken}
TZ=UTC
`;
}

/**
 * Generate openclaw.json config.
 */
function generateOpenClawConfig(opts) {
  const cfg = {
    gateway: {
      auth: {
        mode: 'token',
      },
    },
    agents: {
      defaults: {
        model: {
          primary: 'openai/gpt-4o',
        },
      },
    },
    channels: {},
  };
  return cfg;
}

/**
 * Setup Nginx reverse proxy with SSL.
 */
async function setupNginx(domain, gatewayPort, email, logFn) {
  const log = logFn || (() => {});

  // Install nginx if needed
  const nginxInstalled = execCommand('which nginx');
  if (!nginxInstalled.success) {
    log('Cài đặt Nginx...');
    execCommand('apt-get install -y nginx');
  }

  // Install certbot if needed
  const certbotInstalled = execCommand('which certbot');
  if (!certbotInstalled.success) {
    log('Cài đặt Certbot...');
    execCommand('apt-get install -y certbot python3-certbot-nginx');
  }

  // Create nginx config
  const nginxConf = `# OpenClaw - ${domain}
# Generated by OpenClaw Manager

server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${gatewayPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
`;

  const confPath = `/etc/nginx/sites-available/openclaw-${domain}`;
  const enabledPath = `/etc/nginx/sites-enabled/openclaw-${domain}`;

  fs.writeFileSync(confPath, nginxConf);
  log(`Nginx config: ${confPath}`);

  // Enable site
  if (!fs.existsSync(enabledPath)) {
    execCommand(`ln -sf ${confPath} ${enabledPath}`);
  }

  // Test and reload nginx
  const testResult = execCommand('nginx -t');
  if (!testResult.success) {
    throw new Error('Nginx config test failed: ' + testResult.stderr);
  }
  execCommand('systemctl reload nginx');
  log('Nginx đã được reload');

  // Get SSL certificate
  if (email) {
    log('Đang cấp SSL certificate...');
    const certResult = execCommand(
      `certbot --nginx -d ${domain} --email ${email} --agree-tos --non-interactive --redirect`,
      { timeout: 120000 }
    );
    if (certResult.success) {
      log('✓ SSL certificate đã được cấp');
    } else {
      log(`⚠ SSL certificate lỗi: ${certResult.stderr}`);
      log('  Bạn có thể thử lại sau trong mục "Tên miền & SSL"');
    }
  }
}

/**
 * Uninstall OpenClaw (reset).
 */
async function uninstallOpenClaw(options = {}, logFn) {
  const db = getDb();
  const installation = db.prepare('SELECT * FROM installation WHERE id = 1').get();
  const installDir = installation?.install_dir || config.openclaw.installDir;
  const log = logFn || (() => {});

  log('Dừng containers...');
  try {
    await docker.composeDown(installDir, log);
  } catch (e) {
    log(`Cảnh báo: ${e.message}`);
  }

  if (!options.keepData) {
    log('Xoá dữ liệu OpenClaw...');
    execCommand(`rm -rf ${installDir}/data`);
  }

  if (!options.keepConfig) {
    log('Xoá cấu hình...');
    execCommand(`rm -rf ${installDir}/config`);
    execCommand(`rm -f ${installDir}/docker-compose.yml`);
    execCommand(`rm -f ${installDir}/.env`);
  }

  // Reset database
  db.prepare(`
    UPDATE installation SET
      status = 'not_installed',
      openclaw_version = NULL,
      docker_image = NULL,
      image_digest = NULL,
      ${options.keepDomain ? '' : "domain = NULL, ssl_enabled = 0, ssl_expiry = NULL,"}
      ${options.keepToken ? '' : "gateway_token = NULL,"}
      installed_at = NULL,
      updated_at = datetime('now')
    WHERE id = 1
  `).run();

  log('✓ Reset hoàn tất');
}

module.exports = { installOpenClaw, uninstallOpenClaw, setupNginx, generateComposeFile, generateEnvFile, generateOpenClawConfig };
