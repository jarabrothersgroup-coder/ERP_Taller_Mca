#!/bin/bash
#=============================================================================
# setup-cron.sh — Configurar cron jobs para backups del ERP
#=============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-erp.sh"

echo "═══ Configurando Cron Jobs para Backups ═══"

# Ensure backup script is executable
chmod +x "${BACKUP_SCRIPT}"

# Create cron entries
# L/M/V a las 2:00 AM (incremental)
# Día 1 de cada mes a las 1:00 AM (mensual full)
CRON_ENTRIES="# ERP Taller MCA - Backup Policy
# Incremental: Lunes, Miércoles, Viernes a las 02:00
0 2 * * 1,3,5 ${BACKUP_SCRIPT} >> /data/backups/logs/cron.log 2>&1
# Mensual full: día 1 de cada mes a las 01:00
0 1 1 * * ${BACKUP_SCRIPT} >> /data/backups/logs/cron.log 2>&1
"

# Backup existing crontab
crontab -l > /tmp/crontab_backup_$(date +%Y%m%d) 2>/dev/null || true

# Check if ERP backup cron already exists
if crontab -l 2>/dev/null | grep -q "backup-erp.sh"; then
    echo "⚠️  Cron job ya existe. Actualizando..."
    # Remove old entries
    crontab -l 2>/dev/null | grep -v "backup-erp.sh" | grep -v "ERP Taller MCA" > /tmp/crontab_clean
    # Add new entries
    echo "" >> /tmp/crontab_clean
    echo "${CRON_ENTRIES}" >> /tmp/crontab_clean
    crontab /tmp/crontab_clean
    rm -f /tmp/crontab_clean
else
    # Append to existing crontab
    (crontab -l 2>/dev/null; echo ""; echo "${CRON_ENTRIES}") | crontab -
fi

echo ""
echo "═══ Cron Jobs Configurados ═══"
echo ""
echo "Horarios:"
echo "  📅 L/M/V 02:00 — Backup incremental (pg_dump + rsync)"
echo "  📅 Día 1 01:00 — Backup mensual full (tar.gz)"
echo ""
echo "Crontab actual:"
crontab -l
echo ""
echo "═══ Listo ═══"
