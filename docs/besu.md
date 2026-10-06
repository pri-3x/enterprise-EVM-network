# Besu configuration

Image: `hyperledger/besu:26.9.0`. Pin the tag. `latest` moves.

## Genesis

`besu/genesis/qbft-config.json` is the input to Besu's operator tool. `besu/scripts/generate-network.sh` runs:

```text
besu operator generate-blockchain-config
  --config-file genesis/qbft-config.json
  --to networkFiles
  --private-key-file-name key
```

Besu 26.9 writes the files and then exits non-zero with "Output directory already exists" when the output directory is a bind mount. The script checks that `genesis.json` and four key files exist, and ignores that exit code. The script also parses `extraData` to name the validators in the same order Besu encoded them.

Fork schedule, all active from the start:

| Field | Value | Why |
| --- | --- | --- |
| `chainId` | 7117 | Private chain, not 1 or 1337 |
| `londonBlock` | 0 | Required base for the later forks |
| `shanghaiTime` | 0 | Solidity 0.8.28 emits `PUSH0` (opcode `0x5f`). Without Shanghai the deploy fails with `Invalid opcode: 0x5f` |
| `cancunTime` | 0 | Matches the compiler target `evmVersion: cancun` |
| `zeroBaseFee` | true | Private network, no ETH fee market |
| `gasLimit` | 30,000,000 | Room for contract deploys in one block |
| `qbft.blockperiodseconds` | 2 | Fast enough to demo, slow enough to watch |
| `qbft.epochlength` | 30,000 | Validator-set votes are not part of this project, so the epoch is long |
| `qbft.requesttimeoutseconds` | 4 | Two block periods. A round that misses the block time gets one extra period before the next round |

`extraData` is the RLP-encoded QBFT vanity and the four validator addresses. Do not edit it by hand.

Three Besu dev accounts are prefunded with 200 ETH each. The comment in the genesis says the keys are public. They are the deployer and the seed recipients.

## Node config

`besu/config/validator.toml` (local) and `validator.prod.toml` (servers) set:

- `discovery-enabled = false`. Peers come from `static-nodes.json`.
- `permissions-nodes-config-file-enabled = true`. A node that is not on the allowlist cannot peer even if it knows an enode.
- `sync-mode = FULL`, `data-storage-format = BONSAI`.
- `min-gas-price = 0`, matching `zeroBaseFee`.
- `tx-pool = SEQUENCED`. Besu's default layered pool is aimed at public 1559 networks. On a zero-base-fee chain Besu logs that it forces the price bump to 0; the sequenced pool is the one intended for a private chain.
- Metrics on 9545, categories include blockchain, peers, RPC, JVM and the transaction pool.

Local RPC enables `ETH, NET, WEB3, QBFT, TXPOOL, ADMIN, PERM, DEBUG, TRACE` because the health script and failure test use `admin_peers` indirectly via `net_peerCount` and `qbft_getValidatorsByBlockNumber`, and debugging a local chain is the point. Production RPC is `ETH, NET, WEB3, QBFT, TXPOOL` only. `ADMIN`, `DEBUG`, `TRACE` and `PERM` are not on the public or the application path. Changing the allowlist is an SSH task on the node, not an RPC call from the internet.

`BESU_P2P_HOST` is set per container to the static IP. Besu reads `BESU_*` environment variables as overrides of the toml file, which is how each container shares one config.

## Ports

| Port | Who | Local | Production |
| --- | --- | --- | --- |
| 30303 | P2P | docker network only | public or VPN, validator to validator |
| 8545 | HTTP RPC | host, validator-1 only | application server only, via firewall |
| 8546 | WebSocket | host, validator-1 only | indexer host only |
| 9545 | Metrics | host, validator-1 only | Prometheus host only |

Validators 2–4 do not publish RPC to the host at all.
