# OpenClaw Manager

Web UI quản lý, cài đặt và vận hành **OpenClaw** trên VPS Linux.
Cài đặt OpenClaw chỉ bằng 1 click - phù hợp cho mô hình kinh doanh dịch vụ VPS.

---

## Cài đặt nhanh (1 lệnh)

SSH vào VPS Ubuntu rồi chạy:

```bash
curl -fsSL https://raw.githubusercontent.com/khiembui-dev/openclaw-manager/main/install.sh | sudo bash
```

Xong! Mở trình duyệt: `http://IP-VPS:3847`

---

## Cài đặt từng bước

### Bước 1 - Tải source về VPS

```bash
# SSH vào VPS
ssh root@IP-VPS

# Cài git (nếu chưa có)
apt-get update && apt-get install -y git

# Clone từ GitHub
git clone https://github.com/khiembui-dev/openclaw-manager.git /opt/openclaw-manager
cd /opt/openclaw-manager
```

### Bước 2 - Chạy script cài đặt

```bash
sudo bash scripts/install-manager.sh
```

Script tự động:
1. Cài Node.js 22
2. Cài npm dependencies
3. Tạo `.env` với secrets ngẫu nhiên
4. Khởi tạo database SQLite
5. Tạo systemd service
6. Khởi động manager

### Bước 3 - Mở Web UI

```
http://IP-VPS:3847
```

1. Tạo tài khoản admin đầu tiên
2. Nhấn **Cài đặt OpenClaw** (1 click)
3. Xong! Quản lý mọi thứ qua web UI

---

## Yêu cầu VPS

| | Tối thiểu | Khuyến nghị |
|---|---|---|
| **OS** | Ubuntu 22.04 / 24.04 / Debian 12 | Ubuntu 24.04 |
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 2 GB | 4 GB |
| **Disk** | 25 GB SSD | 40 GB SSD |
| **Quyền** | root | root |

---

## Tính năng

| Trang | Chức năng |
|-------|-----------|
| **Tổng quan** | CPU, RAM, Disk, trạng thái, health check |
| **Thông tin dịch vụ** | Domain, IP, version, gateway token, tạo tài khoản |
| **Cài đặt 1 Click** | Tự động Docker + pull image + config + start |
| **Tên miền & SSL** | DNS check, Nginx, Let's Encrypt tự động |
| **Cấu hình AI** | 20+ providers, API key, custom provider, ChatGPT OAuth |
| **Multi-Agent** | Tạo agent, routing bindings theo kênh |
| **Kênh kết nối** | Telegram, Discord, Slack, Zalo + test kết nối |
| **Phiên bản** | Nâng cấp OpenClaw, cập nhật Manager |
| **Nhật ký** | Log OpenClaw, Manager, cài đặt, audit |
| **Điều khiển** | Restart, stop, rebuild, reset toàn bộ |
| **Backup** | Sao lưu & phục hồi cấu hình |

---

## Quản lý service

```bash
# Trạng thái
systemctl status openclaw-manager

# Restart
systemctl restart openclaw-manager

# Log realtime
journalctl -u openclaw-manager -f

# Dừng
systemctl stop openclaw-manager
```

---

## Cập nhật

```bash
cd /opt/openclaw-manager
git pull origin main
npm install --production
systemctl restart openclaw-manager
```

Hoặc cập nhật từ Web UI: **Phiên bản & Nâng cấp** → **Cập nhật Management API**

---

## Backup

```bash
# Qua script
sudo bash /opt/openclaw-manager/scripts/backup.sh

# Hoặc qua Web UI: Backups → Tạo bản sao lưu
```

---

## Xử lý sự cố

| Vấn đề | Lệnh kiểm tra |
|--------|---------------|
| Manager không chạy | `systemctl status openclaw-manager` |
| Xem log lỗi | `journalctl -u openclaw-manager -n 50` |
| OpenClaw lỗi | `cd /opt/openclaw && docker compose logs --tail 50` |
| Port bị chiếm | `ss -tlnp \| grep ':3847'` |
| SSL lỗi | `certbot renew --force-renewal` |
| Quên mật khẩu | Xoá `data/manager.db` rồi restart |
| Disk đầy | `docker system prune -a` |

---

## Cấu hình (.env)

File: `/opt/openclaw-manager/.env`

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `PORT` | `3847` | Cổng web UI |
| `OPENCLAW_INSTALL_DIR` | `/opt/openclaw` | Thư mục cài OpenClaw |
| `OPENCLAW_IMAGE` | `ghcr.io/openclaw/openclaw:latest` | Docker image |
| `OPENCLAW_GATEWAY_PORT` | `18789` | Cổng Gateway |
| `LOG_LEVEL` | `info` | Mức log (`debug` để xem chi tiết) |

> Sau khi sửa: `systemctl restart openclaw-manager`

---

## Bảo mật

- Mật khẩu: bcrypt (cost 12)
- API keys: AES-256-GCM encrypted at rest
- Session: httpOnly, sameSite, SQLite-backed
- CSRF protection
- Rate limiting: 10 lần/phút cho login
- Shell command whitelist
- Audit log cho mọi thao tác nhạy cảm

---

## Hướng dẫn chi tiết

Xem file [HUONG_DAN_SU_DUNG.md](HUONG_DAN_SU_DUNG.md) để có hướng dẫn đầy đủ từ A-Z:
- Cài đặt từng bước
- Cấu hình AI provider (20+ providers)
- Kết nối Telegram / Discord / Slack / Zalo
- Multi-Agent & routing
- ChatGPT OAuth flow
- Xử lý sự cố chi tiết
- Hướng dẫn cho nhà cung cấp VPS

---

## License

MIT
