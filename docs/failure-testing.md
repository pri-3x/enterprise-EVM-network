# Failure testing

All of these were run against the local Docker Compose network on 6 Oct 2026.

## Validator failure

```text
docker stop besu-validator-4
```

Expected: the chain keeps producing blocks, the remaining three validators stay in consensus.

Observed: height 485 with 3 peers, then 488 → 491 while validator-4 was down, with 2 peers on validator-1. `scripts/failure-test.sh` exits non-zero if height does not advance or if peers fall below 2.

## Validator recovery

```text
docker start besu-validator-4
```

Expected: the node reconnects and catches up.

Observed: within the 40 second wait, validator-1's peer count returned to 3 and the height was 493. Because QBFT blocks are final, "catch up" is the restarted node importing the blocks it missed and rejoining the peer set. The peer count returning to 3 is the check the script uses.

## Indexer restart

The indexer commits a block and its checkpoint in one database transaction (`apps/indexer/src/store.ts`). Killing it mid-block rolls that transaction back.

Checked two ways:

1. Unit/integration test `apps/indexer/tests/idempotency.test.ts` inserts the same synthetic block twice against Postgres. The second call reports `alreadyIndexed`, one `token_transfers` row exists, and the balance is `1000`, not `2000`.
2. The running indexer was restarted by the file watcher while it was catching up from genesis. It resumed from `indexer_checkpoints` and reached lag 0 (Grafana panel "Indexer lag" read 0, checkpoint matched chain head).

## Backend restart

The API holds no chain state. Restarting it (the dev server reloads on file changes, which happened several times during this build) reconnects the JSON-RPC provider and the Postgres pool. A mint submitted before a restart is already a transaction hash in `submitted_transactions` and on chain. Repeating the same `Idempotency-Key` after the API was up returned the original hash `0xcf25289e…` and did not mint a second token.

## Database restart

Postgres is the system of record for the index, not for the chain. Stopping and starting the `besu-postgres` container does not affect Besu. The API `/ready` probe runs `select 1` and reports `database: false` while Postgres is down, and `ready` once `pg_isready` succeeds. The indexer retries with backoff (`index_error` log, sleep, double the delay up to 30 seconds) and continues from the checkpoint, which Postgres still holds.

To repeat: `docker restart besu-postgres`, then `curl localhost:4000/ready` and `curl localhost:4100/health`.
