# OpenClaw Manager

Web UI quản lý, cài đặt và vận hành OpenClaw trên VPS Linux. Thiết kế cho mô hình kinh doanh dịch vụ VPS OpenClaw.

## Tính năng

- **Cài đặt OpenClaw 1 click** - Tự động cài Docker, pull image, tạo config, khởi chạy container
- **Thông tin dịch vụ** - Domain, IP, version, status, gateway token, tạo tài khoản
- **Tên miền & SSL** - Cấu hình domain, tự động cấp SSL Let's Encrypt qua Nginx
- **Cấu hình AI** - 20+ providers, API key management, custom providers, ChatGPT OAuth
- **Multi-Agent** - Tạo/sửa/xoá agent, routing bindings theo kênh
- **Kênh kết nối** - Telegram, Discord, Slack, Zalo với test kết nối
- **Phiên bản & Nâng cấp** - Pull image mới, rebuild container, update manager
- **Nhật ký hệ thống** - Xem log OpenClaw, Manager, cài đặt, audit
- **Điều khiển dịch vụ** - Restart, stop, rebuild, reset toàn bộ
- **Dashboard tổng quan** - CPU, RAM, Disk, trạng thái tổng hợp
- **Backup & Restore** - Sao lưu và phục hồi cấu hình
- **Bảo mật** - Auth session, bcrypt, CSRF, rate limiting, API key encryption (AES-256-GCM)

## Yêu cầu hệ thống

- **OS:** Ubuntu 22.04/24.04, Debian 12
- **Node.js:** >= 18 (khuyến nghị v22)
- **RAM:** >= 1GB (2GB cho cả OpenClaw)
- **Disk:** >= 10GB trống
- **Quyền:** root hoặc sudo

## Cài đặt nhanh (Production)

### Cách 1: Script tự động

```bash
# Tải và chạy script cài đặt
sudo bash scripts/install-manager.sh
```

Script sẽ tự động:
1. Cài Node.js nếu chưa có
2. Copy mã nguồn vào `/opt/openclaw-manager`
3. Cài dependencies
4. Tạo `.env` với secrets ngẫu nhiên
5. Khởi tạo database
6. Tạo systemd service
7. Khởi động manager

### Cách 2: Cài thủ công

```bash
# 1. Copy project vào server
scp -r . root@your-server:/opt/openclaw-manager

# 2. SSH vào server
ssh root@your-server

# 3. Cài Node.js (nếu chưa có)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 4. Cài dependencies
cd /opt/openclaw-manager
npm install --production

# 5. Thiết lập
npm run setup
# Hoặc thủ công:
cp .env.example .env
# Sửa SESSION_SECRET và ENCRYPTION_KEY trong .env
mkdir -p data/logs

# 6. Cài systemd service
cp templates/openclaw-manager.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable openclaw-manager
systemctl start openclaw-manager

# 7. Mở trình duyệt
echo "URL: http://$(curl -s ifconfig.me):3847"
```

### Sau khi cài Manager

1. Mở `http://YOUR_IP:3847`
2. Tạo tài khoản admin đầu tiên
3. Vào trang **Tổng quan** hoặc **Thông tin dịch vụ**
4. Nhấn **Cài đặt OpenClaw** (hoặc vào `/install`)
5. Nhập domain (tùy chọn), email, nhấn **Cài đặt**
6. Chờ hoàn tất, sau đó quản lý qua web UI

## Chạy Development

```bash
# Clone/copy project
cd openclaw-manager

# Cài dependencies
npm install

# Setup
npm run setup

# Chạy dev mode (auto-reload)
npm run dev

# Mở http://localhost:3847
```

## Cấu hình (.env)

| Biến | Mô tả | Mặc định |
|------|--------|----------|
| `PORT` | Cổng web UI | `3847` |
| `HOST` | Bind address | `0.0.0.0` |
| `NODE_ENV` | Environment | `production` |
| `SESSION_SECRET` | Session encryption key | (random) |
| `ENCRYPTION_KEY` | API key encryption key (hex) | (random) |
| `DB_PATH` | SQLite database path | `./data/manager.db` |
| `LOG_DIR` | Log directory | `./data/logs` |
| `OPENCLAW_INSTALL_DIR` | OpenClaw install directory | `/opt/openclaw` |
| `OPENCLAW_IMAGE` | Docker image | `ghcr.io/openclaw/openclaw:latest` |
| `OPENCLAW_GATEWAY_PORT` | Gateway port | `18789` |

## Cấu trúc project

```
openclaw-manager/
├── server.js                 # Entry point
├── package.json
├── .env.example              # Environment template
├── src/
│   ├── app.js                # Express app setup
│   ├── config.js             # Configuration
│   ├── database.js           # SQLite database
│   ├── crypto.js             # AES-256-GCM encryption
│   ├── setup.js              # Interactive setup
│   ├── middleware/
│   │   └── auth.js           # Authentication & audit
│   ├── routes/
│   │   ├── auth.js           # Login/logout/setup
│   │   ├── pages.js          # Page rendering
│   │   └── api.js            # REST API (all endpoints)
│   ├── services/
│   │   ├── docker.js         # Docker management
│   │   ├── installer.js      # OpenClaw 1-click install
│   │   ├── openclaw.js       # OpenClaw operations
│   │   ├── domain.js         # Domain & SSL
│   │   ├── ai.js             # AI provider/key management
│   │   ├── agents.js         # Multi-agent management
│   │   ├── channels.js       # Channel connections
│   │   ├── backup.js         # Backup/restore
│   │   ├── jobs.js           # Job queue
│   │   └── system.js         # System info (CPU/RAM/Disk)
│   └── utils/
│       ├── shell.js          # Safe shell execution
│       ├── logger.js         # Winston logging
│       └── validator.js      # Input validation
├── views/                    # EJS templates
│   ├── layout.ejs            # Main layout + sidebar
│   ├── login.ejs / setup.ejs
│   ├── dashboard.ejs         # Tổng quan
│   ├── service-info.ejs      # Thông tin dịch vụ
│   ├── install.ejs           # Cài đặt 1 click
│   ├── domain-ssl.ejs        # Tên miền & SSL
│   ├── ai-config.ejs         # Cấu hình AI
│   ├── multi-agent.ejs       # Multi-Agent
│   ├── channels.ejs          # Kênh kết nối
│   ├── version.ejs           # Phiên bản & Nâng cấp
│   ├── logs.ejs              # Nhật ký hệ thống
│   ├── control.ejs           # Điều khiển dịch vụ
│   └── backup.ejs            # Sao lưu & Phục hồi
├── public/
│   ├── css/style.css         # Stylesheet
│   └── js/app.js             # Frontend helpers
├── templates/
│   ├── openclaw-manager.service  # systemd unit
│   └── nginx-manager.conf       # Nginx template
└── scripts/
    ├── install-manager.sh    # Quick install
    ├── update-manager.sh     # Update script
    ├── backup.sh             # Backup script
    └── uninstall.sh          # Uninstall script
```

## API Endpoints

### Auth
| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/auth/login` | Đăng nhập |
| POST | `/auth/setup` | Tạo admin đầu tiên |
| GET | `/auth/logout` | Đăng xuất |
| POST | `/auth/change-password` | Đổi mật khẩu |

### Service
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/service/info` | Thông tin dịch vụ |
| GET | `/api/service/health` | Health check |
| POST | `/api/service/token/regenerate` | Tạo mới gateway token |
| POST | `/api/service/account` | Tạo tài khoản OpenClaw |

### Installation
| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/install` | Cài đặt OpenClaw 1 click |

### Domain & SSL
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/domain/info` | Thông tin domain |
| POST | `/api/domain/check-dns` | Kiểm tra DNS |
| POST | `/api/domain/update` | Cập nhật domain + SSL |

### AI Configuration
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/ai/config` | Config AI hiện tại |
| POST | `/api/ai/provider-model` | Đổi provider/model |
| POST | `/api/ai/api-key` | Thêm API key |
| DELETE | `/api/ai/api-key/:id` | Xoá API key |
| POST | `/api/ai/custom-provider` | Thêm custom provider |
| POST | `/api/ai/oauth/save` | Lưu ChatGPT OAuth token |

### Agents
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/agents` | Danh sách agents |
| POST | `/api/agents` | Tạo agent |
| PUT | `/api/agents/:id` | Sửa agent |
| DELETE | `/api/agents/:id` | Xoá agent |
| GET | `/api/agents/bindings` | Routing bindings |
| POST | `/api/agents/bindings` | Thêm binding |

### Channels
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/channels` | Danh sách kênh |
| POST | `/api/channels/:type` | Cập nhật kênh |
| POST | `/api/channels/:type/test` | Test kết nối |

### Version & Control
| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/api/version/upgrade` | Nâng cấp OpenClaw |
| POST | `/api/version/update-manager` | Cập nhật Manager |
| POST | `/api/control/restart` | Restart container |
| POST | `/api/control/stop` | Stop container |
| POST | `/api/control/rebuild` | Rebuild container |
| POST | `/api/control/reset` | Reset toàn bộ |

### Backup & Logs
| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/backup/list` | Danh sách backup |
| POST | `/api/backup/create` | Tạo backup |
| GET | `/api/logs/openclaw` | Log OpenClaw |
| GET | `/api/logs/manager` | Log Manager |

## Quản lý Service

```bash
# Xem trạng thái
systemctl status openclaw-manager

# Restart
systemctl restart openclaw-manager

# Xem log realtime
journalctl -u openclaw-manager -f

# Stop
systemctl stop openclaw-manager
```

## Cập nhật Manager

```bash
# Cách 1: Script
sudo bash /opt/openclaw-manager/scripts/update-manager.sh

# Cách 2: Thủ công
cd /opt/openclaw-manager
git pull origin main
npm install --production
systemctl restart openclaw-manager

# Cách 3: Từ Web UI
# Vào Phiên bản & Nâng cấp -> Cập nhật Management API
```

## Backup

```bash
# Cách 1: Script
sudo bash /opt/openclaw-manager/scripts/backup.sh

# Cách 2: Từ Web UI
# Vào Sao lưu & Phục hồi -> Tạo bản sao lưu
```

## Debug lỗi

### Manager không khởi động
```bash
journalctl -u openclaw-manager --no-pager -n 50
cat /opt/openclaw-manager/data/logs/error.log
```

### OpenClaw container lỗi
```bash
cd /opt/openclaw
docker compose logs --tail 50
docker compose ps
```

### Port bị chiếm
```bash
ss -tlnp | grep ':3847'
ss -tlnp | grep ':18789'
```

### SSL lỗi
```bash
# Kiểm tra certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com
# Thử cấp lại
certbot renew --force-renewal
```

### Database lỗi
```bash
# Backup rồi xoá database (sẽ tạo mới khi restart)
cp /opt/openclaw-manager/data/manager.db /tmp/manager.db.bak
rm /opt/openclaw-manager/data/manager.db
systemctl restart openclaw-manager
```

## Checklist Test

| Test case | Kết quả mong đợi |
|-----------|-------------------|
| Install mới trên Ubuntu 24.04 | Cài thành công, web UI hoạt động |
| Cài OpenClaw 1 click | Docker + OpenClaw chạy, health OK |
| Domain đúng + SSL | Nginx config, certbot cấp cert |
| Domain sai (DNS chưa trỏ) | Alert đỏ, không cho cấp SSL |
| API key đúng | Lưu thành công, sync vào .env |
| API key sai | Cảnh báo, vẫn lưu (user tự kiểm tra) |
| Tạo agent | Agent xuất hiện, sync vào config |
| Routing binding | Kênh -> agent mapping hoạt động |
| Telegram token đúng | Test kết nối OK, hiện bot username |
| Container down | Status đỏ, gợi ý xem log |
| Rebuild | Container tạo lại, health check OK |
| Upgrade | Pull image mới, recreate, health OK |
| Upgrade fail | Rollback suggestion, log chi tiết |
| Reset RESET | Xoá data, tạo lại mặc định |
| Backup + Restore | File tar.gz tạo, restore config OK |
| Login sai 10 lần | Rate limit, chặn 1 phút |
| XSS trong form | HTML escaped, không execute |

## Kiến trúc & Thiết kế

### Tương tác với OpenClaw

Manager tương tác với OpenClaw qua:
1. **Docker Compose** - Start/stop/restart/rebuild containers
2. **Config file** (`~/.openclaw/openclaw.json`) - Provider, model, agent, channel config
3. **Environment file** (`.env`) - API keys, tokens, ports
4. **Health endpoints** (`/healthz`, `/readyz`) - Kiểm tra hoạt động
5. **Container logs** - `docker compose logs`

Manager **KHÔNG** trực tiếp sửa source code OpenClaw hay chạy OpenClaw CLI trong container. Thay vào đó, nó quản lý cấu hình và Docker lifecycle.

### Bảo mật

- Passwords: bcrypt (cost 12)
- API keys: AES-256-GCM encrypted at rest
- Sessions: SQLite-backed, httpOnly, sameSite
- CSRF: Double-submit cookie pattern
- Rate limiting: 10 attempts/minute for login
- Input validation: Whitelist-based
- Shell execution: Command whitelist, sanitized inputs
- Secrets: Never logged plaintext, masked in UI

### Điểm cần lưu ý

- **OpenClaw account creation**: OpenClaw sử dụng gateway auth (token/password) thay vì user accounts truyền thống. Manager thiết lập password auth mode khi tạo "tài khoản".
- **ChatGPT OAuth**: Flow OAuth PKCE dựa trên redirect URL. Token được lưu encrypted và sync vào env file.
- **Custom providers**: Được thêm vào `openclaw.json` dưới `models.providers` theo format OpenAI-compatible.

## License

MIT
