#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <tenant-slug> [tenant-name]"
  echo ""
  echo "Ejemplos:"
  echo "  $0 taller-el-chero"
  echo '  $0 jara-brothers "Jara Brothers Group"'
  exit 1
fi

npx tsx scripts/seed-tenant.ts "$@"
