#!/bin/bash
# =====================================================
# OpenClaw Manager - Quick Install Script
# =====================================================
# Usage: bash <(curl -fsSL https://your-domain.com/install-manager.sh)
# Or:    bash install-manager.sh
#
# Requirements: Ubuntu 22.04/24.04 or Debian 12, root access
# =====================================================

set -euo pipefail

INSTALL_DIR="/opt/openclaw-manager"
NODE_VERSION="22"
REPO_URL="https://github.com/khiembui-dev/openclaw-manager.git"
BRANCH="main"
SERVICE_NAME="openclaw-manager"
PORT=3847

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   OpenClaw Manager - Quick Installer     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check root
if [ "$(id -u)" -ne 0 ]; then
  error "Script phải chạy với quyền root. Thử: sudo bash $0"
fi

# Check OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  info "OS: $PRETTY_NAME"
  if [[ ! "$ID" =~ ^(ubuntu|debian)$ ]]; then
    warn "OS chưa được kiểm thử. Tiếp tục..."
  fi
else
  error "Không thể xác định hệ điều hành"
fi

# Install Node.js if needed
if ! command -v node &>/dev/null; then
  info "Cài đặt Node.js ${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
  log "Node.js đã cài: $(node --version)"
else
  NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt 18 ]; then
    warn "Node.js version $(node --version) quá cũ. Cập nhật lên v${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
  fi
  log "Node.js: $(node --version)"
fi

# Install git if needed
if ! command -v git &>/dev/null; then
  info "Cài đặt git..."
  apt-get install -y git
fi

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
  warn "Thư mục $INSTALL_DIR đã tồn tại"
  read -p "Cập nhật từ git? (y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$INSTALL_DIR"
    git pull origin "$BRANCH" || true
  fi
else
  info "Tải mã nguồn..."
  # If repo URL is not set, copy from current directory or download
  if [ -d "$(dirname "$0")/../package.json" ] 2>/dev/null; then
    cp -r "$(dirname "$0")/.." "$INSTALL_DIR"
  else
    # Try git clone
    git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR" 2>/dev/null || {
      # If git clone fails, create from local files
      mkdir -p "$INSTALL_DIR"
      if [ -f "$(pwd)/package.json" ]; then
        cp -r "$(pwd)"/* "$INSTALL_DIR"/
      else
        error "Không thể tải mã nguồn. Vui lòng copy thủ công vào $INSTALL_DIR"
      fi
    }
  fi
  log "Mã nguồn: $INSTALL_DIR"
fi

# Install dependencies
cd "$INSTALL_DIR"
info "Cài đặt dependencies..."
npm install --production --no-optional 2>&1 | tail -5
log "Dependencies đã cài"

# Run setup
info "Thiết lập ban đầu..."
mkdir -p data/logs

# Create .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  SESSION_SECRET=$(openssl rand -hex 64)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  sed -i "s/change-this-to-a-random-string/$SESSION_SECRET/" .env
  sed -i "s/change-this-to-a-64-char-hex-string/$ENCRYPTION_KEY/" .env
  sed -i "s/PORT=3847/PORT=$PORT/" .env
  log ".env đã tạo với secrets ngẫu nhiên"
fi

# Initialize database
node -e "
  require('dotenv').config();
  const { initDatabase } = require('./src/database');
  initDatabase();
  console.log('Database initialized');
"
log "Database đã khởi tạo"

# Install systemd service
info "Cài đặt systemd service..."
cp templates/openclaw-manager.service /etc/systemd/system/${SERVICE_NAME}.service
sed -i "s|WorkingDirectory=.*|WorkingDirectory=${INSTALL_DIR}|" /etc/systemd/system/${SERVICE_NAME}.service
sed -i "s|EnvironmentFile=.*|EnvironmentFile=-${INSTALL_DIR}/.env|" /etc/systemd/system/${SERVICE_NAME}.service

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"
log "Service ${SERVICE_NAME} đã khởi động"

# Get server IP
PUBLIC_IP=$(curl -s -4 --max-time 5 https://ifconfig.me 2>/dev/null || echo "unknown")

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       CÀI ĐẶT HOÀN TẤT!                    ║"
echo "║                                              ║"
echo "║  URL: http://${PUBLIC_IP}:${PORT}             "
echo "║                                              ║"
echo "║  1. Mở URL trên trình duyệt                 ║"
echo "║  2. Tạo tài khoản admin đầu tiên             ║"
echo "║  3. Cài đặt OpenClaw bằng 1 click            ║"
echo "║                                              ║"
echo "║  Quản lý service:                            ║"
echo "║    systemctl status $SERVICE_NAME             "
echo "║    systemctl restart $SERVICE_NAME            "
echo "║    journalctl -u $SERVICE_NAME -f             "
echo "╚══════════════════════════════════════════════╝"
echo ""
