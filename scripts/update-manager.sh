#!/bin/bash
# =====================================================
# OpenClaw Manager - Update Script
# =====================================================
set -euo pipefail

INSTALL_DIR="/opt/openclaw-manager"
SERVICE_NAME="openclaw-manager"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo "Cập nhật OpenClaw Manager..."

cd "$INSTALL_DIR" || error "Thư mục $INSTALL_DIR không tồn tại"

# Backup current .env and database
warn "Backup cấu hình hiện tại..."
cp -f .env .env.backup 2>/dev/null || true
cp -f data/manager.db data/manager.db.backup 2>/dev/null || true
log "Backup hoàn tất"

# Pull latest code
if [ -d .git ]; then
  git pull origin main
  log "Git pull thành công"
else
  warn "Không phải git repo. Bỏ qua git pull."
fi

# Install dependencies
npm install --production --no-optional 2>&1 | tail -3
log "Dependencies đã cập nhật"

# Restart service
systemctl restart "$SERVICE_NAME"
log "Service đã restart"

echo ""
log "Cập nhật hoàn tất!"
echo ""
