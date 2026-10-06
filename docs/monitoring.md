# Monitoring

## Run locally

```bash
docker compose up -d prometheus grafana node-exporter
```

Grafana: http://localhost:3300, user `admin`, password from `GRAFANA_ADMIN_PASSWORD` (dev default `admin_dev_password`). The dashboard "Besu Enterprise Network" is provisioned from `monitoring/grafana/dashboards/network.json`.

Prometheus: http://localhost:9090. Targets that were up on the local run: `besu`, `api`, `indexer`, `node`, `prometheus`.

## What is scraped

| Job | Target | Notes |
| --- | --- | --- |
| besu | `validator-1:9545` | `ethereum_blockchain_height`, `ethereum_peer_count`, JVM |
| api | `host.docker.internal:4000/metrics` | `http_requests_total`, `http_request_duration_seconds`, `tx_submissions_total` |
| indexer | `host.docker.internal:4100/metrics` | `indexer_lag_blocks`, `indexer_blocks_processed_total` |
| node | `node-exporter:9100` | CPU, memory, disk, network of the Docker host |

In production, scrape each validator's `:9545` on the private network and drop the `host.docker.internal` entries. The prod compose file expects you to edit `monitoring/prometheus/prometheus.yml` for those addresses.

## Alerts

`monitoring/alerts/besu.yml`:

| Alert | Condition |
| --- | --- |
| ValidatorDown | `up{job="besu"} == 0` for 1m |
| NoPeers | `ethereum_peer_count == 0` for 2m |
| BlockProductionStalled | chain height does not increase for 2m |
| IndexerLagHigh | `indexer_lag_blocks > 20` for 2m |
| DiskSpaceLow | filesystem free under 20% for 10m |
| ApiDown | API target down for 1m |
| IndexerDown | indexer target down for 1m |

Alertmanager is not deployed. Prometheus evaluates the rules (confirmed via `/-/rules` and the rules API). Wiring a receiver (Slack, email) is an operator step in `alertmanager.yml`, left out so this repo does not pretend to page anyone.

## Logs

API and indexer log JSON through pino. A processed block looks like:

```json
{"level":"info","service":"indexer","event":"block_processed","blockNumber":12345,"durationMs":40}
```

Private keys, the API write key and database passwords are not logged. The API redacts `x-api-key` and fields named like a private key.
