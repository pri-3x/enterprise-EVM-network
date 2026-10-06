#!/usr/bin/env bash
# Dump Postgres and remind the operator that validator keys live outside git
# for any environment other than dev.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${1:-$ROOT/tmp/backup-$STAMP}"
mkdir -p "$OUT"

docker exec besu-postgres pg_dump -U besu besu_network > "$OUT/besu_network.sql"
cp "$ROOT/besu/genesis/genesis.json" "$OUT/genesis.json"
echo "Wrote $OUT/besu_network.sql and genesis.json"
echo "Dev validator keys are in besu/keys/dev and are public by design."
echo "Staging and production keys must be copied from the host key store, not from git."
