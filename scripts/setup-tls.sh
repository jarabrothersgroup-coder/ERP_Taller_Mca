#!/usr/bin/env bash
# setup-tls.sh — Genera un certificado TLS self-signed si no existe uno real.
# Reemplazá /etc/erp-taller/tls/{fullchain,privkey}.pem por un cert real
# (CA interna del taller o Let's Encrypt) en producción.
set -euo pipefail

TLS_DIR="/etc/erp-taller/tls"
FULL="$TLS_DIR/fullchain.pem"
KEY="$TLS_DIR/privkey.pem"

if [[ -f "$FULL" && -f "$KEY" ]]; then
  echo "[tls] Cert existente en $TLS_DIR; no se toca."
  exit 0
fi

mkdir -p "$TLS_DIR"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$KEY" -out "$FULL" -days 365 \
  -subj "/CN=erp-taller.local" \
  -addext "subjectAltName=DNS:erp-taller.local,IP:127.0.0.1"
chmod 600 "$KEY"
chmod 644 "$FULL"
echo "[tls] Cert self-signed generado en $TLS_DIR"
echo "[tls][AVISO] Es autofirmado. Reemplazalo por un cert real antes de producción."
