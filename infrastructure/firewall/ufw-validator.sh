#!/usr/bin/env bash
# Firewall for a validator VPS. RPC and metrics are NOT public.
# Set APP_SERVER_IP to the application server before running.
set -euo pipefail

APP_SERVER_IP="${APP_SERVER_IP:?set APP_SERVER_IP to the API server address}"
SSH_CIDR="${SSH_CIDR:-0.0.0.0/0}"

ufw default deny incoming
ufw default allow outgoing
ufw allow from "$SSH_CIDR" to any port 22 proto tcp comment 'ssh'
# P2P from anywhere is required for the other validators. Tighten to the
# validator CIDR if all four nodes share a private network.
ufw allow 30303/tcp comment 'besu p2p'
ufw allow 30303/udp comment 'besu discovery unused but reserved'
# JSON-RPC and metrics only from the application server.
ufw allow from "$APP_SERVER_IP" to any port 8545 proto tcp comment 'rpc from api'
ufw allow from "$APP_SERVER_IP" to any port 8546 proto tcp comment 'ws from indexer'
ufw allow from "$APP_SERVER_IP" to any port 9545 proto tcp comment 'metrics'
ufw --force enable
ufw status verbose
