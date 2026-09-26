#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# deploy-local-simple.sh — Deploy ligero para pruebas rápidas
# Usa contenedores existentes del sistema (gestionirp_*)
# ─────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

usage() {
  cat << EOF
Uso: $0 <comando>

Comandos:
  status   Ver estado del backend y frontend existentes
  health   Verificar health checks
  test     Probar conexión al backend

EOF
  exit 0
}

main() {
  local command="${1:-help}"

  case "$command" in
    status)
      log_info "=== Estado del Backend (puerto 3000) ==="
      curl -s -o /dev/null -w "Backend: %{http_code}\n" http://localhost:3000/health/live || echo "Backend no disponible"
      log_info ""
      log_info "=== Estado del Frontend ==="
      curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost:3100/sign-in 2>/dev/null || echo "Frontend no disponible en 3100"
      ;;
    health)
      log_info "Verificando health checks..."
      log_info ""
      curl -s http://localhost:3000/health/live 2>&1 | head -5 || echo "Backend no responde"
      log_info ""
      log_info "PostgreSQL (gestionirp_postgres_1):"
      pg_isready -h localhost -p 5432 -U erp_user 2>&1 || echo "PG no disponible"
      log_info ""
      log_info "Redis (gestionirp_redis_1):"
      redis-cli -h localhost -p 6379 ping 2>&1 || echo "Redis no disponible"
      ;;
    test)
      log_info "Probando conexión al backend..."
      curl -s http://localhost:3000/health/live
      echo ""
      log_info "Probando API docs..."
      curl -s -o /dev/null -w "API Docs: %{http_code}\n" http://localhost:3000/documentation 2>&1 || echo "API Docs no disponible"
      ;;
    help|--help|-h|"")
      usage
      ;;
    *)
      log_error "Comando desconocido: $command"
      usage
      ;;
  esac
}

main "$@"
