#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# AutomotiveOS — Extra Domain Seed Orchestrator
#
# Runs the "extra" seed scripts that populate the remaining
# domain tables which had no seed coverage (Sprint 7+):
#   finance, inventory, workshop, purchasing, fiscal, admin, marketing, coverage
#
# Each script is idempotent (safe to re-run) and resolves foreign
# keys from the base demo data created by seed-demo-all.sh, so this
# MUST run AFTER seed-demo-all.sh.
#
# Usage:
#   ./scripts/seed-extra-all.sh <tenant_slug>
#
# Example:
#   DATABASE_URL="..." ./scripts/seed-extra-all.sh demo
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

TENANT_SLUG="${1:-demo}"

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

run_seed() {
  # $1 = step label, $2 = script basename, $3 = description
  step "$1"
  info "$3"
  if npx tsx "scripts/$2.ts" "${TENANT_SLUG}" 2>&1; then
    ok "$2 complete"
    return 0
  else
    warn "$2 had issues (see log above)"
    return 1
  fi
}

echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║  AutomotiveOS Cloud ERP — Extra Domain Seeds      ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Tenant:  ${CYAN}${TENANT_SLUG}${NC}"
echo -e "  Date:    ${CYAN}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

# Order matters: finance creates activos_fijos (needed by inventory revaluaciones).
run_seed "1/8" "seed-finance-extra"            "Finance & accounting (activos fijos, asientos, presupuestos…)"
run_seed "2/8" "seed-inventory-extra"          "Inventory (almacenes, stock movements, tools, cycle counts…)"
run_seed "3/8" "seed-workshop-extra"           "Workshop (orden_servicios, DVI, checklists, mantenimientos…)"
run_seed "4/8" "seed-purchasing-extra"         "Purchasing (proveedores, compras, purchase orders, terceros…)"
run_seed "5/8" "seed-fiscal-extra"             "Fiscal (SIFEN, liquidaciones IVA/IRE/INR/IDU/ISC, periodos…)"
run_seed "6/8" "seed-admin-extra"              "Admin / CRM / Security (api keys, audit, sso, labels…)"
run_seed "7/8" "seed-marketing-backup-extra"   "Marketing / WhatsApp / Billing / Backup / Otros…"
run_seed "8/8" "seed-coverage-extra"           "Cobertura final (fleet, loyalty, marketing, grupo, RAG…)"

echo ""
echo -e "${GREEN}  ✅  Extra domain seeds complete${NC}"
echo ""
