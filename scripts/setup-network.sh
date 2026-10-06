#!/usr/bin/env bash
# Bring up the local network, database, and (optionally) deploy contracts.
#   scripts/setup-network.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

if [[ ! -f besu/genesis/genesis.json || ! -d besu/keys/dev/validator-1 ]]; then
  bash besu/scripts/generate-network.sh dev
fi

docker compose up -d validator-1 validator-2 validator-3 validator-4 postgres
echo "Waiting for validator-1 RPC..."
for _ in $(seq 1 30); do
  if curl -sf -X POST -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://localhost:8545 >/dev/null; then
    break
  fi
  sleep 2
done

npm install
npm run build -w @besu-net/shared -w @besu-net/db
npm run db:migrate
echo "Network is up. Deploy contracts with: npm run contracts:deploy && npm run seed:besu -w contracts"
echo "Then start apps with: npm run dev"
