#!/bin/bash
# =====================================================
# OpenClaw Manager - Uninstall Script
# =====================================================
set -euo pipefail

INSTALL_DIR="/opt/openclaw-manager"
SERVICE_NAME="openclaw-manager"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}"
echo "╔══════════════════════════════════════════╗"
echo "║    CẢNH BÁO: GỠ CÀI ĐẶT MANAGER        ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo "Thao tác này sẽ:"
echo "  - Dừng và xoá service systemd"
echo "  - Xoá thư mục $INSTALL_DIR"
echo "  - KHÔNG xoá OpenClaw (/opt/openclaw)"
echo ""
read -p "Nhập 'UNINSTALL' để xác nhận: " CONFIRM

if [ "$CONFIRM" != "UNINSTALL" ]; then
  echo "Đã huỷ."
  exit 0
fi

echo ""

# Stop and remove service
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  systemctl stop "$SERVICE_NAME"
  echo -e "${GREEN}[✓]${NC} Service đã dừng"
fi

if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
  systemctl disable "$SERVICE_NAME" 2>/dev/null || true
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  echo -e "${GREEN}[✓]${NC} Service đã xoá"
fi

# Remove install directory
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo -e "${GREEN}[✓]${NC} Thư mục $INSTALL_DIR đã xoá"
fi

echo ""
echo -e "${GREEN}[✓]${NC} Gỡ cài đặt hoàn tất"
echo -e "${YELLOW}[!]${NC} OpenClaw (/opt/openclaw) vẫn được giữ nguyên"
echo ""
