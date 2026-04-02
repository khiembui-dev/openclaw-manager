#!/bin/bash
# =====================================================
# OpenClaw Manager - 1 Lenh Cai Dat
# =====================================================
# Chay:
#   curl -fsSL https://raw.githubusercontent.com/khiembui-dev/openclaw-manager/main/install.sh | sudo bash
#
# Ho tro: Ubuntu 22.04 / 24.04 / Debian 12
# =====================================================

set -euo pipefail

INSTALL_DIR="/opt/openclaw-manager"
REPO="https://github.com/khiembui-dev/openclaw-manager.git"
NODE_VER="22"
SERVICE="openclaw-manager"
PORT=3847

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[!!]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[>>]${NC} $1"; }

clear
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║                                               ║"
echo "  ║        OpenClaw Manager Installer             ║"
echo "  ║        Powered by GENCLOUD                    ║"
echo "  ║                                               ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# ============ Check root ============
if [ "$(id -u)" -ne 0 ]; then
  err "Can chay voi quyen root. Dung: curl ... | sudo bash"
fi

# ============ Check OS ============
if [ -f /etc/os-release ]; then
  . /etc/os-release
  info "OS: $PRETTY_NAME"
else
  err "Khong xac dinh duoc he dieu hanh"
fi

# ============ Install git ============
if ! command -v git &>/dev/null; then
  info "Cai dat git..."
  apt-get update -qq && apt-get install -y -qq git curl > /dev/null 2>&1
  log "Git da cai"
fi

# ============ Install Node.js ============
NEED_NODE=false
if ! command -v node &>/dev/null; then
  NEED_NODE=true
else
  CUR_VER=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$CUR_VER" -lt 18 ]; then
    NEED_NODE=true
    warn "Node.js v$CUR_VER qua cu, can nang cap"
  fi
fi

if [ "$NEED_NODE" = true ]; then
  info "Cai dat Node.js ${NODE_VER}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VER}.x" | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
  log "Node.js $(node --version) da cai"
else
  log "Node.js $(node --version) OK"
fi

# ============ Clone repo ============
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Thu muc da ton tai, cap nhat..."
  cd "$INSTALL_DIR"
  git pull origin main --quiet
  log "Da cap nhat code"
else
  if [ -d "$INSTALL_DIR" ]; then
    warn "Xoa thu muc cu $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
  fi
  info "Tai ma nguon tu GitHub..."
  git clone --depth 1 "$REPO" "$INSTALL_DIR" --quiet
  log "Da tai xong"
fi

# ============ Install dependencies ============
cd "$INSTALL_DIR"
info "Cai dat dependencies..."
npm install --production --no-optional > /dev/null 2>&1
log "Dependencies OK"

# ============ Create .env ============
if [ ! -f .env ]; then
  cp .env.example .env
  SESSION_SECRET=$(openssl rand -hex 64)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  sed -i "s/change-this-to-a-random-string/$SESSION_SECRET/" .env
  sed -i "s/change-this-to-a-64-char-hex-string/$ENCRYPTION_KEY/" .env
  log "File .env da tao (secrets ngau nhien)"
else
  log "File .env da ton tai, giu nguyen"
fi

# ============ Create data dir ============
mkdir -p data/logs
log "Thu muc data/ OK"

# ============ Init database ============
node -e "
  require('dotenv').config();
  const { initDatabase } = require('./src/database');
  initDatabase();
  console.log('[OK] Database initialized');
" 2>&1 | tail -1
log "Database OK"

# ============ Install systemd service ============
cat > /etc/systemd/system/${SERVICE}.service << SVCEOF
[Unit]
Description=OpenClaw Manager Web UI
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(which node) server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=-${INSTALL_DIR}/.env

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable "$SERVICE" > /dev/null 2>&1
systemctl restart "$SERVICE"
log "Service da khoi dong"

# ============ Get IP ============
sleep 1
PUBLIC_IP=$(curl -s -4 --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

# ============ Done ============
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║                                               ║"
echo "  ║         CAI DAT HOAN TAT!                     ║"
echo "  ║                                               ║"
echo -e "  ║  ${NC}${BOLD}URL: http://${PUBLIC_IP}:${PORT}${GREEN}${BOLD}"
printf "  ║  %-45s ║\n" ""
echo "  ║                                               ║"
echo "  ║  Buoc tiep theo:                              ║"
echo "  ║  1. Mo URL tren trinh duyet                   ║"
echo "  ║  2. Tao tai khoan admin                       ║"
echo "  ║  3. Cai dat OpenClaw 1 click                  ║"
echo "  ║                                               ║"
echo "  ║  Quan ly:                                     ║"
echo "  ║  systemctl status openclaw-manager            ║"
echo "  ║  systemctl restart openclaw-manager           ║"
echo "  ║  journalctl -u openclaw-manager -f            ║"
echo "  ║                                               ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
