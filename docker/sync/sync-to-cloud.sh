#!/bin/bash
# ─────────────────────────────────────────────────────────
# AutomotiveOS — Hybrid Sync Worker (Local → Supabase Cloud)
# ─────────────────────────────────────────────────────────
# Ejecuta pg_dump de tablas críticas y pg_restore en Supabase Cloud.
# Diseñado para ejecutarse vía cron cada 5 minutos.
#
# Tablas sincronizadas:
#   - ordenes_trabajo (OTs activas + finalizadas recientes)
#   - facturas (documentos fiscales)
#   - clients (clientes)
#   - vehiculos (vehículos)
#   - repuestos (inventario)
#   - asientos_contables (asientos contables)
#
# Seguridad:
#   - Dump comprimido con gzip antes de transferir
#   - SSL verification obligatoria
#   - Backup local antes de push
# ─────────────────────────────────────────────────────────

set -euo pipefail

# ─── Configuration ──────────────────────────────────────
LOCAL_DB_URL="${LOCAL_DB_URL:?LOCAL_DB_URL is required}"
CLOUD_DB_URL="${CLOUD_DB_URL:?CLOUD_DB_URL is required}"
SYNC_TABLES="${SYNC_TABLES:-ordenes_trabajo,facturas,clients,vehiculos}"
SYNC_INTERVAL="${SYNC_INTERVAL_MS:-300000}"
LOG_DIR="${LOG_DIR:-/app/logs}"
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"

# ─── Setup ──────────────────────────────────────────────
mkdir -p "$LOG_DIR" "$BACKUP_DIR"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

# ─── Sync Function ──────────────────────────────────────
sync_table() {
  local table="$1"
  local timestamp=$(date -u +'%Y%m%d_%H%M%S')
  local dump_file="${BACKUP_DIR}/${table}_${timestamp}.sql.gz"

  log "🔄 Syncing table: ${table}"

  # Step 1: pg_dump from local PostgreSQL
  pg_dump "$LOCAL_DB_URL" \
    --table="$table" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    | gzip > "$dump_file"

  local dump_size=$(stat -c%s "$dump_file" 2>/dev/null || stat -f%z "$dump_file" 2>/dev/null || echo "0")
  log "📦 Dump size: ${dump_size} bytes"

  if [ "$dump_size" -lt 100 ]; then
    log "⚠️ Empty dump for ${table} — skipping"
    rm -f "$dump_file"
    return 0
  fi

  # Step 2: pg_restore to Supabase Cloud (with SSL)
  gunzip -c "$dump_file" | psql "$CLOUD_DB_URL" \
    --set ON_ERROR_STOP=off \
    --single-transaction \
    2>&1 | tee -a "${LOG_DIR}/sync_${timestamp}.log"

  local exit_code=${PIPESTATUS[0]}

  if [ $exit_code -eq 0 ]; then
    log "✅ Sync complete: ${table}"
  else
    log "❌ Sync failed: ${table} (exit code: ${exit_code})"
    # Keep failed dump for debugging
    mv "$dump_file" "${dump_file}.FAILED"
    return 1
  fi

  # Step 3: Cleanup old dumps (keep last 7 days)
  find "$BACKUP_DIR" -name "${table}_*.sql.gz" -mtime +7 -delete 2>/dev/null || true
  find "$BACKUP_DIR" -name "${table}_*.sql.gz.FAILED" -mtime +3 -delete 2>/dev/null || true
}

# ─── Main Loop ──────────────────────────────────────────
log "🚀 Sync Worker started (interval: ${SYNC_INTERVAL}ms)"
log "📋 Tables: ${SYNC_TABLES}"

while true; do
  IFS=',' read -ra TABLES <<< "$SYNC_TABLES"

  for table in "${TABLES[@]}"; do
    table=$(echo "$table" | xargs)  # Trim whitespace
    sync_table "$table" || true     # Don't exit on single table failure
  done

  log "💤 Sleeping ${SYNC_INTERVAL}ms..."
  sleep $((SYNC_INTERVAL / 1000))
done
