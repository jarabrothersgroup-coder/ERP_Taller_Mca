#!/bin/bash
# ─────────────────────────────────────────────────────────
# AutomotiveOS — Frontend Deployment Script (PC01Tmca)
# ─────────────────────────────────────────────────────────
# Run this on the Fedora server to deploy the Next.js frontend.
#
# Usage:
#   chmod +x deploy-frontend.sh
#   ./deploy-frontend.sh
# ─────────────────────────────────────────────────────────

set -euo pipefail

FRONTEND_DIR="/opt/automotiveos/web"
BACKEND_URL="http://192.168.18.104:3000"
FRONTEND_PORT=3001

echo "=== AutomotiveOS Frontend Deployment ==="
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js not found. Installing..."
    sudo dnf install -y nodejs
fi

NODE_VERSION=$(node -v)
echo "[OK] Node.js: $NODE_VERSION"

# Check npm
if ! command -v npm &>/dev/null; then
    echo "[ERROR] npm not found."
    exit 1
fi

echo "[OK] npm: $(npm -v)"
echo ""

# Check if backend is running
echo "[CHECK] Backend at $BACKEND_URL..."
if curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" | grep -q "200"; then
    echo "[OK] Backend is running and healthy"
else
    echo "[WARN] Backend not responding at $BACKEND_URL/health"
    echo "       The frontend will still build but API calls will fail."
fi
echo ""

# Create frontend directory
echo "[SETUP] Creating $FRONTEND_DIR..."
sudo mkdir -p "$FRONTEND_DIR"
sudo chown "$(whoami)" "$FRONTEND_DIR"

# Copy frontend files (assumes repo is cloned at /home/jara/Projects/ERP_Taller_Mca)
REPO_DIR="/home/jara/Projects/ERP_Taller_Mca"
if [ -d "$REPO_DIR/web" ]; then
    echo "[COPY] Copying frontend from $REPO_DIR/web..."
    cp -r "$REPO_DIR/web/"* "$FRONTEND_DIR/"
    cp -r "$REPO_DIR/web/".* "$FRONTEND_DIR/" 2>/dev/null || true
else
    echo "[ERROR] Repo not found at $REPO_DIR"
    echo "       Clone the repo first or update REPO_DIR in this script."
    exit 1
fi

cd "$FRONTEND_DIR"

# Install dependencies
echo "[BUILD] Installing dependencies..."
npm ci --omit=dev 2>&1 | tail -3

# Set environment for production
cat > .env.production <<EOF
# Backend URL — all API calls go through Next.js rewrites
BACKEND_HOST=192.168.18.104
BACKEND_PORT=3000
NODE_ENV=production
PORT=$FRONTEND_PORT
EOF

echo "[BUILD] Building Next.js frontend..."
npm run build 2>&1 | tail -5

echo ""
echo "[OK] Frontend built successfully!"
echo ""

# Create systemd service for the frontend
echo "[SYSTEMD] Creating erp-frontend.service..."
sudo tee /etc/systemd/system/erp-frontend.service > /dev/null <<EOF
[Unit]
Description=AutomotiveOS Frontend (Next.js)
After=network.target
Wants=erp-backend.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$FRONTEND_DIR
ExecStart=$(which npx) next start -p $FRONTEND_PORT
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$FRONTEND_PORT
Environment=BACKEND_HOST=192.168.18.104
Environment=BACKEND_PORT=3000

# Security
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$FRONTEND_DIR

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable erp-frontend.service
sudo systemctl restart erp-frontend.service

echo ""
echo "[OK] Frontend service started on port $FRONTEND_PORT"
echo ""

# Verify
sleep 3
echo "[VERIFY] Checking frontend..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$FRONTEND_PORT/sign-in" 2>&1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "[OK] Frontend is accessible at http://localhost:$FRONTEND_PORT"
else
    echo "[WARN] Frontend returned HTTP $HTTP_CODE"
    echo "       Check: sudo systemctl status erp-frontend"
fi

echo ""
echo "=== Deployment Complete ==="
echo "Frontend: http://192.168.18.104:$FRONTEND_PORT"
echo "Backend:  http://192.168.18.104:3000"
echo ""
echo "Update erp_menu.desktop to point to port $FRONTEND_PORT"
echo ""
