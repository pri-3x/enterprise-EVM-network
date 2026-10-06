#!/usr/bin/env bash
# Probe the local stack. Exits non-zero if a required check fails.
set -euo pipefail

rpc() {
  curl -sf -X POST -H 'Content-Type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"method\":\"$1\",\"params\":${2:-[]},\"id\":1}" \
    http://localhost:8545
}

fail=0
check() {
  local name="$1" ok="$2"
  if [[ "$ok" == "1" ]]; then echo "ok   $name"; else echo "FAIL $name"; fail=1; fi
}

chain=$(rpc eth_chainId | python3 -c 'import json,sys; print(int(json.load(sys.stdin)["result"],16))' 2>/dev/null || echo 0)
peers=$(rpc net_peerCount | python3 -c 'import json,sys; print(int(json.load(sys.stdin)["result"],16))' 2>/dev/null || echo 0)
block=$(rpc eth_blockNumber | python3 -c 'import json,sys; print(int(json.load(sys.stdin)["result"],16))' 2>/dev/null || echo 0)
vals=$(rpc qbft_getValidatorsByBlockNumber '["latest"]' | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["result"]))' 2>/dev/null || echo 0)

check "chain id 7117 (got $chain)" "$([[ "$chain" == "7117" ]] && echo 1 || echo 0)"
check "peer count >= 3 (got $peers)" "$([[ "$peers" -ge 3 ]] && echo 1 || echo 0)"
check "block height > 0 (got $block)" "$([[ "$block" -gt 0 ]] && echo 1 || echo 0)"
check "4 validators (got $vals)" "$([[ "$vals" == "4" ]] && echo 1 || echo 0)"

sleep 3
block2=$(rpc eth_blockNumber | python3 -c 'import json,sys; print(int(json.load(sys.stdin)["result"],16))')
check "blocks advancing ($block -> $block2)" "$([[ "$block2" -gt "$block" ]] && echo 1 || echo 0)"

if docker exec besu-postgres pg_isready -U besu -d besu_network >/dev/null 2>&1; then
  check "postgres" 1
else
  check "postgres" 0
fi

if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
  check "api /health" 1
  if curl -sf http://localhost:4000/ready | python3 -c 'import json,sys; raise SystemExit(0 if json.load(sys.stdin)["data"]["status"]=="ready" else 1)'; then
    check "api /ready" 1
  else
    check "api /ready" 0
  fi
else
  echo "skip api (not running)"
fi

if curl -sf http://localhost:4100/health >/dev/null 2>&1; then
  check "indexer /health" 1
else
  echo "skip indexer (not running)"
fi

exit "$fail"
