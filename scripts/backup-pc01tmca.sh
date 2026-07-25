#!/usr/bin/env bash
# backup-pc01tmca.sh — Backup automático del frontend en PC01Tmca
# Copia del repo (excluyendo node_modules, .git, .next) a /home/jarabro/backups/
# Rotación: 7 días diarios, 12 meses mensuales
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/jarabro/backups}"
REPO_DIR="${REPO_DIR:-/home/jarabro/Proyectos/ERP_Taller_Mca}"
DATE="$(date +%F)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
KEEP_DAILY=7
KEEP_MONTHLY=12
DAY_OF_MONTH="$(date +%d)"

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly"

echo "[backup-pc01tmca] Iniciando backup ($TIMESTAMP)"

# 1) Backup del repositorio principal
echo "[backup-pc01tmca] Repo → $BACKUP_DIR/daily/repo-$DATE.tar.gz"
tar czf "$BACKUP_DIR/daily/repo-$DATE.tar.gz" \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.next \
  --exclude=.agents \
  --exclude=dist \
  -C /home/jarabro/Proyectos \
  ERP_Taller_Mca 2>/dev/null || true

# 2) Backup de la web (build output + config)
if [ -d "$REPO_DIR/web" ]; then
  echo "[backup-pc01tmca] Web → $BACKUP_DIR/daily/web-$DATE.tar.gz"
  tar czf "$BACKUP_DIR/daily/web-$DATE.tar.gz" \
    --exclude=node_modules \
    --exclude=.next \
    -C "$REPO_DIR" \
    web 2>/dev/null || true
fi

# 3) Backup de variables de entorno
if [ -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env" "$BACKUP_DIR/daily/env-$DATE.bak" 2>/dev/null || true
fi

# 4) Rotación diaria (keep 7 días)
find "$BACKUP_DIR/daily" -name 'repo-*.tar.gz' -mtime +"$KEEP_DAILY" -delete 2>/dev/null || true
find "$BACKUP_DIR/daily" -name 'web-*.tar.gz' -mtime +"$KEEP_DAILY" -delete 2>/dev/null || true
find "$BACKUP_DIR/daily" -name 'env-*.bak' -mtime +"$KEEP_DAILY" -delete 2>/dev/null || true

# 5) Backup mensual (primer día del mes)
if [ "$DAY_OF_MONTH" = "01" ]; then
  echo "[backup-pc01tmca] Backup mensual"
  cp "$BACKUP_DIR/daily/repo-$DATE.tar.gz" "$BACKUP_DIR/monthly/repo-$DATE.tar.gz" 2>/dev/null || true
  find "$BACKUP_DIR/monthly" -name 'repo-*.tar.gz' -mtime +$((KEEP_MONTHLY*31)) -delete 2>/dev/null || true
fi

# 6) Limpiar backups fallidos/vacíos
find "$BACKUP_DIR" -name '*.tar.gz' -size 0 -delete 2>/dev/null || true

echo "[backup-pc01tmca] Backup completado ($TIMESTAMP)"
echo "[backup-pc01tmca] Resumen:"
du -sh "$BACKUP_DIR/daily/repo-$DATE.tar.gz" 2>/dev/null || echo "  repo: no disponible"
echo "[backup-pc01tmca] Total backups: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
