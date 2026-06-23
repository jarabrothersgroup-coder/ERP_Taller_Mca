#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat <<EOF
Uso: $0 [modo]

Modos:
  dev       Modo desarrollo (tsx watch, hot-reload) — por defecto
  prod      Modo producción (compilado, <50MB RAM, logs JSON)

Ejemplos:
  $0            # inicia en desarrollo
  $0 dev        # inicia en desarrollo
  $0 prod       # compila e inicia en producción
EOF
    exit 0
}

MODE="${1:-dev}"
if [[ "$MODE" == "--help" || "$MODE" == "-h" ]]; then usage; fi
if [[ "$MODE" != "dev" && "$MODE" != "prod" ]]; then
    err "Modo inválido: $MODE"; usage
fi

cleanup() {
    if [[ -n "${PID:-}" ]]; then
        kill "$PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# ── Node version ──────────────────────────────────────────────────────────────
info "Verificando Node.js..."
if ! command -v node &>/dev/null; then
    err "Node.js no está instalado. Requerido: >= 20"
    exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [[ "$NODE_MAJOR" -lt 20 ]]; then
    err "Node.js >= 20 requerido (versión actual: $(node -v))"
    exit 1
fi
ok "Node.js $(node -v)"

# ── .env ──────────────────────────────────────────────────────────────────────
info "Verificando .env..."
if [[ ! -f ".env" ]]; then
    warn ".env no encontrado. Copiando desde .env.example..."
    cp .env.example .env
    err "=== EDITAR .env con las credenciales reales antes de continuar ==="
    exit 1
fi
ok ".env presente"

# ── Dependencias ──────────────────────────────────────────────────────────────
if [[ ! -d "node_modules" ]]; then
    info "Instalando dependencias..."
    npm install
    ok "Dependencias instaladas"
else
    info "node_modules ya existe, omitiendo npm install"
fi

# ── Base de datos ─────────────────────────────────────────────────────────────
info "Verificando conexión a base de datos..."
if npm run db:smoke 2>&1; then
    ok "Conexión a base de datos OK"
else
    warn "Smoke test falló — intentando migrar..."
    npm run db:migrate 2>&1 || true
fi

# ── Seed demo data (optional) ────────────────────────────────────────────────
if [[ "${SEED_DEMO:-}" == "true" ]]; then
    info "Ejecutando seed de datos de demostración..."
    TENANT_SLUG="${TENANT_SLUG:-taller-el-chero}"
    bash scripts/seed-demo-all.sh "$TENANT_SLUG" 2>&1 || warn "Seed tuvo problemas (continuando...)"
    ok "Datos de demo cargados"
fi

# ── Crear tablas financieras si no existen ────────────────────────────────────
info "Verificando tablas financieras..."
DB_URL="$(grep -oP '^DATABASE_URL="\K[^"]+' .env 2>/dev/null || true)"
if [[ -n "$DB_URL" ]]; then
  timeout 10 psql "$DB_URL" -v ON_ERROR_STOP=0 -t -c "
    CREATE TABLE IF NOT EXISTS public.fixed_expenses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, month INTEGER NOT NULL, year INTEGER NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL, category TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS public.mechanic_profiles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE, category TEXT NOT NULL, base_salary INTEGER NOT NULL, commission_rate NUMERIC(5,2) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS public.staff_profiles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE, position TEXT NOT NULL, base_salary INTEGER NOT NULL, profit_sharing BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS public.commission_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, order_id UUID, mechanic_profile_id UUID NOT NULL REFERENCES public.mechanic_profiles(id) ON DELETE CASCADE, labor_amount INTEGER NOT NULL, commission_rate NUMERIC(5,2) NOT NULL, commission_amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'EN_ESPERA_DE_UMBRAL', month INTEGER NOT NULL, year INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS public.payroll_summary (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE, month INTEGER NOT NULL, year INTEGER NOT NULL, fixed_expenses_total INTEGER NOT NULL, payroll_base_total INTEGER NOT NULL, net_labor_revenue INTEGER NOT NULL, breakeven_threshold INTEGER NOT NULL, breakeven_hit BOOLEAN NOT NULL, breakeven_percentage NUMERIC(5,2) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
  " 2>/dev/null && ok "Tablas financieras ok" || warn "No se pudieron crear tablas financieras"
fi

# ── Detectar IP local ─────────────────────────────────────────────────────────
LOCAL_IP="localhost"
for ip in $(hostname -I 2>/dev/null); do
    if [[ "$ip" == 192.168.* ]]; then
        LOCAL_IP="$ip"
        break
    fi
done

# ── Frontend URLs ─────────────────────────────────────────────────────────────
PORT="${PORT:-3000}"
BASE="http://${LOCAL_IP}:${PORT}"
DASHBOARD_URL="${BASE}/dashboard"
TV_URL="${BASE}/api/v1/visual/tv"
HEALTH_URL="${BASE}/health"
BREAK_EVEN_URL="${BASE}/api/v1/finance/dashboard/break-even"

# ── Iniciar servidor ──────────────────────────────────────────────────────────
if [[ "$MODE" == "prod" ]]; then
    info "Compilando para producción..."
    npm run build 2>&1
    ok "Build completado"

    npm run start:prod &
    PID=$!
fi

if [[ "$MODE" == "dev" ]]; then
    npm run dev &
    PID=$!
fi

# ── Esperar a que el servidor responda ────────────────────────────────────────
info "Esperando que el servidor responda en ${HEALTH_URL}..."
for i in $(seq 1 15); do
    if curl -sf "${HEALTH_URL}" >/dev/null 2>&1; then
        ok "Servidor listo"
        break
    fi
    sleep 1
done

# ── Abrir dashboard en el navegador ───────────────────────────────────────────
info "Abriendo frontend en el navegador..."
if command -v xdg-open &>/dev/null; then
    xdg-open "$DASHBOARD_URL" 2>/dev/null || true
elif command -v open &>/dev/null; then
    open "$DASHBOARD_URL" 2>/dev/null || true
fi

# ── Banner final ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  AutomotiveOS Cloud ERP${NC}"
if [[ "$MODE" == "prod" ]]; then
    echo -e "${GREEN}  Modo:     ${CYAN}PRODUCCIÓN  (<50MB RAM)${NC}"
else
    echo -e "${GREEN}  Modo:     ${CYAN}DESARROLLO  (hot-reload)${NC}"
fi
echo -e "${GREEN}  Puerto:   ${CYAN}${PORT}${NC}"
echo -e "${GREEN}  PID:      ${CYAN}${PID}${NC}"
echo ""
echo -e "${GREEN}  📊 Dashboard:     ${CYAN}${DASHBOARD_URL}${NC}"
echo -e "${GREEN}  🔐 Admin:         ${CYAN}jaraju01@gmail.com / Admin01\$${NC}"
echo -e "${GREEN}  ⚖️  Break-Even:   ${CYAN}${BREAK_EVEN_URL}${NC}"
echo -e "${GREEN}  📺 Sala Espera:   ${CYAN}${TV_URL}${NC}"
echo -e "${GREEN}  ❤️  Health:        ${CYAN}${HEALTH_URL}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Nota para TVs ─────────────────────────────────────────────────────────────
if [[ "$LOCAL_IP" != "localhost" ]]; then
    info "Abrí estas URLs en las TVs del taller:"
    echo -e "     ${CYAN}${TV_URL}${NC}  (Sala de Espera / Quiosco TV)"
    echo -e "     ${CYAN}${DASHBOARD_URL}${NC}  (Dashboard Administrativo)"
fi

wait "$PID"
