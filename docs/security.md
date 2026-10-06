# Security

This is production-style portfolio infrastructure. The list below is what was built and what it does not cover. It is not an audit.

## What is in place

**Network.** Discovery is off. Peers come from a static list, and `permissions-nodes-config-file` rejects any enode that is not on it. Validators 2–4 do not publish RPC to the host. Production config drops `ADMIN`, `DEBUG`, `TRACE` and `PERM` from RPC. The firewall scripts allow 8545/8546/9545 only from the application server.

**Transport.** Nginx terminates TLS 1.2/1.3 and redirects HTTP. Validator RPC is not on 443.

**API.** Zod validates every path, query and body. Writes require `X-API-Key`, compared in constant time, and are refused entirely when the key is unset. Rate limiting is on, with `/health`, `/ready` and `/metrics` excluded so Prometheus does not lock the API out. Helmet sets the usual headers. CORS is an explicit origin list. Logs redact `x-api-key` and anything named like a private key. The error handler does not return stack traces.

**Data.** Drizzle sends parameters. There is no string-built SQL in the request path. The indexer uses the same client.

**Contracts.** OpenZeppelin `AccessControl` and `Pausable`. Mint, burn, pause, register and policy changes are role-gated. The token checks the transfer policy inside `_update`, so a transfer cannot skip it. Supply changes (mint and burn) intentionally skip the policy and stay under their own roles. Solidity 0.8 checks overflow. Tests cover unauthorised mint, pause, role grant, blocked accounts and the allowlist.

**Keys.** `.env` is gitignored. `.env.example` has the public Besu dev key and the dev database password, both labelled. `besu/keys/dev` is the only key material in git, and the generate script refuses to overwrite `staging` or `production` keys into a path that would be committed: those directories are gitignored. Production keys are generated on a trusted machine and copied to the host.

**Transactions.** Idempotency keys stop a retry from minting twice. A transaction that already has a hash is not sent again.

## What is not in place

- No external audit, bug bounty, or formal verification.
- The local compose file publishes validator-1 RPC on `0.0.0.0:8545` with `ADMIN` enabled. That is for development. Do not port-forward it.
- The dev private key can drain the prefunded accounts and mint tokens. That is fine only because those accounts exist solely on chain 7117 in Docker.
- `API_WRITE_KEY` is a shared bearer token, not per-user auth. Anyone with it can mint. Put it in a secret store and do not ship it to the browser. The dashboard is read-only for that reason.
- Rate limiting is in-memory and per process. Two API replicas would each have their own budget.
- Grafana's default dev password is in `.env.example`. Change it before the host is reachable, and do not leave Grafana on the public internet without an allowlist.
- Node exporter on Docker Desktop reports the Docker VM, not the Mac. On a VPS it reports the host, which is what the disk alert is for.
- Reentrancy: the contracts do not call untrusted external contracts except `transferPolicy.checkTransfer`, which is `view`. A malicious policy can revert and freeze transfers; the admin can point the policy back at address zero. Do not set the policy to an untrusted address.
- The Nginx config is a starting point. Cert paths, hostnames and the Grafana allowlist are placeholders.

## Secrets that must never be committed

Private keys, mnemonics, `API_WRITE_KEY`, `POSTGRES_PASSWORD`, Grafana admin password, RPC credentials, TLS private keys. `git check-ignore .env besu/keys/production` should print both paths.
