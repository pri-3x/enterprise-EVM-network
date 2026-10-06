# Contracts

Solidity 0.8.28, optimiser 200 runs, EVM target `cancun`. OpenZeppelin Contracts 5.6.

## EnterpriseToken

ERC-20 named Enterprise Token (`ENT`), 18 decimals, cap 1,000,000,000. Roles:

| Role | Can |
| --- | --- |
| `DEFAULT_ADMIN_ROLE` | grant and revoke roles, set the transfer policy |
| `MINTER_ROLE` | `mint` |
| `BURNER_ROLE` | `burn` from any account |
| `PAUSER_ROLE` | `pause` / `unpause` |

`_update` calls `transferPolicy.checkTransfer` for real transfers (both sides non-zero). Mint and burn skip the policy so a blocked treasury can still have supply corrected by a role holder. Pausing blocks transfers and mints.

## AssetRegistry

Sequential ids starting at 1. A registrar registers, updates, deactivates and reactivates. The owner or a registrar can transfer. Transfers consult the same policy. Deactivating freezes updates and transfers; the row stays so the history is intact.

## PermissionedTransfer

Two lists:

- **Blocked** always wins. A blocked address cannot send or receive.
- **Allowlist**, off by default. When `allowlistEnabled` is true, both sides must be approved. The zero address counts as approved so mint and burn are not blocked by the allowlist.

`COMPLIANCE_ROLE` manages the lists. Only `DEFAULT_ADMIN_ROLE` can turn the allowlist on.

## Tests

`npm run contracts:test` — 48 tests: deployment, mint, unauthorised mint, cap, burn, pause, role grant and revoke, asset register/update/transfer/deactivate, third-party transfer rejected, policy block and allowlist on both the token and the registry, events.

## Deploy

```bash
npm run contracts:deploy
npm run seed:besu -w contracts
```

`contracts/scripts/deploy.ts` deploys the three contracts, points the token and the registry at the policy, and writes the addresses into the root `.env` and `contracts/deployments/<network>.local.json` (gitignored). The seed script mints 1,000,000 ENT to the deployer and 250,000 to two dev accounts, registers five assets, transfers one and updates a valuation.

On the local network those addresses were:

```text
PermissionedTransfer  0x42699A7612A82f1d9C36148af9C77354759b210b
EnterpriseToken       0xa50a51c09a5c451C52BB714527E1974b686D8e77
AssetRegistry         0x9a3DBCa554e9f6b9257aAa24010DA8377C57c17e
```

They are chain-specific. A new genesis gets new addresses. The API and indexer read them from the environment, not from source.
