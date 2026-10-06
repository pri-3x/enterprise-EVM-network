# Troubleshooting

## Containers start, RPC does not answer

`docker compose ps` should show all four validators healthy. The healthcheck opens a TCP connection to 8545 inside the container; healthy means the port is open, not that the chain has peers.

```bash
docker logs besu-validator-1 | tail
curl -s -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545
```

If the log says the node cannot connect to peers, the static IP and `permissions_config.toml` have drifted. Regenerate with `besu/scripts/generate-network.sh` and recreate the containers. Do not edit enodes by hand.

## `Invalid opcode: 0x5f` on deploy

The running chain was started from a genesis without `shanghaiTime`. `PUSH0` needs Shanghai. The checked-in genesis sets `shanghaiTime` and `cancunTime` to 0. If you have an old volume: `docker compose down -v` and `docker compose up -d`, then deploy again. Wiping volumes deletes the chain.

## `Output directory already exists` from Besu

Expected on Docker Desktop bind mounts with Besu 26.9. `generate-network.sh` checks the files itself. If `genesis.json` or a key is actually missing, the script exits 1 and prints the path.

## API returns 503 on `/ready`

Either Postgres is down (`docker compose ps postgres`) or RPC is down. The body says which: `database` and `rpc`.

## API returns 401 on POST

`X-API-Key` must match `API_WRITE_KEY`. A missing key is also 401. If `API_WRITE_KEY` is unset, writes are 503 and the message says they are disabled.

## API returns 429

The default budget is 120 requests per minute per IP, excluding `/health`, `/ready` and `/metrics`. Wait for the window in the error message.

## Indexer log says `parent hash mismatch`

The checkpoint's hash is not the parent of the next block. On QBFT this means the index and the node disagree about history, which should not happen after a normal restart. Stop the indexer, look at `indexer_checkpoints` and `eth_getBlockByNumber` for that height, and decide whether to rebuild the index (`truncate` the index tables, restart) rather than editing the checkpoint forward.

## Indexer log says `numeric: "undefined"` or `NaN`

An event was decoded without its named fields. Decoding walks the ABI inputs (`apps/indexer/src/decode.ts`) because ethers Result names are not enumerable. If you add a contract, export its ABI (`npm run contracts:compile`) and teach `decodeLog` about it. Role events (`RoleGranted` and similar) are stored as network events, not asset events. An asset event with no `id` is a bug in that mapping.

## Dashboard is empty

The API must be on port 4000 and the indexer must have passed the deploy block. `curl localhost:4000/blocks?pageSize=1` shows whether rows exist. Contract addresses in `.env` must match `contracts/deployments/besu.local.json`. A fresh chain needs `npm run contracts:deploy` again.

## Port already in use

This repo uses 8545, 8546, 9545, 5433, 4000, 4100, 3001, 9090, 3300, 9100. Host Postgres on 5432 and a dev server on 3000 are left alone. Change `POSTGRES_PORT`, `API_PORT`, `FRONTEND_PORT` in `.env` if you need to.

## Grafana has no data

`curl localhost:9090/api/v1/targets` and look for `health: up`. The API and indexer must be running on the host for the `host.docker.internal` scrape. Besu metrics come from `validator-1` on the docker network, so that target is up whenever the validator is.
