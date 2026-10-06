#!/usr/bin/env bash
# QBFT fault-tolerance check for N=4 (f=1).
# 1. Record height with all four validators.
# 2. Stop validator-4. Height must keep increasing and peer count must stay at 2
#    on validator-1 (the three remaining nodes).
# 3. Start validator-4. Peer count must return to 3.
set -euo pipefail

rpc() {
  curl -sf -X POST -H 'Content-Type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"method\":\"$1\",\"params\":${2:-[]},\"id\":1}" \
    http://localhost:8545
}
height() { rpc eth_blockNumber | python3 -c 'import json,sys; print(int(json.load(sys.stdin)["result"],16))'; }
peers() { rpc net_peerCount | python3 -c 'import json,sys; print(int(json.load(sys.stdin)["result"],16))'; }

echo "height before: $(height)  peers: $(peers)"
docker stop besu-validator-4 >/dev/null
trap 'docker start besu-validator-4 >/dev/null || true' EXIT

sleep 8
h1=$(height)
sleep 6
h2=$(height)
p=$(peers)
echo "during outage: $h1 -> $h2  peers: $p"
if [[ "$h2" -le "$h1" ]]; then
  echo "FAIL: block production stopped while validator-4 was down"
  exit 1
fi
if [[ "$p" -lt 2 ]]; then
  echo "FAIL: validator-1 lost the remaining quorum (peers=$p)"
  exit 1
fi

docker start besu-validator-4 >/dev/null
trap - EXIT
echo "waiting for validator-4 to rejoin..."
ok=0
for _ in $(seq 1 20); do
  sleep 2
  if [[ "$(peers)" -ge 3 ]]; then ok=1; break; fi
done
echo "height after recovery: $(height)  peers: $(peers)"
if [[ "$ok" != "1" ]]; then
  echo "FAIL: validator-4 did not rejoin within 40s"
  exit 1
fi
echo "PASS: network produced blocks with one validator down and recovered"
