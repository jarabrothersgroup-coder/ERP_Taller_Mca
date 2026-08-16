#!/usr/bin/env bash
# provision-grafana-reader.sh — Crea el rol de solo lectura que usa Grafana.
#
# Grafana se provisiona vía deploy/grafana/provisioning/datasources/datasource.yml
# con la password en secureJsonData desde ${PG_GRAFANA_PASSWORD}. Este script
# crea el rol `grafana_reader` correspondiente (idempotente, NO destructivo).
#
# Uso (en el host de PostgreSQL, como postgres/superusuario):
#   PG_GRAFANA_PASSWORD='...' sudo -u postgres bash scripts/provision-grafana-reader.sh
#   PG_GRAFANA_PASSWORD='...' bash scripts/provision-grafana-reader.sh -d automotive_os
#
# Notas:
#   - Solo otorga SELECT (solo lectura) en el schema public y en tablas futuras.
#   - No toca datos, no borra nada, no modifica el rol de la app (erp/erp_user).
set -euo pipefail

DB_NAME="${DB_NAME:-automotive_os}"
GRAFANA_ROLE="grafana_reader"
GRAFANA_PASSWORD="${PG_GRAFANA_PASSWORD:-}"
PSQL=(psql -v ON_ERROR_STOP=1)

usage() { grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--db) DB_NAME="$2"; shift 2;;
    -h|--help) usage;;
    *) echo "Argumento desconocido: $1" >&2; usage;;
  esac
done

if [[ -z "$GRAFANA_PASSWORD" ]]; then
  echo "[grafana-reader] Falta PG_GRAFANA_PASSWORD (o pasala como env var)." >&2
  exit 1
fi

echo "[grafana-reader] Creando rol '$GRAFANA_ROLE' (solo lectura) en DB '$DB_NAME'..."

"${PSQL[@]}" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$GRAFANA_ROLE') THEN
    CREATE ROLE $GRAFANA_ROLE LOGIN PASSWORD '$GRAFANA_PASSWORD';
  ELSE
    ALTER ROLE $GRAFANA_ROLE WITH LOGIN PASSWORD '$GRAFANA_PASSWORD';
  END IF;
END
\$\$;

GRANT CONNECT ON DATABASE "$DB_NAME" TO $GRAFANA_ROLE;
GRANT USAGE ON SCHEMA public TO $GRAFANA_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO $GRAFANA_ROLE;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO $GRAFANA_ROLE;
SQL

echo "[grafana-reader] OK — rol '$GRAFANA_ROLE' listo para Grafana (datasource: deploy/grafana/provisioning/datasources/datasource.yml)."
