#!/bin/bash
# =====================================================
# OpenClaw Manager - Backup Script
# =====================================================
set -euo pipefail

INSTALL_DIR="/opt/openclaw-manager"
OPENCLAW_DIR="/opt/openclaw"
BACKUP_DIR="/opt/openclaw/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/full-backup-$TIMESTAMP.tar.gz"

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[✓]${NC} $1"; }

echo "Tạo backup..."

mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_FILE" \
  -C / \
  --ignore-failed-read \
  "opt/openclaw-manager/.env" \
  "opt/openclaw-manager/data/manager.db" \
  "opt/openclaw/config" \
  "opt/openclaw/.env" \
  "opt/openclaw/docker-compose.yml" \
  2>/dev/null || true

log "Backup: $BACKUP_FILE"
log "Size: $(du -sh "$BACKUP_FILE" | cut -f1)"
echo ""
