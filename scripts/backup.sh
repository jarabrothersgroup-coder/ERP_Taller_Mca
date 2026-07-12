#!/usr/bin/env bash
# backup.sh — Backup on-prem del ERP Taller MCA
# - Dump de la BD (pg_dump -Fc) en /data/backups/db-<fecha>.dump
# - Tar de /data/erp-storage y configs/ del repo
# - Rotación: 30 diarios + 12 mensuales
# - Copia offsite si OFFSITE_TARGET está definido (user@host:/ruta o remote rclone)
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
STORAGE_DIR="${STORAGE_DIR:-/data/erp-storage}"
REPO_DIR="${REPO_DIR:-/data/ERP_Taller_Mca}"
DB_NAME="${DB_NAME:-automotive_os}"
DATE="$(date +%F)"
KEEP_DAILY=30
KEEP_MONTHLY=12

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly"

# 1) Dump de la BD
echo "[backup] pg_dump $DB_NAME -> db-$DATE.dump"
sudo -u postgres pg_dump -Fc "$DB_NAME" -f "$BACKUP_DIR/daily/db-$DATE.dump" \
  || pg_dump -Fc "$DB_NAME" -f "$BACKUP_DIR/daily/db-$DATE.dump"

# 2) Archivos (storage + configs)
echo "[backup] tar storage + configs -> files-$DATE.tar.gz"
tar czf "$BACKUP_DIR/daily/files-$DATE.tar.gz" -C / "$STORAGE_DIR" 2>/dev/null || true
if [[ -d "$REPO_DIR/configs" ]]; then
  tar czf "$BACKUP_DIR/daily/configs-$DATE.tar.gz" -C "$REPO_DIR" configs 2>/dev/null || true
fi

# 3) Rotación diaria
find "$BACKUP_DIR/daily" -name '*.dump' -mtime +"$KEEP_DAILY" -delete 2>/dev/null || true
find "$BACKUP_DIR/daily" -name '*.tar.gz' -mtime +"$KEEP_DAILY" -delete 2>/dev/null || true

# 4) Mensual (primer día del mes)
if [[ "$(date +%d)" == "01" ]]; then
  cp "$BACKUP_DIR/daily/db-$DATE.dump" "$BACKUP_DIR/monthly/" 2>/dev/null || true
  find "$BACKUP_DIR/monthly" -name '*.dump' -mtime +$((KEEP_MONTHLY*31)) -delete 2>/dev/null || true
fi

# 5) Offsite (best-effort)
if [[ -n "${OFFSITE_TARGET:-}" ]]; then
  echo "[backup] copiando offsite -> $OFFSITE_TARGET"
  scp "$BACKUP_DIR/daily/db-$DATE.dump" "$OFFSITE_TARGET/" 2>/dev/null \
    || rclone copy "$BACKUP_DIR/daily/db-$DATE.dump" "$OFFSITE_TARGET" 2>/dev/null \
    || echo "[backup][warn] offsite falló (no fatal)"
fi

echo "[backup] OK ($DATE)"
