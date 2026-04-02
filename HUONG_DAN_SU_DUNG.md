# HƯỚNG DẪN SỬ DỤNG OPENCLAW MANAGER

Tài liệu hướng dẫn chi tiết từ A-Z cho người dùng và quản trị viên.

---

## MỤC LỤC

1. [Giới thiệu](#1-giới-thiệu)
2. [Yêu cầu hệ thống](#2-yêu-cầu-hệ-thống)
3. [Cài đặt OpenClaw Manager](#3-cài-đặt-openclaw-manager)
4. [Thiết lập ban đầu](#4-thiết-lập-ban-đầu)
5. [Cài đặt OpenClaw 1 Click](#5-cài-đặt-openclaw-1-click)
6. [Tổng quan Dashboard](#6-tổng-quan-dashboard)
7. [Thông tin dịch vụ](#7-thông-tin-dịch-vụ)
8. [Tên miền & SSL](#8-tên-miền--ssl)
9. [Cấu hình AI Provider](#9-cấu-hình-ai-provider)
10. [Multi-Agent](#10-multi-agent)
11. [Kênh kết nối](#11-kênh-kết-nối)
12. [Phiên bản & Nâng cấp](#12-phiên-bản--nâng-cấp)
13. [Nhật ký hệ thống](#13-nhật-ký-hệ-thống)
14. [Điều khiển dịch vụ](#14-điều-khiển-dịch-vụ)
15. [Sao lưu & Phục hồi](#15-sao-lưu--phục-hồi)
16. [Quản lý tài khoản Admin](#16-quản-lý-tài-khoản-admin)
17. [Quản lý qua dòng lệnh (CLI)](#17-quản-lý-qua-dòng-lệnh-cli)
18. [Cấu hình nâng cao (.env)](#18-cấu-hình-nâng-cao-env)
19. [Xử lý sự cố thường gặp](#19-xử-lý-sự-cố-thường-gặp)
20. [Câu hỏi thường gặp (FAQ)](#20-câu-hỏi-thường-gặp-faq)
21. [Dành cho nhà cung cấp dịch vụ VPS](#21-dành-cho-nhà-cung-cấp-dịch-vụ-vps)

---

## 1. Giới thiệu

### OpenClaw Manager là gì?

OpenClaw Manager là một **web UI quản trị** chạy trên VPS Linux, cho phép bạn:

- Cài đặt OpenClaw chỉ bằng 1 click
- Quản lý toàn bộ OpenClaw qua giao diện web trực quan
- Cấu hình AI providers, agents, kênh nhắn tin
- Giám sát trạng thái hệ thống
- Nâng cấp, sao lưu, phục hồi

### OpenClaw là gì?

OpenClaw là một **AI Gateway mã nguồn mở**, kết nối các nền tảng nhắn tin (Telegram, Discord, Slack, Zalo...) với các mô hình AI (OpenAI, Anthropic, Google Gemini...). Nó hoạt động như một bộ não trung tâm, nhận tin nhắn từ các kênh chat và phản hồi bằng AI.

### Mối quan hệ giữa Manager và OpenClaw

```
┌──────────────────────────────────────────┐
│                VPS Linux                  │
│                                          │
│  ┌────────────────────┐                  │
│  │  OpenClaw Manager  │ ← Web UI (port 3847)
│  │  (Node.js app)     │                  │
│  └────────┬───────────┘                  │
│           │ quản lý                      │
│  ┌────────▼───────────┐                  │
│  │  Docker            │                  │
│  │  ┌───────────────┐ │                  │
│  │  │ OpenClaw      │ │ ← Gateway (port 18789)
│  │  │ Container     │ │                  │
│  │  └───────────────┘ │                  │
│  └────────────────────┘                  │
│                                          │
│  ┌────────────────────┐                  │
│  │  Nginx (tuỳ chọn) │ ← Reverse proxy (port 80/443)
│  └────────────────────┘                  │
└──────────────────────────────────────────┘
```

Manager **không** can thiệp vào source code OpenClaw. Nó chỉ:
- Quản lý Docker container (start/stop/restart)
- Sửa file cấu hình (`openclaw.json`, `.env`)
- Cấu hình Nginx reverse proxy
- Giám sát trạng thái qua health endpoint

---

## 2. Yêu cầu hệ thống

### Tối thiểu

| Thành phần | Yêu cầu |
|---|---|
| **Hệ điều hành** | Ubuntu 22.04, Ubuntu 24.04, hoặc Debian 12 |
| **CPU** | 1 vCPU |
| **RAM** | 2 GB (tối thiểu để chạy cả Manager + OpenClaw) |
| **Ổ cứng** | 25 GB SSD |
| **Mạng** | IP public, port 3847 + 18789 mở |
| **Quyền** | root hoặc user có sudo |

### Khuyến nghị

| Thành phần | Yêu cầu |
|---|---|
| **CPU** | 2 vCPU |
| **RAM** | 4 GB |
| **Ổ cứng** | 40 GB SSD |
| **Mạng** | Domain trỏ về IP server |

### Phần mềm sẽ được cài tự động

- Node.js 22.x (cho Manager)
- Docker Engine + Docker Compose (cho OpenClaw)
- Nginx (nếu dùng domain)
- Certbot (nếu cần SSL)

---

## 3. Cài đặt OpenClaw Manager

### Cách 1: Cài tự động bằng script (khuyến nghị)

```bash
# SSH vào VPS
ssh root@your-server-ip

# Tải project về (chọn 1 trong các cách sau)

# Cách A: Từ Git
git clone https://github.com/your-org/openclaw-manager.git /opt/openclaw-manager
cd /opt/openclaw-manager

# Cách B: Từ file zip/tar
# Upload file lên server, giải nén vào /opt/openclaw-manager

# Chạy script cài đặt
sudo bash scripts/install-manager.sh
```

**Kết quả:**
```
╔══════════════════════════════════════════════╗
║       CÀI ĐẶT HOÀN TẤT!                    ║
║                                              ║
║  URL: http://103.xxx.xxx.xxx:3847            ║
║                                              ║
║  1. Mở URL trên trình duyệt                 ║
║  2. Tạo tài khoản admin đầu tiên            ║
║  3. Cài đặt OpenClaw bằng 1 click           ║
╚══════════════════════════════════════════════╝
```

### Cách 2: Cài thủ công từng bước

```bash
# Bước 1: Cài Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Bước 2: Copy source code
# (upload/clone project vào /opt/openclaw-manager)

# Bước 3: Cài dependencies
cd /opt/openclaw-manager
npm install --production

# Bước 4: Thiết lập cấu hình
cp .env.example .env
nano .env   # Sửa SESSION_SECRET và ENCRYPTION_KEY

# Bước 5: Tạo thư mục data
mkdir -p data/logs

# Bước 6: Chạy setup
npm run setup

# Bước 7: Cài systemd service
cp templates/openclaw-manager.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable openclaw-manager
systemctl start openclaw-manager
```

### Kiểm tra cài đặt thành công

```bash
# Xem service đang chạy
systemctl status openclaw-manager

# Kiểm tra port
ss -tlnp | grep 3847

# Xem log
journalctl -u openclaw-manager -f
```

Mở trình duyệt: `http://IP-VPS:3847`

---

## 4. Thiết lập ban đầu

### Bước 1: Truy cập web UI

Mở trình duyệt, truy cập `http://IP-VPS:3847`

Lần đầu tiên, bạn sẽ thấy trang **"Thiết lập ban đầu"**.

### Bước 2: Tạo tài khoản admin

Nhập thông tin:
- **Tên đăng nhập:** 3-50 ký tự, chỉ chứa chữ, số, dấu gạch ngang, gạch dưới
  - Ví dụ: `admin`, `manager`, `john_doe`
- **Mật khẩu:** tối thiểu 8 ký tự
- **Xác nhận mật khẩu:** nhập lại mật khẩu

Nhấn **"Tạo tài khoản"**.

### Bước 3: Đăng nhập

Sau khi tạo tài khoản, bạn sẽ được chuyển tự động vào trang chủ.

Từ lần sau, truy cập `http://IP-VPS:3847` sẽ hiện trang đăng nhập.

> **Lưu ý bảo mật:** Nếu nhập sai mật khẩu 10 lần trong 1 phút, tài khoản sẽ bị khoá tạm 1 phút.

---

## 5. Cài đặt OpenClaw 1 Click

Đây là tính năng cốt lõi. Sau khi đăng nhập, bạn có thể cài OpenClaw chỉ với vài click.

### Bước 1: Vào trang cài đặt

- Từ **Tổng quan**, nhấn nút **"Cài đặt OpenClaw"**
- Hoặc truy cập trực tiếp: `http://IP-VPS:3847/install`

### Bước 2: Nhập cấu hình

| Trường | Bắt buộc? | Mô tả | Ví dụ |
|--------|-----------|-------|-------|
| **Domain** | Không | Domain/subdomain đã trỏ DNS về IP server | `ai.example.com` |
| **Email** | Nếu có domain | Dùng để cấp SSL Let's Encrypt | `admin@example.com` |
| **Thư mục cài đặt** | Có (mặc định sẵn) | Nơi lưu file OpenClaw | `/opt/openclaw` |
| **Cổng Gateway** | Có (mặc định sẵn) | Port cho OpenClaw Gateway | `18789` |
| **Cổng Bridge** | Có (mặc định sẵn) | Port cho Bridge protocol | `18790` |
| **Docker Image** | Có (mặc định sẵn) | Image OpenClaw | `ghcr.io/openclaw/openclaw:latest` |

> **Tip:** Nếu chưa có domain, để trống. Bạn có thể thêm domain sau ở trang "Tên miền & SSL".

### Bước 3: Nhấn "Cài đặt OpenClaw"

Hệ thống sẽ tự động thực hiện 10 bước:

| Bước | Thao tác | Thời gian |
|------|----------|-----------|
| 1 | Kiểm tra hệ điều hành | < 1 giây |
| 2 | Kiểm tra quyền root | < 1 giây |
| 3 | Kiểm tra cổng mạng | < 1 giây |
| 4 | Cài đặt Docker (nếu chưa có) | 1-5 phút |
| 5 | Tạo thư mục | < 1 giây |
| 6 | Tải Docker image (~1-2 GB) | 2-10 phút |
| 7 | Tạo file cấu hình | < 1 giây |
| 8 | Khởi chạy container | 10-30 giây |
| 9 | Kiểm tra hoạt động (health check) | 10-60 giây |
| 10 | Lưu thông tin | < 1 giây |

Bạn sẽ thấy:
- **Thanh tiến trình** hiển thị phần trăm hoàn tất
- **Log realtime** hiện chi tiết từng bước
- **Kết quả** khi hoàn tất (IP, domain, token...)

### Bước 4: Kiểm tra

Sau khi cài xong:
- Nhấn **"Xem thông tin dịch vụ"** để kiểm tra
- Hoặc vào **Tổng quan** để xem trạng thái

### Nếu cài lỗi

Log sẽ hiển thị chính xác:
- Bước nào lỗi
- Lệnh nào thất bại
- Gợi ý khắc phục

Bạn có thể:
- Nhấn **"Thử lại"** để cài lại
- Nhấn **"Quay lại"** để sửa cấu hình rồi thử lại

### Lỗi thường gặp khi cài

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|-------------|----------------|
| `Cần chạy với quyền root` | Manager không chạy bằng root | Chạy lại bằng `sudo` |
| `Cổng 18789 đã bị chiếm` | Có ứng dụng khác dùng port | Đổi cổng hoặc tắt app kia |
| `Docker install failed` | Lỗi mạng hoặc OS không hỗ trợ | Kiểm tra internet, dùng Ubuntu 24.04 |
| `Health check chưa phản hồi` | Container cần thêm thời gian | Đợi 1-2 phút, kiểm tra log container |

---

## 6. Tổng quan Dashboard

**Đường dẫn:** `http://IP:3847/` (trang chủ)

### Các thông tin hiển thị

| Card | Ý nghĩa |
|------|---------|
| **Trạng thái OpenClaw** | `Hoạt động` (xanh) / `Đã dừng` (đỏ) / `Chưa cài` (vàng) |
| **CPU** | Phần trăm CPU đang sử dụng |
| **RAM** | Phần trăm RAM đang sử dụng |
| **Disk** | Phần trăm ổ cứng đã dùng |
| **AI Provider** | Provider đang dùng (OpenAI, Anthropic...) |
| **Agents** | Số agent đang hoạt động |
| **Kênh kết nối** | Số kênh đã kết nối (Telegram, Discord...) |
| **Domain** | Domain/IP hiện tại |

### Thao tác nhanh

- **Thông tin dịch vụ** - Xem chi tiết OpenClaw
- **Cài đặt OpenClaw** - Chỉ hiện khi chưa cài
- **Cấu hình AI** - Đổi provider/model
- **Kênh kết nối** - Thêm bot Telegram/Discord
- **Nhật ký** - Xem log

### Kiểm tra sức khoẻ

Tự động kiểm tra 5 hạng mục:
- Container Docker
- Gateway HTTP
- Reverse Proxy (nếu có domain)
- SSL Certificate (nếu có)
- Dung lượng đĩa (cần >= 1 GB trống)

> Dashboard tự cập nhật mỗi 15 giây.

---

## 7. Thông tin dịch vụ

**Đường dẫn:** Menu trái → "Thông tin dịch vụ"

### Thông tin hiển thị

- **Tên miền hiện tại:** domain đang dùng (hoặc IP nếu chưa cấu hình)
- **Địa chỉ IP:** IP public của VPS
- **Phiên bản:** phiên bản OpenClaw đang chạy
- **Trạng thái:** badge màu hiển thị trạng thái container

### Nút "Mở Dashboard OpenClaw"

- Chỉ bấm được khi OpenClaw đang chạy
- Mở giao diện web của OpenClaw trong tab mới
- URL dạng: `http://domain:18789` hoặc `https://domain` (nếu có SSL)

### Gateway Token

Gateway Token là **mật khẩu** để truy cập API của OpenClaw.

| Nút | Chức năng |
|-----|-----------|
| 👁️ **Hiện/Ẩn** | Xem hoặc ẩn token |
| 📋 **Copy** | Copy token vào clipboard |
| 🔄 **Tạo mới** | Sinh token mới (token cũ sẽ mất hiệu lực, container sẽ restart) |

> **Cảnh báo:** Khi tạo mới token, tất cả kết nối đang dùng token cũ sẽ bị ngắt.

### Tạo tài khoản đăng nhập OpenClaw

Dùng để tạo tài khoản truy cập giao diện web của OpenClaw (không phải tài khoản Manager).

1. Nhập **Tên đăng nhập / Email**
2. Nhập **Mật khẩu**
3. Nhấn **"Tạo tài khoản"**
4. Hệ thống sẽ cấu hình password auth cho OpenClaw Gateway
5. Link đăng nhập sẽ hiển thị sau khi tạo thành công

> **Lưu ý kỹ thuật:** OpenClaw sử dụng gateway auth mode (token hoặc password), không phải hệ thống user accounts truyền thống. Khi bạn "tạo tài khoản", Manager sẽ chuyển auth mode sang password và set mật khẩu cho gateway.

---

## 8. Tên miền & SSL

**Đường dẫn:** Menu trái → "Tên miền & SSL"

### Trước khi bắt đầu

Bạn cần:
1. Có domain hoặc subdomain (ví dụ: `ai.example.com`)
2. Trỏ DNS A record về IP server
3. Chờ DNS propagation (thường 5-30 phút, tối đa 48 giờ)

### Kiểm tra DNS

1. Nhập **Tên miền mới** (ví dụ: `ai.example.com`)
2. Nhấn **"Kiểm tra DNS"**
3. Kết quả:
   - ✅ **Xanh:** DNS đã trỏ đúng → có thể tiếp tục
   - ❌ **Đỏ:** DNS chưa đúng → cần kiểm tra lại cấu hình DNS

### Cập nhật tên miền

1. Nhập **Tên miền mới**
2. Nhập **Email** (cho Let's Encrypt SSL)
3. Nhấn **"Cập nhật tên miền"**

Hệ thống sẽ tự động:
- Tạo cấu hình Nginx reverse proxy
- Reload Nginx
- Chạy Certbot để cấp SSL Let's Encrypt
- Cập nhật thông tin trong database

### Sau khi hoàn tất

- OpenClaw sẽ truy cập được qua `https://domain`
- SSL tự động gia hạn bởi Certbot
- Trang "Thông tin dịch vụ" sẽ cập nhật link mới

### Đổi domain

Khi đổi domain, hệ thống sẽ:
1. Xoá cấu hình Nginx cũ
2. Tạo cấu hình mới
3. Cấp SSL mới
4. Cập nhật database

> **Quan trọng:** Luôn kiểm tra DNS trước khi cập nhật. Nếu DNS chưa trỏ đúng, SSL sẽ không cấp được.

---

## 9. Cấu hình AI Provider

**Đường dẫn:** Menu trái → "Cấu hình AI"

Đây là trang quan trọng nhất để OpenClaw biết dùng AI nào để phản hồi.

### 9.1. Đổi Provider & Model

1. Chọn **Provider** từ dropdown (ví dụ: OpenAI)
2. Chọn **Model** từ dropdown (ví dụ: gpt-4o)
   - Hoặc nhập model thủ công nếu model chưa có trong danh sách
3. Nhấn **"Lưu cấu hình"**

### Danh sách providers hỗ trợ

| Provider | Model phổ biến |
|----------|---------------|
| **OpenAI** | gpt-4o, gpt-4o-mini, o1, o3, o4-mini |
| **Anthropic** | claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 |
| **Google Gemini** | gemini-2.5-pro, gemini-2.5-flash |
| **DeepSeek** | deepseek-chat, deepseek-coder, deepseek-reasoner |
| **Groq** | llama-3.3-70b-versatile, mixtral-8x7b |
| **Together AI** | Meta-Llama-3.1-405B, Mixtral-8x22B |
| **Mistral AI** | mistral-large, codestral |
| **xAI (Grok)** | grok-2, grok-2-mini |
| **Cerebras** | llama3.1-70b, llama3.1-8b |
| **OpenRouter** | auto (chọn model tốt nhất tự động) |
| + 10 providers khác | SambaNova, Fireworks, Cohere, Yi, Baichuan, Stepfun, SiliconFlow, Novita, Minimax |

### 9.2. Quản lý API Key

**Thêm key mới:**
1. Chọn provider từ dropdown
2. Nhập API key
3. Nhấn **"Lưu API Key"**

**Danh sách key:**
- Mỗi key hiển thị dạng `sk-ab••••••••wxyz` (ẩn phần giữa)
- Key đầu tiên của mỗi provider tự động thành **mặc định**
- Nhấn **"Đặt mặc định"** để đổi key chính
- Nhấn **"Xoá"** để xoá key

> **Bảo mật:** API key được mã hoá bằng AES-256-GCM trước khi lưu vào database. Không bao giờ hiển thị toàn bộ key trên giao diện.

### 9.3. Custom Providers

Dùng cho các nhà cung cấp AI tương thích chuẩn OpenAI API.

1. Nhấn **"+ Thêm"**
2. Nhập:
   - **Tên:** tên hiển thị (ví dụ: "My Local LLM")
   - **Base URL:** endpoint API (ví dụ: `https://api.example.com/v1`)
   - **API Key:** (tuỳ chọn)
   - **Model mặc định:** (ví dụ: `my-model-7b`)
3. Nhấn **"Thêm"**

Ví dụ dùng cho:
- Ollama local: `http://localhost:11434/v1`
- vLLM: `http://localhost:8000/v1`
- LiteLLM proxy
- Bất kỳ API nào tương thích OpenAI

### 9.4. ChatGPT OAuth (Codex)

Kết nối tài khoản ChatGPT Plus/Pro để dùng model qua OAuth (không cần API key).

**Quy trình:**

1. Nhấn **"Kết nối ChatGPT"**
2. Nhấn **"Mở trang đăng nhập ChatGPT"** → mở tab mới
3. Đăng nhập ChatGPT bình thường
4. Sau khi đăng nhập, trình duyệt sẽ redirect về một URL dạng:
   ```
   http://localhost/callback?code=abc123xyz...
   ```
5. **Copy toàn bộ URL** đó
6. Quay lại Manager, **dán vào ô "Redirect URL"**
7. Chọn model (GPT-4o, o1, o3...)
8. Nhấn **"Hoàn thành kết nối"**

**Ngắt kết nối:**
- Nhấn **"Ngắt kết nối"** để xoá token OAuth

---

## 10. Multi-Agent

**Đường dẫn:** Menu trái → "Multi-Agent"

Multi-Agent cho phép bạn tạo nhiều "nhân cách AI" khác nhau, mỗi agent có thể dùng model, prompt, và provider riêng.

### 10.1. Danh sách Agents

Mặc định có 1 **Main Agent** (không thể xoá). Mỗi agent hiển thị:
- Tên agent
- Badge `main` (agent gốc)
- Badge `mặc định` (agent nhận tin nhắn khi không có routing)
- Model đang dùng

### 10.2. Tạo Agent mới

1. Nhấn **"+ Tạo Agent"**
2. Nhập:
   - **Tên Agent:** ví dụ "Support Bot", "Sales Agent"
   - **Model:** ví dụ `anthropic/claude-sonnet-4-6` (để trống = dùng mặc định hệ thống)
   - **Provider:** ví dụ `anthropic`
   - **System Prompt:** hướng dẫn cho AI (ví dụ: "Bạn là nhân viên hỗ trợ khách hàng...")
3. Nhấn **"Lưu"**

### 10.3. Ví dụ thực tế

| Agent | Model | Prompt | Gán vào |
|-------|-------|--------|---------|
| Main Agent | openai/gpt-4o | (mặc định) | Mọi kênh |
| Support Bot | anthropic/claude-sonnet-4-6 | "Hỗ trợ kỹ thuật..." | Telegram |
| Sales Agent | openai/gpt-4o-mini | "Tư vấn bán hàng..." | Zalo |
| Community Bot | groq/llama-3.3-70b | "Trả lời câu hỏi..." | Discord |

### 10.4. Routing Bindings

Routing bindings quyết định kênh nào dùng agent nào.

**Thêm binding:**
1. Nhấn **"+ Thêm Binding"**
2. Chọn **Kênh** (Telegram, Discord, Slack, Zalo)
3. Nhập **Pattern** (để trống hoặc `*` = tất cả tin nhắn trên kênh đó)
4. Chọn **Agent**
5. Nhấn **"Thêm"**

**Ví dụ:**

| Kênh | Pattern | Agent | Ý nghĩa |
|------|---------|-------|---------|
| telegram | * | Support Bot | Mọi tin nhắn Telegram → Support Bot |
| discord | * | Community Bot | Mọi tin nhắn Discord → Community Bot |
| zalo | * | Sales Agent | Mọi tin nhắn Zalo → Sales Agent |

Nếu một kênh không có binding, nó sẽ dùng **agent mặc định**.

### 10.5. Đặt Agent mặc định

Nhấn **"Mặc định"** bên cạnh agent muốn đặt. Agent mặc định xử lý tất cả tin nhắn không có routing binding riêng.

---

## 11. Kênh kết nối

**Đường dẫn:** Menu trái → "Kênh kết nối"

### Tổng quan kênh

Trang hiển thị 4 card trạng thái:
- **Telegram** - Đã kết nối / Chưa kết nối / Lỗi
- **Discord** - Đã kết nối / Chưa kết nối / Lỗi
- **Slack** - Đã kết nối / Chưa kết nối / Lỗi
- **Zalo** - Đã kết nối / Chưa kết nối / Lỗi

### 11.1. Kết nối Telegram

**Chuẩn bị:**
1. Mở Telegram, tìm [@BotFather](https://t.me/BotFather)
2. Gửi `/newbot`
3. Đặt tên bot
4. Nhận **Bot Token** dạng: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

**Cấu hình trong Manager:**
1. Chọn kênh: **Telegram**
2. Dán **Bot Token**
3. Nhấn **"Lưu cấu hình"**
4. Nhấn **"Kiểm tra kết nối"**
5. Nếu thành công: hiện tên bot `@your_bot`

### 11.2. Kết nối Discord

**Chuẩn bị:**
1. Vào [Discord Developer Portal](https://discord.com/developers/applications)
2. Tạo Application mới
3. Vào mục **Bot** → nhấn **Add Bot**
4. Copy **Bot Token**
5. Bật **Message Content Intent** trong mục Bot
6. Mời bot vào server Discord của bạn

**Cấu hình trong Manager:**
1. Chọn kênh: **Discord**
2. Dán **Bot Token**
3. Nhấn **"Lưu cấu hình"** → **"Kiểm tra kết nối"**

### 11.3. Kết nối Slack

**Chuẩn bị:**
1. Vào [Slack API](https://api.slack.com/apps)
2. Tạo App mới (From scratch)
3. Vào **OAuth & Permissions** → thêm scopes: `chat:write`, `app_mentions:read`, `im:read`, `im:write`
4. Install App to Workspace
5. Copy **Bot Token** (bắt đầu bằng `xoxb-`)

**Cấu hình:**
1. Chọn kênh: **Slack**
2. Dán **Bot Token**
3. Lưu và kiểm tra

### 11.4. Kết nối Zalo

**Chuẩn bị:**
1. Đăng ký Zalo Official Account
2. Vào [Zalo Developers](https://developers.zalo.me/)
3. Tạo ứng dụng
4. Lấy **OA Token** (dạng: `numeric_id:secret`)

**Cấu hình:**
1. Chọn kênh: **Zalo**
2. Dán token
3. Lưu cấu hình

> **Lưu ý:** Sau khi lưu token, bạn cần **restart OpenClaw** (vào Điều khiển dịch vụ → Khởi động lại) để áp dụng cấu hình channel mới.

---

## 12. Phiên bản & Nâng cấp

**Đường dẫn:** Menu trái → "Phiên bản & Nâng cấp"

### Thông tin hiển thị

- **Phiên bản:** version tag hiện tại
- **Docker Image:** tên image đang dùng
- **Image Digest:** hash SHA256 của image (dùng để xác minh)

### 12.1. Nâng cấp OpenClaw

1. Nhấn **"Nâng cấp OpenClaw"**
2. Xác nhận cảnh báo
3. Hệ thống tự động:
   - Backup cấu hình hiện tại
   - Pull Docker image mới nhất
   - Tạo lại container
   - Health check
4. Theo dõi tiến trình qua thanh progress và log

> **Lưu ý:** Dịch vụ sẽ bị gián đoạn 1-3 phút trong quá trình nâng cấp.

### 12.2. Cập nhật Management API

Cập nhật bản thân Manager (không phải OpenClaw).

1. Nhấn **"Cập nhật Management API"**
2. Xác nhận trong modal
3. Hệ thống sẽ:
   - Git pull mã nguồn mới
   - Cài dependencies mới
   - Restart service Manager

> **Lưu ý:** Trang web sẽ bị ngắt kết nối vài giây khi Manager restart. Refresh lại trang sau 10-15 giây.

### 12.3. Làm mới

Nhấn **"Làm mới"** để reload thông tin version từ Docker.

---

## 13. Nhật ký hệ thống

**Đường dẫn:** Menu trái → "Nhật ký hệ thống"

### Các loại log

| Tab | Nội dung |
|-----|----------|
| **OpenClaw** | Log từ container OpenClaw (200 dòng gần nhất) |
| **Manager** | Log từ Manager web UI |
| **Cài đặt** | Log chi tiết quá trình cài đặt 1-click |
| **Audit** | Lịch sử thao tác: ai làm gì, lúc nào, từ IP nào |

### Thao tác

- **Chuyển tab:** nhấn các nút OpenClaw / Manager / Cài đặt / Audit
- **Làm mới:** nhấn 🔄 để load log mới nhất
- **Tải log:** nhấn 💾 để download file `.log`

### Đọc log

Log hiển thị trong khung đen (terminal style):
- Text trắng: thông tin thông thường
- `[ERROR]`: lỗi cần xử lý
- `[WARN]`: cảnh báo
- Timestamp ở đầu mỗi dòng

---

## 14. Điều khiển dịch vụ

**Đường dẫn:** Menu trái → "Điều khiển dịch vụ"

### Trạng thái Container

Hiển thị trạng thái hiện tại:
- 🟢 **Đang chạy** - OpenClaw hoạt động bình thường
- 🔴 **Đã dừng** - Container không chạy
- 🟡 **Lỗi** - Container gặp vấn đề

### Các nút điều khiển

| Nút | Chức năng | Khi nào dùng |
|-----|-----------|-------------|
| 🔄 **Khởi động lại** | Restart container | Sau khi đổi config, khi bị lỗi |
| ⏹️ **Dừng** | Stop container | Khi cần bảo trì VPS |
| 🔨 **Rebuild** | Xoá và tạo lại container | Khi config thay đổi sâu |
| 🔃 **Làm mới** | Refresh trạng thái | Kiểm tra trạng thái mới nhất |

### Vùng nguy hiểm - Reset toàn bộ

**⚠️ CẢNH BÁO: Thao tác này không thể hoàn tác!**

Reset sẽ:
- Dừng và xoá container OpenClaw
- Xoá dữ liệu và cấu hình
- Đưa về trạng thái "Chưa cài đặt"

**Cách reset:**
1. Nhập chữ `RESET` vào ô xác nhận
2. Chọn tuỳ chọn:
   - ☑️ **Giữ Gateway Token** - Không tạo token mới
   - ☑️ **Giữ Domain & SSL** - Không xoá cấu hình Nginx/SSL
3. Nhấn **"Reset toàn bộ"**
4. Xác nhận lần nữa trong hộp thoại

Sau khi reset, bạn có thể cài lại OpenClaw 1-click.

---

## 15. Sao lưu & Phục hồi

**Đường dẫn:** Header → "Backups" hoặc `http://IP:3847/backup`

### Tạo bản sao lưu

1. Nhấn **"Tạo bản sao lưu"**
2. Hệ thống tạo file `openclaw-backup-YYYYMMDD-HHMMSS.tar.gz` chứa:
   - Database Manager (`manager.db`)
   - File `.env` của Manager
   - Thư mục config OpenClaw (`openclaw.json`...)
   - File `docker-compose.yml`
   - File `.env` của OpenClaw

### Phục hồi

1. Chọn backup từ danh sách
2. Nhấn **"Phục hồi"**
3. Xác nhận
4. **Restart dịch vụ** sau khi phục hồi để áp dụng

### Khuyến nghị

- Tạo backup **trước mỗi lần nâng cấp**
- Tạo backup **trước khi đổi domain**
- Tạo backup định kỳ bằng script:
  ```bash
  # Chạy hàng ngày lúc 2h sáng
  echo "0 2 * * * root bash /opt/openclaw-manager/scripts/backup.sh" >> /etc/crontab
  ```

---

## 16. Quản lý tài khoản Admin

### Đăng xuất

Nhấn **"Đăng xuất"** ở góc phải header.

### Đổi mật khẩu

Gọi API trực tiếp (chưa có giao diện riêng):
```bash
curl -X POST http://localhost:3847/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Cookie: ocm.sid=YOUR_SESSION_COOKIE" \
  -d '{"currentPassword":"old123","newPassword":"new456789"}'
```

### Session timeout

Session tự hết hạn sau **24 giờ** không hoạt động. Sau đó cần đăng nhập lại.

---

## 17. Quản lý qua dòng lệnh (CLI)

### Quản lý Manager service

```bash
# Xem trạng thái
systemctl status openclaw-manager

# Khởi động
systemctl start openclaw-manager

# Dừng
systemctl stop openclaw-manager

# Khởi động lại
systemctl restart openclaw-manager

# Xem log realtime
journalctl -u openclaw-manager -f

# Xem 50 dòng log gần nhất
journalctl -u openclaw-manager -n 50 --no-pager

# Tắt tự khởi động cùng hệ thống
systemctl disable openclaw-manager

# Bật tự khởi động cùng hệ thống
systemctl enable openclaw-manager
```

### Quản lý OpenClaw container

```bash
# Xem container đang chạy
cd /opt/openclaw
docker compose ps

# Xem log OpenClaw
docker compose logs --tail 100

# Xem log realtime
docker compose logs -f

# Restart container
docker compose restart

# Dừng container
docker compose down

# Khởi động container
docker compose up -d

# Xem tài nguyên container
docker stats openclaw-gateway
```

### Backup thủ công

```bash
sudo bash /opt/openclaw-manager/scripts/backup.sh
```

### Cập nhật thủ công

```bash
sudo bash /opt/openclaw-manager/scripts/update-manager.sh
```

---

## 18. Cấu hình nâng cao (.env)

File `.env` nằm tại `/opt/openclaw-manager/.env`

```bash
nano /opt/openclaw-manager/.env
```

### Các biến cấu hình

| Biến | Mô tả | Mặc định | Khi nào sửa |
|------|--------|----------|-------------|
| `PORT` | Cổng web UI | `3847` | Khi port bị trùng |
| `HOST` | IP bind | `0.0.0.0` | Để `127.0.0.1` nếu chỉ cho phép truy cập local |
| `NODE_ENV` | Môi trường | `production` | Đổi sang `development` khi debug |
| `SESSION_SECRET` | Khoá mã hoá session | (random) | **KHÔNG** đổi sau khi đã chạy |
| `ENCRYPTION_KEY` | Khoá mã hoá API keys | (random) | **KHÔNG** đổi (mất hết API key đã lưu) |
| `DB_PATH` | Đường dẫn database | `./data/manager.db` | Khi muốn lưu DB nơi khác |
| `LOG_DIR` | Thư mục log | `./data/logs` | Khi muốn lưu log nơi khác |
| `LOG_LEVEL` | Mức log | `info` | `debug` để xem chi tiết hơn |
| `OPENCLAW_INSTALL_DIR` | Thư mục OpenClaw | `/opt/openclaw` | Khi muốn cài OpenClaw nơi khác |
| `OPENCLAW_IMAGE` | Docker image | `ghcr.io/openclaw/openclaw:latest` | Khi muốn dùng image tùy chỉnh |
| `OPENCLAW_GATEWAY_PORT` | Cổng gateway | `18789` | Khi port bị trùng |
| `OPENCLAW_BRIDGE_PORT` | Cổng bridge | `18790` | Khi port bị trùng |

> **Sau khi sửa .env**, chạy: `systemctl restart openclaw-manager`

---

## 19. Xử lý sự cố thường gặp

### Manager không truy cập được

**Triệu chứng:** Mở `http://IP:3847` không được

**Kiểm tra:**
```bash
# Service đang chạy?
systemctl status openclaw-manager

# Port mở?
ss -tlnp | grep 3847

# Firewall chặn?
ufw status
iptables -L -n | grep 3847
```

**Giải pháp:**
```bash
# Nếu service tắt
systemctl start openclaw-manager

# Nếu firewall chặn
ufw allow 3847/tcp
```

### OpenClaw container không chạy

**Kiểm tra:**
```bash
cd /opt/openclaw
docker compose ps
docker compose logs --tail 30
```

**Giải pháp thường gặp:**
```bash
# Khởi động lại
docker compose restart

# Nếu vẫn lỗi, rebuild
docker compose down
docker compose up -d

# Nếu image bị lỗi, pull lại
docker compose pull
docker compose up -d
```

### Lỗi "Permission denied"

```bash
# Sửa quyền thư mục config
chown -R 1000:1000 /opt/openclaw/config /opt/openclaw/data
```

### SSL không cấp được

**Nguyên nhân thường gặp:**
1. DNS chưa trỏ đúng → kiểm tra bằng `dig A your-domain.com`
2. Port 80 bị chặn → `ufw allow 80/tcp`
3. Nginx lỗi → `nginx -t` để kiểm tra

**Cấp lại SSL thủ công:**
```bash
certbot --nginx -d your-domain.com --email your@email.com --agree-tos
```

### Database bị lỗi

```bash
# Backup database hiện tại
cp /opt/openclaw-manager/data/manager.db /tmp/manager.db.bak

# Xoá database (sẽ tạo mới khi restart)
rm /opt/openclaw-manager/data/manager.db

# Restart (database mới sẽ được tạo)
systemctl restart openclaw-manager

# Sau đó cần thiết lập lại tài khoản admin
```

### Quên mật khẩu admin

```bash
# Xoá database để tạo tài khoản mới
# CẢNH BÁO: sẽ mất toàn bộ cấu hình trong Manager
cp /opt/openclaw-manager/data/manager.db /tmp/manager.db.bak
rm /opt/openclaw-manager/data/manager.db
systemctl restart openclaw-manager
# Mở web UI → tạo tài khoản admin mới
```

### Disk đầy

```bash
# Kiểm tra dung lượng
df -h

# Xoá log cũ
truncate -s 0 /opt/openclaw-manager/data/logs/combined.log
truncate -s 0 /opt/openclaw-manager/data/logs/error.log

# Xoá Docker image cũ
docker image prune -a

# Xoá Docker log
docker system prune
```

### Container tốn nhiều RAM

```bash
# Kiểm tra
docker stats openclaw-gateway

# Giới hạn RAM trong docker-compose.yml
# Thêm vào service openclaw-gateway:
#   deploy:
#     resources:
#       limits:
#         memory: 1G
```

---

## 20. Câu hỏi thường gặp (FAQ)

### Q: Manager có cần chạy cùng server với OpenClaw không?
**A:** Có. Manager quản lý Docker container và file config trên cùng server. Không hỗ trợ quản lý remote server.

### Q: Có thể chạy nhiều OpenClaw trên 1 VPS không?
**A:** Hiện tại Manager quản lý 1 instance OpenClaw. Để chạy nhiều instance, bạn cần sửa port và thư mục cài đặt.

### Q: Manager có tốn tài nguyên không?
**A:** Rất ít. Manager chỉ dùng ~50 MB RAM và gần 0% CPU khi không có request.

### Q: Có cần biết Docker để dùng không?
**A:** Không. Manager xử lý toàn bộ Docker cho bạn. Nhưng biết Docker sẽ giúp khi cần debug.

### Q: API key có an toàn không?
**A:** API key được mã hoá bằng AES-256-GCM trước khi lưu. Chỉ giải mã khi cần sử dụng thực tế.

### Q: Mất token gateway có sao không?
**A:** Bạn có thể tạo mới token ngay trên web UI (Thông tin dịch vụ → 🔄). Container sẽ tự restart.

### Q: Có thể dùng Caddy thay Nginx không?
**A:** Hiện tại Manager tự động cấu hình Nginx. Để dùng Caddy, bạn cần cấu hình thủ công.

### Q: ChatGPT OAuth là gì?
**A:** Cho phép dùng model ChatGPT (GPT-4o, o1...) thông qua đăng nhập tài khoản ChatGPT, không cần API key. Phù hợp khi bạn có ChatGPT Plus/Pro.

### Q: Làm sao biết OpenClaw đã chạy thành công?
**A:** Dashboard hiện "Hoạt động" (xanh), health check tất cả ✓ OK.

### Q: Có auto-update không?
**A:** Không auto-update. Bạn chủ động nâng cấp qua web UI hoặc script khi muốn.

---

## 21. Dành cho nhà cung cấp dịch vụ VPS

### Quy trình triển khai cho khách hàng

1. **Chuẩn bị VPS:** Ubuntu 24.04, 2 vCPU, 2 GB RAM, 30 GB SSD
2. **Cài Manager:** chạy script `install-manager.sh`
3. **Giao cho khách:** cung cấp IP + port 3847
4. **Khách tự phục vụ:**
   - Tạo tài khoản admin
   - Cài OpenClaw 1 click
   - Cấu hình AI, kênh chat
   - Quản lý domain/SSL

### Tích hợp với panel bán VPS

Manager cung cấp REST API đầy đủ. Bạn có thể gọi API từ panel bán hàng:

```bash
# Kiểm tra trạng thái
curl http://IP:3847/api/service/info -H "Cookie: ocm.sid=xxx"

# Cài đặt tự động
curl -X POST http://IP:3847/api/install \
  -H "Content-Type: application/json" \
  -H "Cookie: ocm.sid=xxx" \
  -d '{"domain":"client.example.com","email":"client@example.com"}'
```

### Bảo mật cho production

1. **Đổi port mặc định:**
   ```bash
   # Trong .env
   PORT=9999
   ```

2. **Giới hạn IP truy cập Manager:**
   ```bash
   ufw allow from YOUR_IP to any port 3847
   ufw deny 3847
   ```

3. **Đặt Manager sau reverse proxy với SSL:**
   ```bash
   cp templates/nginx-manager.conf /etc/nginx/sites-available/manager
   # Sửa domain và port, chạy certbot
   ```

4. **Backup tự động hàng ngày:**
   ```bash
   echo "0 2 * * * root bash /opt/openclaw-manager/scripts/backup.sh" >> /etc/crontab
   ```

### File và thư mục quan trọng

| Đường dẫn | Nội dung |
|-----------|----------|
| `/opt/openclaw-manager/` | Mã nguồn Manager |
| `/opt/openclaw-manager/.env` | Cấu hình Manager |
| `/opt/openclaw-manager/data/manager.db` | Database Manager |
| `/opt/openclaw-manager/data/logs/` | Log Manager |
| `/opt/openclaw/` | Thư mục OpenClaw |
| `/opt/openclaw/config/openclaw.json` | Cấu hình OpenClaw |
| `/opt/openclaw/.env` | Biến môi trường OpenClaw |
| `/opt/openclaw/docker-compose.yml` | Docker Compose |
| `/opt/openclaw/backups/` | Các file backup |
| `/etc/nginx/sites-available/openclaw-*` | Nginx config cho domain |
| `/etc/systemd/system/openclaw-manager.service` | Systemd service |

---

## Liên hệ hỗ trợ

Nếu gặp vấn đề không giải quyết được:

1. Kiểm tra log: Menu → Nhật ký hệ thống
2. Chạy: `journalctl -u openclaw-manager -n 100 --no-pager`
3. Chạy: `docker compose -f /opt/openclaw/docker-compose.yml logs --tail 100`
4. Gửi log kèm mô tả lỗi để được hỗ trợ

---

*Tài liệu cập nhật: 2026-04-02*
*OpenClaw Manager v1.0.0*
