#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Generate a fresh QBFT genesis + validator key set using Besu's operator tool.
#
# Usage:
#   besu/scripts/generate-network.sh [env-name] [subnet-prefix]
#     env-name       dev (default) | staging | production
#     subnet-prefix  first three octets of the validator network (default 172.16.239)
#
# Output:
#   besu/genesis/genesis.json              shared genesis (extraData encodes validators)
#   besu/keys/<env>/validator-N/key(.pub)  validator node keys
#   besu/permissioning/static-nodes.json   enode list (docker-compose static IPs)
#   besu/permissioning/permissions_config.toml  node allowlist
#
# ONLY the "dev" key set is committed to git. staging/production keys are
# git-ignored and must be backed up out-of-band (see docs/security.md).
# ---------------------------------------------------------------------------
set -euo pipefail

ENV_NAME="${1:-dev}"
SUBNET="${2:-172.16.239}"
BESU_IMAGE="${BESU_IMAGE:-hyperledger/besu:26.9.0}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BESU_DIR="$ROOT/besu"
OUT="$BESU_DIR/networkFiles"
KEYS_DIR="$BESU_DIR/keys/$ENV_NAME"

if [[ -d "$KEYS_DIR" ]]; then
  echo "Refusing to overwrite existing keys in $KEYS_DIR. Delete it manually if you really want new keys." >&2
  exit 1
fi

rm -rf "$OUT"
echo "==> Generating genesis + 4 validator keys with $BESU_IMAGE"
# NOTE: on bind-mounted volumes Besu 26.x writes all files and then exits
# non-zero with "Output directory already exists". We therefore validate the
# output ourselves instead of trusting the exit code.
docker run --rm \
  -v "$BESU_DIR:/work" -w /work \
  "$BESU_IMAGE" operator generate-blockchain-config \
  --config-file=/work/genesis/qbft-config.json \
  --to=/work/networkFiles \
  --private-key-file-name=key >/dev/null 2>&1 || true

if [[ ! -f "$OUT/genesis.json" ]] || [[ "$(find "$OUT/keys" -name key | wc -l | tr -d ' ')" != "4" ]]; then
  echo "Besu did not produce genesis.json + 4 keys in $OUT" >&2
  exit 1
fi

cp "$OUT/genesis.json" "$BESU_DIR/genesis/genesis.json"

# Besu orders validators in extraData by iteration order of the generated key dirs.
# We assign validator-1..4 in the same order as extraData to keep docs consistent.
EXTRA=$(python3 -c "import json;print(json.load(open('$OUT/genesis.json'))['extraData'])")
ADDRS=()
# extraData RLP: f87a a0<32 zero bytes> f854 94<addr1> 94<addr2> 94<addr3> 94<addr4> c0 80 c0
PAYLOAD="${EXTRA:2}"
PAYLOAD="${PAYLOAD:4+2+64+4}"      # skip list header (f87a), vanity header (a0) + 32 zero bytes, inner list header (f854)
for i in 0 1 2 3; do
  OFFSET=$(( i * 42 + 2 ))         # 0x94 prefix (2 hex) + 40 hex addr
  ADDRS+=("0x${PAYLOAD:$OFFSET:40}")
done

mkdir -p "$KEYS_DIR"
STATIC_NODES="["
ALLOWLIST=""
for i in 0 1 2 3; do
  N=$((i + 1))
  ADDR="${ADDRS[$i]}"
  SRC="$OUT/keys/$ADDR"
  if [[ ! -d "$SRC" ]]; then
    # key dirs are lowercase; normalise
    SRC="$OUT/keys/$(echo "$ADDR" | tr 'A-F' 'a-f')"
  fi
  mkdir -p "$KEYS_DIR/validator-$N"
  cp "$SRC/key" "$SRC/key.pub" "$KEYS_DIR/validator-$N/"
  echo "$ADDR" > "$KEYS_DIR/validator-$N/address"
  PUB=$(cat "$SRC/key.pub"); PUB="${PUB#0x}"
  IP="$SUBNET.$((10 + N))"
  ENODE="enode://$PUB@$IP:30303"
  SEP=","; [[ $i -eq 3 ]] && SEP=""
  STATIC_NODES+=$'\n'"  \"$ENODE\"$SEP"
  ALLOWLIST+="\"$ENODE\"$SEP"
  echo "  validator-$N  address=$ADDR  ip=$IP"
done
STATIC_NODES+=$'\n]'

echo "$STATIC_NODES" > "$BESU_DIR/permissioning/static-nodes.json"
cat > "$BESU_DIR/permissioning/permissions_config.toml" <<EOF
# Node-level permissioning (local allowlist). Only these enodes may peer.
# Regenerate with besu/scripts/generate-network.sh — do not hand edit the enode list.
nodes-allowlist=[$ALLOWLIST]
EOF

rm -rf "$OUT"
echo "==> Done. Genesis: besu/genesis/genesis.json, keys: $KEYS_DIR"
