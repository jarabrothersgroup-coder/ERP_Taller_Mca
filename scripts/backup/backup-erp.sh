#!/bin/bash
#=============================================================================
# backup-erp.sh — ERP Taller MCA Backup Script
#
# Estrategia: pg_dump + rsync --link-dest (hardlink incrementals)
# Frecuencia: L/M/V (incremental) + Día 1 (mensual full)
# Retención:  7 días incrementales, 12 meses mensuales
#=============================================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
BACKUP_ROOT="/data/backups"
DAILY_DIR="${BACKUP_ROOT}/daily"
MONTHLY_DIR="${BACKUP_ROOT}/monthly"
PG_DIR="${BACKUP_ROOT}/postgres"
LOG_DIR="${BACKUP_ROOT}/logs"
ERP_DIR="/data/ERP_Taller_Mca"
PG_DATABASE="automotive_os"
PG_USER="postgres"
PG_HOST="127.0.0.1"
PG_PORT="5432"
LDAP_CONFIG="/etc/dirsrv/slapd-erp-taller"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H%M%S)
DAY_OF_MONTH=$(date +%d)
DAY_OF_WEEK=$(date +%u)  # 1=Mon, 7=Sun

# ── Funciones ───────────────────────────────────────────────────────────────

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_file="${LOG_DIR}/backup-${DATE}-${TIME}.log"
mkdir -p "${LOG_DIR}"

exec > >(tee -a "${log_file}") 2>&1

cleanup_logs() {
    # Keep logs for 30 days
    find "${LOG_DIR}" -name "backup-*.log" -mtime +30 -delete 2>/dev/null || true
}

# ── 1. PostgreSQL Backup ────────────────────────────────────────────────────

backup_postgres() {
    log "═══ PostgreSQL Backup ═══"
    local pg_subdir="${PG_DIR}/daily"
    local pg_monthly="${PG_DIR}/monthly"
    mkdir -p "${pg_subdir}" "${pg_monthly}"

    local dump_file="${pg_subdir}/${PG_DATABASE}-${DATE}-${TIME}.dump"

    log "Dumping ${PG_DATABASE} → ${dump_file}"
    # Use local socket (no -h) for peer auth as postgres user
    sudo -u "${PG_USER}" pg_dump \
        -Fc \
        -Z6 \
        -f "${dump_file}" \
        "${PG_DATABASE}"

    local dump_size
    dump_size=$(du -sh "${dump_file}" | cut -f1)
    log "PostgreSQL dump completado: ${dump_size}"

    # Monthly full backup
    if [[ "${DAY_OF_MONTH}" == "01" ]]; then
        local monthly_file="${pg_monthly}/${PG_DATABASE}-${DATE}-full.dump"
        log "Backup mensual PostgreSQL → ${monthly_file}"
        cp "${dump_file}" "${monthly_file}"
    fi

    # Rotate: keep last 7 daily dumps
    find "${pg_subdir}" -name "${PG_DATABASE}-*.dump" -mtime +7 -delete 2>/dev/null || true
    log "Rotación PostgreSQL: eliminados dumps >7 días"
}

# ── 2. Filesystem Backup (rsync --link-dest) ───────────────────────────────

backup_filesystem() {
    log "═══ Filesystem Backup (rsync hardlink) ═══"
    local snapshot_dir="${DAILY_DIR}/${DATE}"
    local latest_link="${DAILY_DIR}/latest"

    mkdir -p "${DAILY_DIR}"

    # Find the most recent previous snapshot for hardlinking
    local link_dest=""
    if [[ -d "${latest_link}" ]]; then
        link_dest="${latest_link}"
        log "Usando hardlink desde: $(readlink -f "${latest_link}" 2>/dev/null || echo "${latest_link}")"
    fi

    # Rsync ERP directory (exclude node_modules, .git, dist for space)
    log "Sincronizando ERP source..."
    local rsync_cmd=(rsync -a --delete --stats --human-readable)

    if [[ -n "${link_dest}" && -d "${link_dest}" ]]; then
        rsync_cmd+=(--link-dest="${link_dest}")
    fi

    rsync_cmd+=(--exclude='node_modules/' --exclude='.git/' --exclude='dist/' --exclude='*.log' --exclude='tmp/' --exclude='.agents/')
    rsync_cmd+=("${ERP_DIR}/" "${snapshot_dir}/")

    "${rsync_cmd[@]}"

    # Update latest symlink
    rm -f "${latest_link}"
    ln -s "${snapshot_dir}" "${latest_link}"

    local snap_size
    snap_size=$(du -sh "${snapshot_dir}" | cut -f1)
    log "Filesystem snapshot completado: ${snap_size}"

    # Rotate: keep last 7 daily snapshots
    log "Rotación filesystem: verificando snapshots >7 días..."
    find "${DAILY_DIR}" -maxdepth 1 -type d -name "20*" -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
    log "Rotación filesystem completada"
}

# ── 3. Config & LDAP Backup ────────────────────────────────────────────────

backup_config() {
    log "═══ Config & LDAP Backup ═══"
    local config_dir="${DAILY_DIR}/${DATE}/_config"
    mkdir -p "${config_dir}"

    # .env file
    if [[ -f "${ERP_DIR}/.env" ]]; then
        cp "${ERP_DIR}/.env" "${config_dir}/env-backup"
        log ".env backup saved"
    fi

    # 389 DS config (needs root access to read)
    if [[ -d "${LDAP_CONFIG}" ]]; then
        sudo tar czf "${config_dir}/389ds-config-${DATE}.tar.gz" \
            -C /etc/dirsrv "slapd-erp-taller/" 2>/dev/null || true
        log "389 DS config backup saved"
    fi

    # Nginx config
    if [[ -f /etc/nginx/nginx.conf ]]; then
        cp /etc/nginx/nginx.conf "${config_dir}/nginx.conf"
        log "Nginx config backup saved"
    fi

    # Systemd services
    cp /etc/systemd/system/erp-taller.service "${config_dir}/" 2>/dev/null || true
    log "Systemd service backup saved"

    # Package list
    rpm -qa | sort > "${config_dir}/installed-packages.txt" 2>/dev/null || true
    log "Package list saved"
}

# ── 4. Monthly Full Archive ────────────────────────────────────────────────

backup_monthly_full() {
    if [[ "${DAY_OF_MONTH}" != "01" ]]; then
        return 0
    fi

    log "═══ Monthly Full Archive ═══"
    mkdir -p "${MONTHLY_DIR}"

    local archive="${MONTHLY_DIR}/erp-full-${DATE}.tar.gz"
    local pg_archive="${MONTHLY_DIR}/postgres-full-${DATE}.dump"

    # Full filesystem tar (including node_modules this time)
    log "Creando archive mensual completo..."
    tar czf "${archive}" \
        --exclude='.git' \
        --exclude='*.log' \
        --exclude='tmp/' \
        -C /data \
        "ERP_Taller_Mca/"

    local archive_size
    archive_size=$(du -sh "${archive}" | cut -f1)
    log "Monthly archive: ${archive_size}"

    # Full PostgreSQL dump
    local pg_monthly="${PG_DIR}/monthly"
    mkdir -p "${pg_monthly}"
    sudo -u "${PG_USER}" pg_dump \
        -Fc -Z6 \
        -f "${pg_archive}" \
        "${PG_DATABASE}"

    # Rotate: keep last 12 monthly archives
    log "Rotación mensual: eliminando archives >12 meses..."
    find "${MONTHLY_DIR}" -name "erp-full-*.tar.gz" -mtime +365 -delete 2>/dev/null || true
    find "${PG_DIR}/monthly" -name "postgres-full-*.dump" -mtime +365 -delete 2>/dev/null || true
    log "Rotación mensual completada"
}

# ── 5. Resumen ──────────────────────────────────────────────────────────────

print_summary() {
    log ""
    log "═══════════════════════════════════════════════════════════════════"
    log "  BACKUP COMPLETADO — ${DATE} ${TIME}"
    log "═══════════════════════════════════════════════════════════════════"

    log ""
    log "  📂 Estructura de backups:"
    log "     PostgreSQL dumps: $(du -sh "${PG_DIR}" 2>/dev/null | cut -f1)"
    log "     Daily snapshots:  $(du -sh "${DAILY_DIR}" 2>/dev/null | cut -f1)"
    log "     Monthly archives: $(du -sh "${MONTHLY_DIR}" 2>/dev/null | cut -f1)"
    log "     Logs:             $(du -sh "${LOG_DIR}" 2>/dev/null | cut -f1)"
    log ""
    log "  📊 Espacio total en /data/backups:"
    du -sh "${BACKUP_ROOT}" 2>/dev/null | awk '{print "     " $1}'
    log ""
    log "  💾 Espacio libre en /data:"
    df -h /data | awk 'NR==2 {print "     " $4 " disponible"}'
    log ""
    log "═══════════════════════════════════════════════════════════════════"
}

# ── Main ────────────────────────────────────────────────────────────────────

main() {
    log "═══ ERP Taller MCA — Backup Iniciado ═══"
    log "Fecha: ${DATE} | Día semana: ${DAY_OF_WEEK} | Día mes: ${DAY_OF_MONTH}"
    log ""

    backup_postgres
    backup_filesystem
    backup_config
    backup_monthly_full

    cleanup_logs
    print_summary

    log "═══ Backup Finalizado ═══"
}

main "$@"
