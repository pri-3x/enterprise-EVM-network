# Performance

Machine: Apple M4, 10 cores, 16 GB RAM, macOS 26.4, Docker Desktop 29.4. Besu 26.9.0 in four containers, block period 2 seconds, zero gas price. These numbers describe that machine. They are not a claim about a multi-region deployment.

## Block time

Ten consecutive blocks sampled at the start of the benchmark all had a 2 second interval. Mean 2.0 seconds. That matches `blockperiodseconds = 2`.

## Transaction inclusion

`scripts/benchmark.ts` sends zero-value transactions from the deployer to itself, 25 in flight at a time, and records the time until the receipt (`wait(1)`).

| Count | Elapsed | Throughput | p50 | p95 | p99 |
| --- | --- | --- | --- | --- | --- |
| 100 | 16.99 s | 5.89 tx/s | 3779 ms | 4176 ms | 4278 ms |
| 500 | 83.07 s | 6.02 tx/s | 3909 ms | 4123 ms | 4159 ms |
| 1000 | 165.90 s | 6.03 tx/s | 3916 ms | 4121 ms | 4164 ms |

Throughput sits near 6 tx/s because the script keeps a window of 25 transactions in flight and each one waits out the 2 second block plus the time to be included in the next one. A single block's gas limit (30,000,000) can hold far more than 25 simple transfers. The limit in this measurement is the benchmark's in-flight window and the block period, not contract execution. Do not quote 6 tx/s as the network's maximum.

Run again with:

```bash
COUNT=100 npx tsx scripts/benchmark.ts
COUNT=1000 npx tsx scripts/benchmark.ts
```

## API latency

30 samples each, same machine, API on localhost, after the rate limiter had been taught to ignore `/health` and `/metrics`.

| Route | p50 | p95 | p99 |
| --- | --- | --- | --- |
| `GET /health` | 0.6 ms | 2.4 ms | 68 ms |
| `GET /blocks?pageSize=20` | 3.0 ms | 20 ms | 56 ms |
| `GET /assets` | 1.2 ms | 4.6 ms | 7.0 ms |
| `GET /network` | 15 ms | 50 ms | 149 ms |

`/network` is slower because it makes several JSON-RPC calls (client version, latest block, previous block, peer count, sync status, validator set).

## Indexing latency

On the live run the indexer processed empty blocks in about 20–40 ms and blocks with logs in a similar range (the first blocks with contract deploys were under 100 ms). Once it reached the head, Grafana's indexer lag panel read 0. Lag is `chain head - last checkpoint`, exported as `indexer_lag_blocks`.
