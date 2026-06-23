#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# AutomotiveOS — Master Demo Seed Script
#
# Runs all seed scripts in sequence to populate a realistic demo
# database for the "Conejo de Indias" first client deployment.
#
# Usage:
#   ./scripts/seed-demo-all.sh <tenant_slug> [tenant_name]
#
# Example:
#   ./scripts/seed-demo-all.sh taller-el-chero "Taller El Chero"
#
# Requirements:
#   - DATABASE_URL configured in .env
#   - npx tsx available (devDependency)
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

TENANT_SLUG="${1:-taller-el-chero}"
TENANT_NAME="${2:-$TENANT_SLUG}"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }
step()  { echo -e "\n${BOLD}━━━ Step $1 ━━━${NC}"; }

echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║  AutomotiveOS Cloud ERP — Demo Seed Orchestrator ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Tenant:  ${CYAN}${TENANT_NAME}${NC} (${TENANT_SLUG})"
echo -e "  Date:    ${CYAN}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

START_TIME=$(date +%s)

# ── Step 1: Register Tenant ────────────────────────────────────
step "1/9"
info "Registering tenant: ${TENANT_SLUG}..."
if npx tsx scripts/seed-tenant.ts "${TENANT_SLUG}" "${TENANT_NAME}" 2>&1; then
  ok "Tenant registered"
else
  err "Failed to register tenant"
  exit 1
fi

# ── Step 2: Vehicle Master Data ────────────────────────────────
step "2/9"
info "Seeding vehicle master data (15 brands, 55+ models)..."
if npx tsx scripts/seed-vehicles.ts 2>&1; then
  ok "Vehicle master data loaded"
else
  warn "Vehicle seeding had issues (may already exist)"
fi

# ── Step 3: Service Catalog ────────────────────────────────────
step "3/9"
info "Seeding base service catalog (14 services, 8 categories)..."
if npx tsx scripts/seed-services.ts "${TENANT_SLUG}" 2>&1; then
  ok "Base services loaded"
else
  warn "Base service seeding had issues"
fi

# ── Step 4: Extended Services ──────────────────────────────────
step "4/9"
info "Seeding extended services (45+ services, 12 categories)..."
if npx tsx scripts/seed-services-extended.ts "${TENANT_SLUG}" 2>&1; then
  ok "Extended services loaded"
else
  warn "Extended service seeding had issues"
fi

# ── Step 5: Excel Catalog (40 services from Docs/) ────────────
step "5/9"
info "Seeding Excel catalog (40 services, 14 categories, EV/HEV/H2/ADAS)..."
if npx tsx scripts/seed-services-excel.ts "${TENANT_SLUG}" 2>&1; then
  ok "Excel catalog loaded"
else
  warn "Excel catalog seeding had issues"
fi

# ── Step 6: 50 Clients ────────────────────────────────
step "6/9"
info "Seeding 50 realistic Paraguayan clients..."
if npx tsx scripts/seed-clients.ts "${TENANT_SLUG}" 2>&1; then
  ok "Clients loaded"
else
  warn "Client seeding had issues"
fi

# ── Step 7: Parts Catalog (15 brands) ──────────────────────────
step "7/9"
info "Seeding parts catalog (80+ parts, 15 brands)..."
if npx tsx scripts/seed-parts-catalog.ts 2>&1; then
  ok "Parts catalog loaded"
else
  warn "Parts catalog seeding had issues"
fi

# ── Step 8: Tools & Equipment ──────────────────────────────────
step "8/9"
info "Seeding workshop tools & equipment (45+ items)..."
if npx tsx scripts/seed-tools-equipment.ts 2>&1; then
  ok "Tools & equipment loaded"
else
  warn "Tools seeding had issues"
fi

# ── Step 9: Vehicles + Work Orders ─────────────────────────────
step "9/9"
info "Seeding vehicles + work orders (20 vehicles, 23 OTs)..."
if npx tsx scripts/seed-work-orders.ts "${TENANT_SLUG}" 2>&1; then
  ok "Vehicles & work orders loaded"
else
  warn "Work order seeding had issues"
fi

# ── Treasury (optional) ────────────────────────────────────────
info "Seeding treasury data..."
if npx tsx scripts/seed-treasury.ts "${TENANT_SLUG}" 2>&1; then
  ok "Treasury data loaded"
else
  warn "Treasury seeding had issues"
fi

# ── Accounting (optional) ──────────────────────────────────────
info "Seeding Plan de Cuentas..."
if npx tsx scripts/seed-accounting.ts "${TENANT_SLUG}" 2>&1; then
  ok "Plan de Cuentas loaded"
else
  warn "Accounting seeding had issues"
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅  Demo Seed Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  📊 ${BOLD}Summary:${NC}"
echo -e "     Tenant:        ${CYAN}${TENANT_NAME}${NC}"
echo -e "     Clients:       ${CYAN}50${NC}"
echo -e "     Vehicles:      ${CYAN}20${NC}"
echo -e "     Work Orders:   ${CYAN}23${NC}"
echo -e "     Services:      ${CYAN}99+${NC} (8 → 22 categories, incl. EV/HEV/H2/ADAS)"
echo -e "     Parts:         ${CYAN}80+${NC} (15 brands)"
echo -e "     Tools:         ${CYAN}45+${NC} (6 categories)"
echo -e "     Time:          ${CYAN}${ELAPSED}s${NC}"
echo ""
echo -e "  🔐 ${BOLD}Admin Login:${NC}"
echo -e "     Email:    ${CYAN}jaraju01@gmail.com${NC}"
echo -e "     Password: ${CYAN}Admin01\$${NC}"
echo ""
echo -e "  🚀 ${BOLD}Next Steps:${NC}"
echo -e "     1. Run: ${CYAN}./start.sh${NC}"
echo -e "     2. Open: ${CYAN}http://localhost:3000${NC}"
echo -e "     3. Login and explore the demo data!"
echo ""
