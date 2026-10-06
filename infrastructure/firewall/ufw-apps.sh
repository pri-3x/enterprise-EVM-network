#!/usr/bin/env bash
# Firewall for the application server (API, indexer, Postgres, frontend, monitoring).
set -euo pipefail

SSH_CIDR="${SSH_CIDR:-0.0.0.0/0}"

ufw default deny incoming
ufw default allow outgoing
ufw allow from "$SSH_CIDR" to any port 22 proto tcp comment 'ssh'
ufw allow 80/tcp comment 'http acme + redirect'
ufw allow 443/tcp comment 'https'
# 5432, 8545, 9090, 4100 stay closed. Postgres and Prometheus are local only.
ufw --force enable
ufw status verbose
