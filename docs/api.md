# API

Base URL `http://localhost:4000`. OpenAPI UI at `/docs`.

Success:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 1 } }
```

`meta` is present on list endpoints.

Error:

```json
{ "success": false, "error": { "code": "INVALID_REQUEST", "message": "Request validation failed" } }
```

Codes: `INVALID_REQUEST` 400, `UNAUTHORIZED` 401, `NOT_FOUND` 404, `TRANSACTION_FAILED` 422, `RATE_LIMITED` 429, `BLOCKCHAIN_ERROR` 502, `SERVICE_UNAVAILABLE` 503, `INTERNAL_ERROR` 500.

## Reads

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Process is up |
| GET | `/ready` | Database ping and RPC block number. 503 if either fails |
| GET | `/network` | Chain id, height, block time, peers, validator count, client version |
| GET | `/network/validators` | Address, blocks proposed, last block |
| GET | `/blocks?page&pageSize` | Indexed blocks, newest first |
| GET | `/blocks/:number` | Index, or RPC if the indexer has not reached it |
| GET | `/blocks/:number/transactions` | Transactions in that block |
| GET | `/transactions?page&pageSize` | |
| GET | `/transactions/:hash` | Index, or RPC |
| GET | `/accounts/:address` | Native balance and nonce from RPC; token balance, tx count and asset count from the index |
| GET | `/accounts/:address/balance` | |
| GET | `/accounts/:address/transactions` | |
| GET | `/assets?page&owner` | |
| GET | `/assets/:id` | Asset plus event history |
| GET | `/token` | Name, symbol, supply, cap, pause, policy, holder and transfer counts |
| GET | `/metrics` | Prometheus text. Not rate limited |

`pageSize` max is 100.

## Writes

Header `X-API-Key: $API_WRITE_KEY`. Optional `Idempotency-Key` (8–128 characters). The same key returns the original submission and does not send a second transaction.

| Method | Path | Body |
| --- | --- | --- |
| POST | `/token/mint` | `{ "to", "amount" }` amount is a decimal integer string of wei-like units (18 decimals) |
| POST | `/token/transfer` | `{ "to", "amount" }` sent by `DEPLOYER_PRIVATE_KEY` |
| POST | `/assets` | `{ "name", "assetType", "value", "owner" }` |
| POST | `/assets/:id/transfer` | `{ "to" }` |

The response `data` is `{ txHash, status, blockNumber, gasUsed, confirmations }`. `status` is one of `REQUESTED`, `SUBMITTED`, `PENDING`, `MINED`, `CONFIRMED`, `FAILED`.

The signer is the deployer key from the environment. There is no per-user wallet in the API. The dashboard does not call these routes.

## Lifecycle

```text
REQUESTED   row inserted
SUBMITTED   transaction built
PENDING     hash assigned, sent to Besu
MINED       receipt status 1, fewer than TX_CONFIRMATIONS blocks on top
CONFIRMED   receipt status 1, enough blocks on top
FAILED      send threw, or the receipt status is 0
```

`TX_CONFIRMATIONS` defaults to 2. `TX_TIMEOUT_MS` defaults to 60 seconds. On timeout the row stays `PENDING` and the handler returns that status. It does not resend. A later read of the hash shows the receipt once it is mined. The indexer will have stored it by then.
