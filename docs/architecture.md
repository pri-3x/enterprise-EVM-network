# Architecture

The system is four Besu validators plus one application tier. Validators agree on blocks. Everything else is a client of validator-1's JSON-RPC, or of the database the indexer fills from that RPC.

```text
Users --> Next.js ----+
                      +--> Fastify API --> JSON-RPC --> Besu validators (QBFT)
Grafana --> Prometheus                          |
                                                +--> Indexer --> PostgreSQL
```

The diagram is `docs/architecture.png` (source `docs/architecture.svg`).

## Processes

| Process | Talks to | Exposes locally |
| --- | --- | --- |
| validator-1..4 | each other on TCP 30303 | only validator-1 publishes 8545, 8546, 9545 to the host |
| API | validator-1 RPC, Postgres | 4000 |
| Indexer | validator-1 RPC, Postgres | 4100 (`/health`, `/metrics`) |
| Frontend | API | 3001 |
| Prometheus | Besu, API, indexer, node exporter | 9090 |
| Grafana | Prometheus | 3300 |

The explorer is not a second application. Block, transaction and address pages live in the Next.js app so there is one public origin. See `apps/explorer/README.md`.

## Why the indexer exists

The API could read everything from Besu. Listing "the last 20 blocks" or "assets owned by this address" is a bad fit for JSON-RPC: it would be a loop of calls, and it would be repeated for every page view. The indexer turns logs into rows. The API reads those rows and falls back to RPC for a block or transaction that has not been indexed yet, and for live values such as native balance and token supply.

## Finality

QBFT commits are final. The indexer does not rewind blocks. If a new block's parent hash does not match the checkpoint, indexing stops and logs the mismatch instead of forking the database. That should not happen on this network; the check is there so a bug shows up as an error rather than as two histories.

## Idempotency

A crash between "fetched the block" and "saved the checkpoint" must not insert the same log twice and must not lose it. Each block is one database transaction that ends by advancing `indexer_checkpoints`. A crash rolls the transaction back, and the next start re-reads the same block. Unique keys (`blocks.number`, `transactions.hash`, `(tx_hash, log_index)` on events) make a second insert of an already committed block a no-op. Token balances move only when the transfer row is newly inserted, so a replay cannot double a balance.

The same idea applies to API writes. `submitted_transactions.idempotency_key` is unique. A repeat of `Idempotency-Key` returns the stored hash and does not call `sendTransaction` again. A hash that might already be in a block is never re-broadcast.

## Local network addresses

Docker assigns fixed addresses on `172.16.239.0/24` because the permissioning allowlist is `enode@ip:port`:

| Node | IP |
| --- | --- |
| validator-1 | 172.16.239.11 |
| validator-2 | 172.16.239.12 |
| validator-3 | 172.16.239.13 |
| validator-4 | 172.16.239.14 |

Production IPs are not in the repo. `besu/scripts/generate-network.sh` takes a subnet prefix and writes a new allowlist.
