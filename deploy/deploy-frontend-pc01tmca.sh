#!/usr/bin/env bash
set -e

# ── Source nvm/path for non-interactive shells ──
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 2>/dev/null || true

cd /home/jarabro/Proyectos/ERP_Taller_Mca

echo "=== GIT PULL ==="
git pull --rebase --autostash 2>&1 || git pull --ff-only 2>&1

echo "=== NPM INSTALL ==="
cd web && npm install --prefer-offline --no-audit --progress=false | tail -3

echo "=== BUILD ==="
export NODE_ENV=production
npx next build 2>&1 | tail -8

echo "=== STOP OLD ==="
systemctl --user stop erp-frontend.service 2>/dev/null || pkill -f "next.*server" 2>/dev/null || echo "no_old_server"
sleep 2

echo "=== START PRODUCTION ==="
export NODE_ENV=production
cd /home/jarabro/Proyectos/ERP_Taller_Mca/web
nohup ./node_modules/.bin/next start -p 3000 > /tmp/frontend-prod.log 2>&1 &
FPID=$!
echo "PID: $FPID"

sleep 8

echo "=== VERIFY ==="
curl -s -o /dev/null -w "HTTP /sign-in: %{http_code}\\n" http://localhost:3000/sign-in
curl -s -o /dev/null -w "HTTP /dashboard: %{http_code}\\n" http://localhost:3000/dashboard

echo "=== DONE ==="
