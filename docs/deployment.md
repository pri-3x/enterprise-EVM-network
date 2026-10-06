# Deployment

This was not deployed to a public server in this build. The steps below are what you run when you have four small VPS instances (or one VPN) for validators and one for the application. Replace every `example.com` and every IP.

## 1. Keys

On a trusted machine, not in CI:

```bash
bash besu/scripts/generate-network.sh production 10.0.0.0
```

The third argument's first three octets are wrong as written if you pass `10.0.0.0`; pass the prefix only, for example `10.0.1`. The script writes:

- `besu/genesis/genesis.json` (safe to copy to every node)
- `besu/keys/production/validator-N/key` (one key per node, never committed)
- `besu/permissioning/static-nodes.json` and `permissions_config.toml`

`besu/keys/production` is gitignored. Back the keys up offline. Losing three of four keys loses the chain, because `f = 1` and a new validator cannot be added without a quorum of the old ones. Store each key on its own host under `/etc/besu/keys/key` with mode `0600`.

Do not reuse `besu/keys/dev`. Those private keys are in git on purpose, for the local network only.

## 2. Validators

On each validator host:

1. Install Docker and copy the repo to `/opt/besu-enterprise-network`.
2. Copy that host's key, the shared genesis, `static-nodes.json` and `permissions_config.toml` into `/etc/besu/` as the systemd unit expects.
3. Set `BESU_P2P_HOST` in `/etc/besu/validator.env` to this host's reachable IP.
4. `infrastructure/firewall/ufw-validator.sh` with `APP_SERVER_IP` set to the application server. That opens 22 and 30303, and opens 8545/8546/9545 only from the application server.
5. `systemctl enable --now besu-validator.service`.

Confirm from the application server, not from the internet:

```bash
curl -s -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' \
  http://<validator-1-private-ip>:8545
```

## 3. Application server

1. `infrastructure/firewall/ufw-apps.sh` so only 22, 80 and 443 are public. Postgres, Prometheus, the API and the indexer bind to `127.0.0.1` in `docker-compose.prod.yml`.
2. Create `/etc/besu/app.env` from `.env.example`. Generate a new `DEPLOYER_PRIVATE_KEY` (`openssl rand -hex 32`, prefix `0x`), a long `API_WRITE_KEY`, and a real `POSTGRES_PASSWORD`. Point `RPC_URL` at validator-1's private address.
3. Build images from `infrastructure/docker/*.Dockerfile` and set `API_IMAGE`, `INDEXER_IMAGE`, `FRONTEND_IMAGE`.
4. `docker compose -f infrastructure/deployment/docker-compose.prod.yml --env-file /etc/besu/app.env up -d`.
5. Deploy contracts from a machine that can reach RPC, with the new key funded in a genesis you generated for production. The checked-in dev allocations will not match a production genesis.
6. Install `infrastructure/nginx/besu.conf`, change the hostnames, and issue certificates:

```bash
certbot certonly --webroot -w /var/www/certbot -d besu.example.com -d api.example.com -d grafana.example.com
```

7. Restrict the Grafana server block with `allow <your-cidr>; deny all;`.

## 4. CI

`.github/workflows/ci.yml` runs lint, typecheck, API and indexer tests (with Postgres), and Docker builds of the API and indexer.

`.github/workflows/contracts.yml` compiles and tests the Solidity.

`.github/workflows/deploy.yml` is `workflow_dispatch` only. It builds images. It does not SSH anywhere unless you add `DEPLOY_HOST` and the SSH step described in the workflow. That gate is deliberate.

## 5. What "live" means here

Until those hosts exist, the live system is the local one: `docker compose up -d` and `npm run dev`. The dashboard at http://localhost:3001 is the demo.
