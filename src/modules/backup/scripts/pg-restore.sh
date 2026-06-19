#!/bin/bash
# ──────────────────────────────────────────────────────
# ERP AutomotiveOS — Database Restore Script
# Desencripta, descomprime y restaura un respaldo.
# Uso: ./pg-restore.sh [ARCHIVO] [DATABASE_URL] [PASSWORD]
# ──────────────────────────────────────────────────────

set -euo pipefail

BACKUP_FILE="${1:?Uso: $0 <archivo_backup> [DATABASE_URL] [PASSWORD]}"
DB_URL="${2:-${DATABASE_URL:-postgresql://localhost:5432/automotive_erp}}"
PASSWORD="${3:-}"

STAGING_DIR="/tmp/restore-staging-$$"
mkdir -p "$STAGING_DIR"

echo "[$(date -Iseconds)] ═══════════════════════════════════════"
echo "[$(date -Iseconds)] MODO RESTAURACIÓN — CONFIRME LA ACCIÓN"
echo "[$(date -Iseconds)] Archivo: $BACKUP_FILE"
echo "[$(date -Iseconds)] Destino: $(echo $DB_URL | sed 's/:[^@]*@/:***@/')"
echo "[$(date -Iseconds)] ═══════════════════════════════════════"

# Verificar que el archivo existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo "[$(date -Iseconds)] ERROR: Archivo no encontrado: $BACKUP_FILE"
    exit 1
fi

# Verificar integridad (checksum si existe .sha256 sidecar)
if [ -f "${BACKUP_FILE}.sha256" ]; then
    echo "[$(date -Iseconds)] Verificando integridad..."
    if shasum -a 256 -c "${BACKUP_FILE}.sha256" 2>/dev/null; then
        echo "[$(date -Iseconds)] Integridad verificada ✓"
    else
        echo "[$(date -Iseconds)] ERROR: Integridad verificada ✗ — Archivo corrupto"
        rm -rf "$STAGING_DIR"
        exit 1
    fi
fi

# 1. Desencriptar si tiene contraseña
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.enc ]]; then
    if [ -z "$PASSWORD" ]; then
        echo "[$(date -Iseconds)] ERROR: Archivo encriptado. Proporcione la contraseña."
        rm -rf "$STAGING_DIR"
        exit 1
    fi
    echo "[$(date -Iseconds)] Desencriptando..."
    openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 \
        -in "$BACKUP_FILE" \
        -out "${STAGING_DIR}/decrypted.sql.gz" \
        -pass pass:"$PASSWORD"
    RESTORE_FILE="${STAGING_DIR}/decrypted.sql.gz"
    echo "[$(date -Iseconds)] Desencriptación completada"
fi

# 2. Descomprimir si es gzipped
if [[ "$RESTORE_FILE" == *.gz ]] || file "$RESTORE_FILE" | grep -q gzip; then
    echo "[$(date -Iseconds)] Descomprimiendo..."
    gunzip -c "$RESTORE_FILE" > "${STAGING_DIR}/restore.sql"
    RESTORE_FILE="${STAGING_DIR}/restore.sql"
    echo "[$(date -Iseconds)] Descompresión completada"
fi

# 3. Verificar que el SQL es válido
if ! head -20 "$RESTORE_FILE" | grep -q -E "(CREATE|ALTER|INSERT|SET)"; then
    echo "[$(date -Iseconds)] ERROR: El archivo no contiene SQL válido"
    rm -rf "$STAGING_DIR"
    exit 1
fi

SQL_SIZE=$(stat -f%z "$RESTORE_FILE" 2>/dev/null || stat -c%s "$RESTORE_FILE" 2>/dev/null || echo "0")
echo "[$(date -Iseconds)] SQL a restaurar: $((SQL_SIZE / 1024 / 1024)) MB"

# 4. Confirmar antes de restaurar
echo ""
echo "[$(date -Iseconds)] ⚠ ADVERTENCIA: Esto SOBRESCRIBIRÁ la base de datos actual."
echo "[$(date -Iseconds)] Presione Ctrl+C para cancelar, o Enter para continuar..."
read -r

# 5. Ejecutar restauración
echo "[$(date -Iseconds)] Ejecutando restauración SQL..."
psql "$DB_URL" -f "$RESTORE_FILE" 2>&1 | tail -20

echo "[$(date -Iseconds)] ═══════════════════════════════════════"
echo "[$(date -Iseconds)] Restauración completada exitosamente"
echo "[$(date -Iseconds)] ═══════════════════════════════════════"

# 6. Limpiar
rm -rf "$STAGING_DIR"
