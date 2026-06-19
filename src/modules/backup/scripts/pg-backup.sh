#!/bin/bash
# ──────────────────────────────────────────────────────
# ERP AutomotiveOS — Database Backup Script
# Ejecuta pg_dump, comprime y encripta el respaldo.
# Uso: ./pg-backup.sh [DATABASE_URL] [DESTINO] [PASSWORD]
# ──────────────────────────────────────────────────────

set -euo pipefail

# Configuración
DB_URL="${1:-${DATABASE_URL:-postgresql://localhost:5432/automotive_erp}}"
DESTINO="${2:-/var/backups/erp}"
PASSWORD="${3:-}"
FECHA=$(date +%Y%m%d_%H%M%S)
NOMBRE_BASE="backup_erp_${FECHA}"

# Crear directorio de destino
mkdir -p "$DESTINO"
mkdir -p /tmp/backup-staging

echo "[$(date -Iseconds)] Iniciando backup de base de datos..."
echo "[$(date -Iseconds)] Base de datos: $(echo $DB_URL | sed 's/:[^@]*@/:***@/')"
echo "[$(date -Iseconds)] Destino: $DESTINO"

# 1. Ejecutar pg_dump
echo "[$(date -Iseconds)] Ejecutando pg_dump..."
pg_dump --no-owner --no-acl --clean --if-exists "$DB_URL" > "/tmp/backup-staging/${NOMBRE_BASE}.sql" 2>&1

SQL_SIZE=$(stat -f%z "/tmp/backup-staging/${NOMBRE_BASE}.sql" 2>/dev/null || stat -c%s "/tmp/backup-staging/${NOMBRE_BASE}.sql" 2>/dev/null || echo "0")
echo "[$(date -Iseconds)] pg_dump completado (${SQL_SIZE} bytes)"

# 2. Comprimir con gzip
echo "[$(date -Iseconds)] Comprimiendo..."
gzip -6 "/tmp/backup-staging/${NOMBRE_BASE}.sql"
GZ_FILE="/tmp/backup-staging/${NOMBRE_BASE}.sql.gz"
GZ_SIZE=$(stat -f%z "$GZ_FILE" 2>/dev/null || stat -c%s "$GZ_FILE" 2>/dev/null || echo "0")
echo "[$(date -Iseconds)] Compresión completada (${GZ_SIZE} bytes)"

# 3. Encriptar si se proporcionó contraseña
if [ -n "$PASSWORD" ]; then
    echo "[$(date -Iseconds)] Encriptando con AES-256..."
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -in "$GZ_FILE" \
        -out "${DESTINO}/${NOMBRE_BASE}.sql.gz.enc" \
        -pass pass:"$PASSWORD"
    rm -f "$GZ_FILE"
    FINAL_FILE="${DESTINO}/${NOMBRE_BASE}.sql.gz.enc"
    echo "[$(date -Iseconds)] Encriptación completada"
else
    mv "$GZ_FILE" "${DESTINO}/${NOMBRE_BASE}.sql.gz"
    FINAL_FILE="${DESTINO}/${NOMBRE_BASE}.sql.gz"
fi

# 4. Calcular checksum
CHECKSUM=$(sha256sum "$FINAL_FILE" 2>/dev/null || shasum -a 256 "$FINAL_FILE" 2>/dev/null | awk '{print $1}')
FINAL_SIZE=$(stat -f%z "$FINAL_FILE" 2>/dev/null || stat -c%s "$FINAL_FILE" 2>/dev/null || echo "0")

echo "[$(date -Iseconds)] ────────────────────────────────────────"
echo "[$(date -Iseconds)] Backup completado exitosamente"
echo "[$(date -Iseconds)] Archivo: $FINAL_FILE"
echo "[$(date -Iseconds)] Tamaño: $((FINAL_SIZE / 1024 / 1024)) MB ($FINAL_SIZE bytes)"
echo "[$(date -Iseconds)] Checksum: $CHECKSUM"
echo "[$(date -Iseconds)] ────────────────────────────────────────"

# 5. Limpiar archivos temporales
rm -rf /tmp/backup-staging

# 6. Eliminar respaldos antiguos (retener últimos 30 días)
echo "[$(date -Iseconds)] Eliminando respaldos antiguos (>30 días)..."
find "$DESTINO" -name "backup_*" -type f -mtime +30 -delete 2>/dev/null || true

echo "[$(date -Iseconds)] Proceso completado."
