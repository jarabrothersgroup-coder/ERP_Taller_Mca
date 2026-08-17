#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# deploy-to-pcserver.sh — Deploy del stack containerizado a PCSERVER
# ─────────────────────────────────────────────────────────
# Despliega el stack on-premise (postgres + redis + erp + web) en PCSERVER
# vía SSH, usando el mismo docker-compose.onpremise.yml validado en local.
#
# CARACTERÍSTICAS DE SEGURIDAD:
#   - NO destructivo: nunca borra volúmenes, no down -v, no resets.
#   - Migraciones: SOLO aplica pendientes con drizzle-kit (incremental,
#     ON_ERROR_STOP). Nunca recrea la DB.
#   - Aborta si falta una variable crítica del .env remoto (sin imprimirla).
#   - NO imprime secretos ni hace push.
#
# USO:
#   scripts/deploy-to-pcserver.sh [--dry-run] [--user jarabro] [--host 100.104.144.92]
#
# REQUISITOS:
#   - SSH con llave hacia PCSERVER (BatchMode; falla limpio sin credenciales).
#   - En PCSERVER: Podman rootless, podman-compose, git, node + npm (para
#     drizzle-kit migrate) y ~/.env con las variables del stack.
# ─────────────────────────────────────────────────────────
set -euo pipefail

REMOTE_USER="${DEPLOY_USER:-jarabro}"
REMOTE_HOST="${DEPLOY_HOST:-100.104.144.92}"
REMOTE_DIR="${DEPLOY_DIR:-/home/$REMOTE_USER/Proyectos/ERP_Taller_Mca}"
COMPOSE="docker-compose.onpremise.yml"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; fi

# ── 1. Conectividad ────────────────────────────────────────
echo "=== [1/7] Conectividad SSH a $REMOTE_USER@$REMOTE_HOST ==="
if ! ssh -o BatchMode=yes -o ConnectTimeout=8 "$REMOTE_USER@$REMOTE_HOST" 'echo OK' >/dev/null 2>&1; then
  echo "[ABORT] Sin acceso SSH a PCSERVER (sin llave o host caído)." >&2
  echo "        Establecer la conexión primero (Tailscale + llave pública)." >&2
  exit 1
fi
echo "[OK] SSH disponible."

# ── 2. Estado del repo remoto ──────────────────────────────
echo "=== [2/7] Repo remoto: $REMOTE_DIR ==="
ssh "$REMOTE_USER@$REMOTE_HOST" "cd '$REMOTE_DIR' && git status --porcelain | head -5 && git log --oneline -1" || {
  echo "[ABORT] No se puede leer el repo remoto ($REMOTE_DIR)." >&2; exit 1;
}
echo "[OK] Repo accesible."

# ── 3. Variables críticas (solo nombres, nunca valores) ────
echo "=== [3/7] Variables críticas en el .env remoto ==="
REQUIRED_VARS="DATABASE_URL JWT_SECRET TOKEN_SECRET POSTGRES_PASSWORD REDIS_PASSWORD"
MISSING=$(ssh "$REMOTE_USER@$REMOTE_HOST" "cd '$REMOTE_DIR' && for v in $REQUIRED_VARS; do grep -q \"^\$v=\" .env || echo \$v; done" 2>/dev/null || true)
if [[ -n "$MISSING" ]]; then
  echo "[ABORT] Faltan variables en .env remoto: $MISSING" >&2
  exit 1
fi
echo "[OK] Variables críticas presentes (valores no mostrados)."

# ── 4. Pull ────────────────────────────────────────────────
echo "=== [4/7] git pull (ff-only) ==="
if [[ "$DRY_RUN" == "1" ]]; then
  echo "[DRY-RUN] git pull --ff-only"
else
  ssh "$REMOTE_USER@$REMOTE_HOST" "cd '$REMOTE_DIR' && git pull --ff-only" 2>&1 | tail -3
fi

# ── 5. Migraciones pendientes (incremental, no destructivo) ──
echo "=== [5/7] Migraciones drizzle pendientes ==="
if [[ "$DRY_RUN" == "1" ]]; then
  echo "[DRY-RUN] npx drizzle-kit migrate --config=drizzle.config.ts"
else
  ssh "$REMOTE_USER@$REMOTE_HOST" "cd '$REMOTE_DIR' && source ~/.nvm/nvm.sh 2>/dev/null || true; npm ci --prefer-offline --no-audit 2>&1 | tail -1; npx drizzle-kit migrate --config=drizzle.config.ts" 2>&1 | tail -8
fi

# ── 6. Build + up (preserva volúmenes) ─────────────────────
echo "=== [6/7] Build y arranque del stack ==="
if [[ "$DRY_RUN" == "1" ]]; then
  echo "[DRY-RUN] podman-compose -f $COMPOSE build && podman-compose -f $COMPOSE up -d"
else
  ssh "$REMOTE_USER@$REMOTE_HOST" "cd '$REMOTE_DIR' && podman-compose -f '$COMPOSE' build 2>&1 | tail -2 && podman-compose -f '$COMPOSE' up -d 2>&1 | tail -3" 2>&1 | tail -6
fi

# ── 7. Health checks ───────────────────────────────────────
echo "=== [7/7] Health checks ==="
if [[ "$DRY_RUN" == "1" ]]; then
  echo "[DRY-RUN] health checks (backend /health/live, web /sign-in)"
else
  ssh "$REMOTE_USER@$REMOTE_HOST" "cd '$REMOTE_DIR' && podman ps --format '{{.Names}}\t{{.Status}}' | grep erp_taller && sleep 10 && curl -s -o /dev/null -w 'backend /health/live: %{http_code}\n' http://localhost:3000/health/live && curl -s -o /dev/null -w 'web /sign-in: %{http_code}\n' http://localhost:3100/sign-in" 2>&1 | tail -8
fi

echo ""
echo "=== DEPLOY COMPLETADO ==="
echo "Si hay health checks con estado incorrecto, revisar logs:"
echo "  ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_DIR && podman-compose -f $COMPOSE logs --tail 100'"
