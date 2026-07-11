#!/bin/bash
#=============================================================================
# restore-erp.sh — Restaurar backup del ERP Taller MCA
#
# Uso: ./restore-erp.sh [fecha]
#   Ejemplo: ./restore-erp.sh 2026-07-08
#=============================================================================

set -euo pipefail

BACKUP_ROOT="/data/backups"
RESTORE_DATE="${1:-}"

if [[ -z "${RESTORE_DATE}" ]]; then
    echo "Uso: $0 <fecha>"
    echo ""
    echo "Fechas disponibles:"
    echo "  PostgreSQL dumps:"
    ls -1 "${BACKUP_ROOT}/postgres/daily/" 2>/dev/null | sed 's/.*-\(.*\)\.dump/\1/' | sort -u || echo "    (ninguno)"
    echo ""
    echo "  Filesystem snapshots:"
    ls -1d "${BACKUP_ROOT}/daily/"* 2>/dev/null | xargs -I{} basename {} || echo "    (ninguno)"
    exit 1
fi

echo "═══════════════════════════════════════════════════════════════════"
echo "  RESTAURANDO BACKUP: ${RESTORE_DATE}"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# ── 1. Restaurar PostgreSQL ────────────────────────────────────────────────

echo "1. PostgreSQL Backup:"
PG_DUMP=$(ls -1 "${BACKUP_ROOT}/postgres/daily/"*"${RESTORE_DATE}"*.dump 2>/dev/null | head -1)

if [[ -n "${PG_DUMP}" ]]; then
    echo "   Encontrado: ${PG_DUMP}"
    echo "   Restaurando..."
    sudo -u postgres dropdb automotive_os 2>/dev/null || true
    sudo -u postgres createdb automotive_os
    sudo -u postgres pg_restore -h 127.0.0.1 -p 5432 -d automotive_os "${PG_DUMP}"
    echo "   ✅ PostgreSQL restaurado"
else
    echo "   ❌ No se encontró dump para ${RESTORE_DATE}"
fi

# ── 2. Restaurar Filesystem ───────────────────────────────────────────────

echo ""
echo "2. Filesystem Snapshot:"
SNAP_DIR="${BACKUP_ROOT}/daily/${RESTORE_DATE}"

if [[ -d "${SNAP_DIR}" ]]; then
    echo "   Encontrado: ${SNAP_DIR}"
    echo "   ⚠️  Esto sobrescribirá /data/ERP_Taller_Mca/"
    read -p "   ¿Continuar? (s/N): " CONFIRM
    if [[ "${CONFIRM}" == "s" || "${CONFIRM}" == "S" ]]; then
        rsync -av --delete "${SNAP_DIR}/" /data/ERP_Taller_Mca/
        echo "   ✅ Filesystem restaurado"
    else
        echo "   Cancelado"
    fi
else
    echo "   ❌ No se encontró snapshot para ${RESTORE_DATE}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Restauración completada"
echo "═══════════════════════════════════════════════════════════════════"
