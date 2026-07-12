#!/usr/bin/env bash
# provision-i3.sh — Provisioning de un servidor on-prem ERP Taller MCA
# Objetivo: PC nuevo (p.ej. Intel i3 / 8 GB RAM) como servidor taller.
# Idempotente y seguro. NO debe romper una instalación existente.
#
# Uso:
#   sudo ./scripts/provision-i3.sh [--restore <dump.custom>] [--no-ldap] [--db-url <url>] [--help]
#
# Notas:
#   - El backend (Fastify+PG) corre on-prem. El web Next.js se despliega en la
#     nube (Vercel/Railway); en on-prem solo se sirve la SPA de /dashboard.
#   - Requiere conexión a internet la primera vez (instalar paquetes + npm).
set -euo pipefail

REPO_DIR="/data/ERP_Taller_Mca"
STORAGE_DIR="/data/erp-storage"
BACKUP_DIR="/data/backups"
FRONTEND_DIR="/data/erp-frontend"
DB_NAME="automotive_os"
DB_USER="erp_user"
RESTORE_FILE=""
NO_LDAP=0
DB_URL="${DATABASE_URL:-}"

log()  { echo -e "\033[1;32m[provision]\033[0m $*"; }
warn() { echo -e "\033[1;33m[provision]\033[0m $*" >&2; }
die()  { echo -e "\033[1;31m[provision][ERROR]\033[0m $*" >&2; exit 1; }

usage() { grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --restore) RESTORE_FILE="$2"; shift 2;;
    --no-ldap) NO_LDAP=1; shift;;
    --db-url)  DB_URL="$2"; shift 2;;
    --help|-h) usage;;
    *) die "Argumento desconocido: $1";;
  esac
done

[[ $EUID -eq 0 ]] || die "Ejecutá este script como root (sudo)."

# ─── 1. Detectar distro e instalar paquetes ───────────────────────────────
if command -v dnf >/dev/null 2>&1; then
  PKG="dnf"; INSTALL="dnf install -y"
elif command -v apt-get >/dev/null 2>&1; then
  PKG="apt"; INSTALL="apt-get install -y"
else
  die "Gestor de paquetes no soportado (usá Fedora o Debian/Ubuntu)."
fi
log "Distro detectada: $PKG"

$INSTALL nodejs postgresql-server postgresql postgresql-contrib nginx git || true
# pgvector (mejor-esfuerzo)
if [[ "$PKG" == "dnf" ]]; then
  $INSTALL pgvector || warn "pgvector no disponible vía dnf; instalalo manualmente."
else
  $INSTALL postgresql-16-pgvector || warn "pgvector no disponible; instalalo manualmente."
fi

if [[ "$NO_LDAP" -eq 0 ]]; then
  $INSTALL 389-ds-base sssd || warn "389-ds/sssd no instalados (quedan deshabilitados)."
fi

# ─── 2. PostgreSQL ─────────────────────────────────────────────────────────
if [[ "$PKG" == "dnf" ]]; then
  postgresql-setup --initdb || true
  systemctl enable --now postgresql
else
  systemctl enable --now postgresql
fi

# Contraseña de BD (generada o del entorno)
if [[ -z "${ERP_DB_PASSWORD:-}" ]]; then
  ERP_DB_PASSWORD="$(openssl rand -hex 16)"
  warn "Generada DB password: $ERP_DB_PASSWORD  (guardala en .env)"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$ERP_DB_PASSWORD';
  END IF;
END
\$\$;
SQL
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;" || true

# ─── 3. Repo + dependencias ────────────────────────────────────────────────
mkdir -p "$REPO_DIR" "$STORAGE_DIR" "$BACKUP_DIR" "$FRONTEND_DIR"
if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone https://github.com/tu-org/ERP_Taller_Mca.git "$REPO_DIR" || die "No pude clonar el repo."
else
  git -C "$REPO_DIR" pull --ff-only || true
fi
cd "$REPO_DIR"
# Usuario de sistema que corre el backend (no root)
id -u erp >/dev/null 2>&1 || useradd -r -m -s /usr/sbin/nologin erp
chown -R erp:erp "$REPO_DIR"
npm ci || npm install
chown -R erp:erp "$REPO_DIR"

# ─── 4. .env ───────────────────────────────────────────────────────────────
if [[ ! -f "$REPO_DIR/.env" ]]; then
  cp .env.example .env
  warn "Creé .env desde .env.example — EDITÁ los secretos (JWT_SECRET, SIFEN_*, etc.)"
fi
if [[ -n "$DB_URL" ]]; then
  grep -q '^DATABASE_URL=' .env && sed -i "s#^DATABASE_URL=.*#DATABASE_URL=\"$DB_URL\"#" .env \
    || echo "DATABASE_URL=\"$DB_URL\"" >> .env
fi
# Inyectar la password generada si usamos la URL por defecto
grep -q '^DATABASE_URL="postgresql://erp_user:erp_dev_password' .env \
  && sed -i "s#erp_dev_password#$ERP_DB_PASSWORD#" .env || true

# ─── 5. Migraciones + RLS ──────────────────────────────────────────────────
npm run db:migrate
sudo -u postgres psql -d "$DB_NAME" -f scripts/apply-rls.sql

# ─── 6. Restaurar dump (opcional) ──────────────────────────────────────────
if [[ -n "$RESTORE_FILE" ]]; then
  log "Restaurando dump: $RESTORE_FILE"
  sudo -u postgres pg_restore -c -d "$DB_NAME" "$RESTORE_FILE" || warn "pg_restore reportó errores (revisá)."
fi

# ─── 7. systemd: backend ───────────────────────────────────────────────────
cp scripts/erp-taller.service /etc/systemd/system/erp-taller.service
systemctl daemon-reload
systemctl enable --now erp-taller.service

# ─── 8. nginx + TLS ────────────────────────────────────────────────────────
cp scripts/erp-taller.nginx.conf /etc/nginx/conf.d/erp-taller.conf
bash scripts/setup-tls.sh
nginx -t && systemctl enable --now nginx

# ─── 9. Backup + healthcheck timers ────────────────────────────────────────
for u in erp-backup.service erp-backup.timer erp-healthcheck.service erp-healthcheck.timer; do
  cp "scripts/$u" /etc/systemd/system/
done
systemctl daemon-reload
systemctl enable --now erp-backup.timer erp-healthcheck.timer

# ─── 10. LDAP (opcional) ───────────────────────────────────────────────────
if [[ "$NO_LDAP" -eq 1 ]]; then
  systemctl disable --now "dirsrv@*" sssd 2>/dev/null || true
  log "LDAP/SSSD deshabilitado (--no-ldap)."
fi

# ─── Resumen ───────────────────────────────────────────────────────────────
log "============================================================"
log "Provisioning completado."
log "  Backend : systemctl status erp-taller   (http://localhost:3000/health)"
log "  SPA     : http://localhost:3000/dashboard"
log "  nginx   : https://localhost  (cert self-signed por defecto)"
log "  Backups : $BACKUP_DIR  (timer diario 03:00)"
log "Pasos manuales restantes:"
log "  1) Editar .env: JWT_SECRET fuerte, SIFEN_CERT_PATH/PASS, Clerk/Stripe."
log "  2) Instalar certificado SIFEN real (/etc/sifen/cert.p12) y homologar."
log "  3) Reemplazar el cert TLS self-signed por uno real (CA interna/Let's Encrypt)."
log "  4) Conectar Ethernet cableado (no solo WiFi) y verificar Tailscale."
log "  DB password generada: $ERP_DB_PASSWORD"
log "============================================================"
