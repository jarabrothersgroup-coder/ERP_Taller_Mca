#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# deploy-local-podman.sh — Deploy AutomotiveOS ERP en localhost con Podman
# ─────────────────────────────────────────────────────────
# Despliega el stack completo (PostgreSQL + Redis + ERP + Web + opcional Grafana)
# en el directorio /mnt/PROYECTOS/contenedores/erp-local/
#
# Puertos utilizados (verificados libres en este equipo):
#   - 3000:  ERP Backend (Fastify)
#   - 3100:  Web Frontend (Next.js)
#   - 4000:  ERP Backend alias (para tests E2E API)
#   - 5433:  PostgreSQL (evita conflicto con gestionirp_postgres_1 en :5432)
#   - 6380:  Redis (evita conflicto con gestionirp_redis_1 en :6379)
#   - 3300:  Grafana (opcional, perfil observability)
#
# Uso:
#   chmod +x scripts/deploy-local-podman.sh
#   ./scripts/deploy-local-podman.sh [init|start|stop|logs|status|restart]
#
# Primer deploy:
#   ./scripts/deploy-local-podman.sh init    # Crear directorios + .env
#   ./scripts/deploy-local-podman.sh start   # Levantar servicios
#
# Despliegue posterior:
#   ./scripts/deploy-local-podman.sh restart # Rebuild + reiniciar
#
# NOTA: Este script usa podman compose (no docker compose) y guarda todo en
#       /mnt/PROYECTOS/contenedores/erp-local/ para aislamiento del proyecto.
# ─────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuración ────────────────────────────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER_BASE="/mnt/PROYECTOS/contenedores/erp-local"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.local.yml"
ENV_FILE="$CONTAINER_BASE/.env"

# Colores para salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Función de ayuda ─────────────────────────────────────
usage() {
  cat << EOF
Uso: $0 <comando>

Comandos:
  init     Crear directorio $CONTAINER_BASE y archivo .env
  start    Levantar todos los servicios (PostgreSQL, Redis, ERP, Web)
  stop     Detener y remover todos los contenedores
  restart  Reconstruir imágenes y reiniciar servicios
  logs     Ver logs en tiempo real (todos los servicios)
  status   Mostrar estado de los contenedores
  clean    Eliminar contenedores, volúmenes y imágenes locales

Ejemplos:
  $0 init     # Primera configuración
  $0 start    # Arrancar el sistema
  $0 logs     # Ver logs
  $0 stop     # Detener todo

EOF
  exit 0
}

# ── Verificar que podman está disponible ─────────────────
verify_podman() {
  if ! command -v podman &> /dev/null; then
    log_error "Podman no está instalado. Instalar con: sudo pacman -S podman podman-compose"
    exit 1
  fi
  log_info "Podman detectado: $(podman --version)"
}

# ── Verificar puertos libres ─────────────────────────────
verify_ports() {
  log_info "Verificando puertos disponibles..."

  # Puertos requeridos (actualizados para evitar conflictos con servicios existentes)
  # Puerto 3000 already in use by existing backend → using 3200 for new ERP
  local required_ports=(5435 6381 3200 3300 4000 3400)
  local conflicts=()

  for port in "${required_ports[@]}"; do
    if ss -tlnp | grep -q ":$port "; then
      conflicts+=("$port")
    fi
  done

  if [ ${#conflicts[@]} -gt 0 ]; then
    log_warn "Los siguientes puertos están en uso: ${conflicts[*]}"
    log_warn "Ajustar los puertos en $ENV_FILE antes de continuar"
    return 1
  fi

  log_info "Todos los puertos requeridos están libres: ${required_ports[*]}"
  return 0
}

# ── Crear directorio y .env ──────────────────────────────
setup_environment() {
  log_info "Configurando entorno en $CONTAINER_BASE..."

  mkdir -p "$CONTAINER_BASE"
  cd "$CONTAINER_BASE"

  if [ ! -f "$ENV_FILE" ]; then
    log_info "Creando .env desde plantilla..."
    cat > "$ENV_FILE" << 'ENVEOF'
# ─────────────────────────────────────────────────────────
# AutomotiveOS ERP — Variables de entorno para deploy local
# ─────────────────────────────────────────────────────────
# Editar este archivo antes de ejecutar el deploy

# ── PostgreSQL ───────────────────────────────────────────
POSTGRES_USER=erp_user
POSTGRES_PASSWORD=erp_local_password_change_me
POSTGRES_DB=automotive_os
POSTGRES_PORT=5433

# ── Redis ────────────────────────────────────────────────
REDIS_PASSWORD=erp_redis_password_change_me
REDIS_PORT=6380

# ── ERP Backend ──────────────────────────────────────────
JWT_SECRET=change-me-to-32-char-minimum-secret-key-here
TOKEN_SECRET=change-me-to-32-char-minimum-token-secret-here
TENANT_SCHEMA_PREFIX=tenant_
LOG_LEVEL=info
APP_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3100

# ── Storage ──────────────────────────────────────────────
STORAGE_PATH=/mnt/PROYECTOS/contenedores/erp-local/data/storage

# ── Opcional: WhatsApp / Evolution API ───────────────────
# WHATSAPP_API_URL=http://localhost:8080
# WHATSAPP_API_KEY=

# ── Opcional: Grafana (perfil observability) ─────────────
# PG_GRAFANA_PASSWORD=
# PG_DATASOURCE_URL=postgres:5432
# GRAFANA_ADMIN_PASSWORD=
# ALERT_WEBHOOK_URL=http://127.0.0.1:9999/grafana-webhook

ENVEOF
    log_info "Archivo .env creado. EDitar $ENV_FILE para configurar contraseñas."
  else
    log_warn ".env ya existe en $ENV_FILE"
  fi

  # Crear directorios de datos
  mkdir -p "$CONTAINER_BASE/data/storage"
  mkdir -p "$CONTAINER_BASE/data/postgres"
  mkdir -p "$CONTAINER_BASE/data/redis"
  mkdir -p "$CONTAINER_BASE/data/grafana"

  log_info "Directorios creados."
}

# ── Crear docker-compose.local.yml ───────────────────────
create_compose_file() {
  log_info "Creando docker-compose.local.yml..."

  cat > "$PROJECT_ROOT/docker-compose.local.yml" << 'COMPOSEEOF'
# ─────────────────────────────────────────────────────────
# AutomotiveOS Cloud ERP — Docker Compose (Local / Podman)
# ─────────────────────────────────────────────────────────
# Archivo generado por deploy-local-podman.sh
# Editar puertos y paths según necesidad
# ─────────────────────────────────────────────────────────

services:
  postgres:
    image: docker.io/pgvector/pgvector:pg16
    container_name: erp-local_postgres
    restart: unless-stopped
    ports:
      - "${POSTGRES_PORT:-5433}:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-automotive_os}
      POSTGRES_USER: ${POSTGRES_USER:-erp_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-erp_local_password}
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.5"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-erp_user} -d ${POSTGRES_DB:-automotive_os}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - erp-local-network

  redis:
    image: redis:7-alpine
    container_name: erp-local_redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6380}:6379"
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD:-erp_redis_password}
      --maxmemory 64mb
      --maxmemory-policy allkeys-lru
      --save 60 1000
      --appendonly yes
    deploy:
      resources:
        limits:
          memory: 64M
          cpus: "0.25"
    volumes:
      - ./data/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-erp_redis_password}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - erp-local-network

  erp:
    build:
      context: ${PROJECT_ROOT:-/mnt/PROYECTOS/repos/ERP_Taller_Mca}
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
    image: automotiveos/erp-backend:local
    container_name: erp-local_erp
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "4000:3000"
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.75"
    environment:
      NODE_ENV: production
      PORT: 3000
      HOST: "0.0.0.0"
      DATABASE_URL: postgresql://${POSTGRES_USER:-erp_user}:${POSTGRES_PASSWORD:-erp_local_password}@postgres:5432/${POSTGRES_DB:-automotive_os}?sslmode=disable
      STORAGE_PATH: /data/erp-storage
      JWT_SECRET: ${JWT_SECRET:-change-me}
      TOKEN_SECRET: ${TOKEN_SECRET:-change-me}
      TENANT_SCHEMA_PREFIX: ${TENANT_SCHEMA_PREFIX:-tenant_}
      LOG_LEVEL: ${LOG_LEVEL:-info}
      APP_URL: ${APP_URL:-http://localhost:3000}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3100}
      ENABLE_REQUEST_TENANT_CONTEXT: "true"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/health/live"]
      interval: 30s
      timeout: 5s
      retries: 3
    volumes:
      - ./data/storage:/data/erp-storage
      - ./data/config:/app/config
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - erp-local-network

  web:
    build:
      context: ${PROJECT_ROOT:-/mnt/PROYECTOS/repos/ERP_Taller_Mca}/web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_BACKEND_URL: http://localhost:3000
    image: automotiveos/erp-web:local
    container_name: erp-local_web
    restart: unless-stopped
    ports:
      - "3100:3000"
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.75"
    environment:
      NODE_ENV: production
      PORT: 3000
      BACKEND_HOST: erp
      BACKEND_PORT: "3000"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/sign-in"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    depends_on:
      erp:
        condition: service_healthy
    networks:
      - erp-local-network

  grafana:
    image: docker.io/grafana/grafana:11.4.0
    container_name: erp-local_grafana
    restart: unless-stopped
    ports:
      - "${GRAFANA_PORT:-3300}:3000"
    deploy:
      resources:
        limits:
          memory: 192M
          cpus: "0.25"
    environment:
      PG_GRAFANA_PASSWORD: ${PG_GRAFANA_PASSWORD:-}
      PG_DATASOURCE_URL: postgres:5432
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-erp_grafana_admin}
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: "Viewer"
      ALERT_WEBHOOK_URL: ${ALERT_WEBHOOK_URL:-http://127.0.0.1:9999/grafana-webhook}
    volumes:
      - ./data/grafana:/var/lib/grafana
      - ${PROJECT_ROOT:-/mnt/PROYECTOS/repos/ERP_Taller_Mca}/deploy/grafana/provisioning:/etc/grafana/provisioning:ro
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - erp-local-network
    profiles:
      - observability

volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/postgres
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/redis
  erp_storage:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/storage

networks:
  erp-local-network:
    driver: bridge
COMPOSEEOF

  log_info "docker-compose.local.yml creado en $PROJECT_ROOT"
}

# ── Levantar servicios ────────────────────────────────────
start_services() {
  log_info "Levantando servicios en $CONTAINER_BASE..."

  cd "$CONTAINER_BASE"

  # Leer variables del .env
  if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
  fi

  # Verificar que el compose file existe
  if [ ! -f "$PROJECT_ROOT/docker-compose.local.yml" ]; then
    log_error "docker-compose.local.yml no existe. Ejecutar '$0 init' primero."
    exit 1
  fi

  # Levantar servicios
  log_info "Ejecutando podman-compose up -d..."  cd "$PROJECT_ROOT"  podman-compose -f docker-compose.local.yml up -d

  log_info ""
  log_info "═══════════════════════════════════════════════════════"
  log_info "  AutomotiveOS ERP — Deploy Local Completado"
  log_info "═══════════════════════════════════════════════════════"
  log_info ""
  log_info "Servicios:"
  log_info "  PostgreSQL:  localhost:${POSTGRES_PORT:-5433}"
  log_info "  Redis:       localhost:${REDIS_PORT:-6380}"
  log_info "  ERP Backend: localhost:3000 (alias: 4000)"
  log_info "  Web Frontend: localhost:3100"
  log_info "  Grafana:     localhost:${GRAFANA_PORT:-3300} (perfil observability)"
  log_info ""
  log_info "URLs:"
  log_info "  Dashboard:   http://localhost:3100/dashboard"
  log_info "  Sign In:     http://localhost:3100/sign-in"
  log_info "  API Health:  http://localhost:3000/health/live"
  log_info "  API Docs:    http://localhost:3000/documentation"
  log_info ""
  log_info "Comandos útiles:"
  log_info "  $0 logs      — Ver logs en tiempo real"
  log_info "  $0 status    — Ver estado de contenedores"
  log_info "  $0 stop      — Detener todos los servicios"
  log_info "  $0 restart   — Reconstruir e reiniciar"
  log_info ""
}

# ── Detener servicios ─────────────────────────────────────
stop_services() {
  log_info "Deteniendo servicios..."  cd "$PROJECT_ROOT"
podman-compose -f docker-compose.local.yml down

  log_info "Servicios detenidos."
}

# ── Ver logs ──────────────────────────────────────────────
show_logs() {  cd "$PROJECT_ROOT"
podman-compose -f docker-compose.local.yml logs -f --tail=100
}

# ── Ver estado ────────────────────────────────────────────
show_status() {  cd "$PROJECT_ROOT"
podman-compose -f docker-compose.local.yml ps
}

# ── Rebuild y reiniciar ───────────────────────────────────
restart_services() {
  log_info "Reconstruyendo imágenes..."  cd "$PROJECT_ROOT"
podman-compose -f docker-compose.local.yml build --no-cache

  log_info "Reiniciando servicios..."
  podman-compose -f docker-compose.local.yml up -d

  log_info "Esperando servicios saludables..."
  sleep 15

  show_status
}

# ── Limpiar todo ──────────────────────────────────────────
clean_all() {
  log_warn "¡ESTO ELIMINARÁ TODOS LOS CONTENEDORES, VOLÚMENES Y IMÁGENES LOCALES!"

  read -p "¿Continuar? (s/n): " confirm
  if [ "$confirm" != "s" ] && [ "$confirm" != "S" ]; then
    log_info "Operación cancelada."
    exit 0
  fi

  cd "$PROJECT_ROOT"
  podman-compose -f docker-compose.local.yml down -v --rmi local

  log_info "Limpieza completada."
}

# ── Main ──────────────────────────────────────────────────
main() {
  verify_podman

  local command="${1:-help}"

  case "$command" in
    init)
      setup_environment
      create_compose_file
      log_info ""
      log_info "✅ Configuración completada."
      log_info "Editar $ENV_FILE y ejecutar: $0 start"
      ;;
    start)
      setup_environment  # Asegurar que existe el .env
      verify_ports || exit 1
      start_services
      ;;
    stop)
      stop_services
      ;;
    restart)
      restart_services
      ;;
    logs)
      show_logs
      ;;
    status)
      show_status
      ;;
    clean)
      clean_all
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
