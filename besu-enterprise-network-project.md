# Hyperledger Besu Enterprise EVM Network — Cursor Project Specification

## 1. Project Overview

Build and deploy a production-style **permissioned Ethereum-compatible blockchain network using Hyperledger Besu**.

The project should be more than a local Besu demo. It must demonstrate:

- Hyperledger Besu
- QBFT consensus
- Multi-validator architecture
- Permissioned networking
- EVM smart contracts
- Solidity development
- TypeScript/Node.js backend
- PostgreSQL indexing
- REST APIs
- Event-driven blockchain indexing
- Docker
- Linux server deployment
- Nginx + TLS
- RPC security
- Prometheus + Grafana
- CI/CD
- Health checks and monitoring
- A public frontend/dashboard
- A lightweight block explorer
- Complete documentation

The final system should be **live on the internet** and suitable for inclusion in a professional software/blockchain engineering portfolio.

---

# 2. Primary Goal

Create a live enterprise-style permissioned blockchain network with the following architecture:

```text
                         INTERNET
                             |
                 +-----------+-----------+
                 |                       |
                 v                       v
        +----------------+      +----------------+
        | Next.js Web App|      | Block Explorer |
        +-------+--------+      +-------+--------+
                |                       |
                +-----------+-----------+
                            |
                            v
                   +----------------+
                   | Backend API    |
                   | Node.js/TS     |
                   +-------+--------+
                           |
                      JSON-RPC
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
       +-----------+ +-----------+ +-----------+
       | Besu V1   | | Besu V2   | | Besu V3   |
       | Validator | | Validator | | Validator |
       +-----+-----+ +-----+-----+ +-----+-----+
             \            |            /
              \           |           /
               +----------+----------+
                          |
                    +-----------+
                    | Besu V4   |
                    | Validator |
                    +-----------+

                    QBFT Consensus

             +-------------------------+
             | PostgreSQL              |
             | Indexed blockchain data |
             +-------------------------+

             +-------------------------+
             | Prometheus + Grafana    |
             | Metrics / Monitoring    |
             +-------------------------+
```

---

# 3. Recommended Technology Stack

## Blockchain

- Hyperledger Besu
- QBFT consensus
- EVM
- JSON-RPC
- P2P networking
- Permissioned network

## Smart Contracts

- Solidity
- Hardhat
- OpenZeppelin
- ethers.js

## Backend

- Node.js
- TypeScript
- Fastify or Express
- ethers.js
- PostgreSQL
- Prisma or Drizzle ORM

Prefer clean TypeScript architecture.

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- ethers.js
- Lightweight responsive dashboard

## Infrastructure

- Ubuntu Linux
- Docker
- Docker Compose where appropriate
- Nginx
- Let's Encrypt / Certbot
- UFW
- Fail2Ban where appropriate

## Monitoring

- Prometheus
- Grafana
- Besu metrics
- Backend metrics
- Node health metrics

## CI/CD

- GitHub
- GitHub Actions
- Docker image build
- Automated tests
- Deployment workflow

---

# 4. Network Design

Create a 4-validator QBFT network.

Example:

```text
Validator 1
10.x.x.1
validator-1

Validator 2
10.x.x.2
validator-2

Validator 3
10.x.x.3
validator-3

Validator 4
10.x.x.4
validator-4
```

Do not hardcode actual production IPs into the repository.

Use environment variables and deployment configuration.

The network should have:

- Custom chain ID
- Custom network name
- QBFT consensus
- Block period around 2 seconds
- Appropriate epoch length
- 4 validators
- Peer discovery
- Static/trusted peers where appropriate
- Permissioned node configuration

The exact QBFT parameters should be documented and justified.

---

# 5. Fault Tolerance

Document the QBFT assumptions.

For `N = 4` validators:

```text
N = 3f + 1

4 = 3(1) + 1
```

Therefore:

```text
f = 1
```

The network should tolerate one Byzantine/malicious or unavailable validator while maintaining consensus, subject to QBFT operational assumptions.

Demonstrate this in testing.

Example test:

1. Start all 4 validators.
2. Confirm blocks are produced.
3. Stop validator 4.
4. Confirm the network continues producing blocks.
5. Restart validator 4.
6. Confirm it catches up.

Document the result.

---

# 6. Smart Contracts

Build at least three contracts.

## 6.1 EnterpriseToken.sol

ERC-20 token representing a fictional enterprise asset.

Requirements:

- ERC-20
- AccessControl
- Minting role
- Burning role
- Pausing
- Events
- Safe ownership/role management

Suggested roles:

```text
DEFAULT_ADMIN_ROLE
MINTER_ROLE
PAUSER_ROLE
```

Do not use insecure custom access control when OpenZeppelin provides an appropriate primitive.

---

## 6.2 AssetRegistry.sol

Maintain a registry of fictional enterprise assets.

Example:

```solidity
struct Asset {
    uint256 id;
    string name;
    string assetType;
    uint256 value;
    address owner;
    bool active;
}
```

Functions should include:

- registerAsset
- updateAsset
- deactivateAsset
- transferAsset
- getAsset

Emit events for every important state transition.

---

## 6.3 PermissionedTransfer.sol

Implement a simple transfer restriction mechanism.

The objective is to demonstrate that the application can enforce enterprise rules on an otherwise EVM-compatible blockchain.

Potential functionality:

- approved addresses
- blocked addresses
- transfer checks
- admin management
- events

Keep the implementation simple and auditable.

---

# 7. Smart Contract Engineering Requirements

Use:

- OpenZeppelin
- Solidity compiler with a modern stable version
- Hardhat
- TypeScript tests

Tests should cover:

- deployment
- minting
- unauthorized minting
- pausing
- unauthorized admin operations
- asset registration
- asset transfer
- permissioned transfer
- blocked accounts
- events
- edge cases

Run:

```bash
npm test
```

and ensure all tests pass before deployment.

Add:

```bash
npm run lint
npm run compile
```

---

# 8. Backend API

Create a production-style TypeScript API.

Suggested structure:

```text
apps/api/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── blockchain/
│   ├── indexer/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   └── server.ts
├── tests/
└── package.json
```

The backend should NOT contain private keys directly in source code.

Use environment variables or a secure secret mechanism.

---

# 9. Backend API Endpoints

Implement endpoints similar to:

```text
GET    /health
GET    /ready
GET    /network
GET    /network/validators

GET    /blocks
GET    /blocks/:number

GET    /transactions
GET    /transactions/:hash

GET    /accounts/:address
GET    /accounts/:address/balance

GET    /assets
GET    /assets/:id

POST   /assets
POST   /assets/:id/transfer

POST   /token/mint
POST   /token/transfer

GET    /metrics
```

Add request validation.

Return consistent JSON responses.

Example:

```json
{
  "success": true,
  "data": {}
}
```

For errors:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid asset ID"
  }
}
```

---

# 10. Blockchain Service

Create a dedicated blockchain abstraction.

Example:

```text
BlockchainService
├── getLatestBlock()
├── getBlock()
├── getTransaction()
├── getBalance()
├── sendTransaction()
├── waitForConfirmation()
├── getNetworkInfo()
└── getContract()
```

Do not scatter ethers.js calls throughout controllers.

Controllers should call services.

---

# 11. Transaction Handling

Implement production-style transaction handling.

Consider:

- transaction hash
- pending state
- confirmation state
- failed state
- receipt
- gas usage
- block number
- retry strategy
- timeout
- idempotency

Do not blindly retry transactions that may already have been mined.

Document the transaction lifecycle:

```text
REQUESTED
   |
   v
SUBMITTED
   |
   v
PENDING
   |
   +----> FAILED
   |
   v
MINED
   |
   v
CONFIRMED
```

---

# 12. PostgreSQL Indexer

Build an event/block indexer.

The indexer should consume blockchain data and store relevant information in PostgreSQL.

Suggested tables:

```text
blocks
transactions
transaction_receipts
accounts
token_transfers
assets
asset_events
network_events
```

Example block fields:

```text
id
block_number
block_hash
parent_hash
timestamp
gas_used
gas_limit
transaction_count
created_at
```

Example transaction fields:

```text
id
tx_hash
block_number
from_address
to_address
value
gas_used
status
created_at
```

The indexer should be restart-safe.

Do not assume the process will never crash.

---

# 13. Indexer Requirements

Implement:

- checkpointing
- block cursor
- graceful shutdown
- retry logic
- duplicate protection
- transaction receipt handling
- event decoding

Example:

```text
Indexer starts
     |
     v
Read last indexed block
     |
     v
Fetch next block
     |
     v
Process transactions/events
     |
     v
Commit database transaction
     |
     v
Save checkpoint
     |
     v
Repeat
```

Use database uniqueness constraints to prevent duplicate indexing.

---

# 14. Idempotency

This is important.

Transactions/events must not be inserted twice if the indexer restarts.

For example:

```text
UNIQUE(tx_hash)
```

and:

```text
UNIQUE(tx_hash, log_index)
```

where appropriate.

Explain why this is required.

---

# 15. Frontend

Create a clean enterprise blockchain dashboard.

Pages:

```text
/
├── Dashboard
├── Network
├── Blocks
├── Transactions
├── Assets
├── Token
└── Validators
```

Dashboard should show:

```text
Network Status
Chain ID
Latest Block
Block Time
Validators
Active Peers
Transactions
Token Supply
```

Use cards and tables.

Do not overdesign.

The goal is to demonstrate engineering capability.

---

# 16. Lightweight Block Explorer

Build a simple explorer.

Block page:

```text
Block #12345

Hash
Parent Hash
Timestamp
Transactions
Gas Used
Gas Limit
```

Transaction page:

```text
Transaction

Hash
From
To
Value
Gas Used
Status
Block
Timestamp
```

Address page:

```text
Address

Balance
Token Balance
Transactions
Asset Holdings
```

This makes the blockchain visibly usable.

---

# 17. Infrastructure

Deploy the network to cloud VPS instances.

Minimum recommended architecture:

```text
Server 1
Besu Validator 1

Server 2
Besu Validator 2

Server 3
Besu Validator 3

Server 4
Besu Validator 4

Server 5
API + PostgreSQL + Monitoring
```

A smaller setup can be used initially to reduce cost, but the final portfolio deployment should demonstrate separation of blockchain nodes from application services where practical.

---

# 18. Docker

Create Dockerfiles for:

```text
api
frontend
indexer
```

Besu should also be containerized where practical.

Use:

```text
docker-compose.yml
```

for local development.

Production deployment can use Docker Compose or another lightweight orchestration strategy.

Do NOT introduce Kubernetes unless it adds meaningful value to the project.

The goal is to demonstrate Besu and distributed systems, not Kubernetes for its own sake.

---

# 19. Network Security

Never expose unnecessary ports.

Typical considerations:

```text
HTTP/HTTPS
22 SSH
30303 P2P
8545 HTTP RPC
8546 WebSocket RPC
```

Do not publicly expose administrative RPC APIs.

Only expose RPC endpoints that are actually required.

Use firewall rules.

Separate:

```text
Public
Internal
Management
```

traffic wherever practical.

---

# 20. RPC Security

RPC is security-critical.

Do not expose unrestricted administrative methods.

Use:

- allowed APIs
- authentication where appropriate
- reverse proxy
- firewall restrictions
- IP allowlisting where practical
- TLS

Never commit:

```text
private keys
mnemonics
RPC secrets
database passwords
API keys
```

to Git.

---

# 21. Validator Keys

Validator keys must be generated securely.

Do not commit production validator private keys.

Use separate keys for:

```text
development
staging
production
```

Document key backup/recovery considerations.

For the public GitHub repository, use dummy/development keys only where absolutely necessary.

---

# 22. Monitoring

Implement Prometheus + Grafana.

Monitor at least:

```text
Besu process health
Block height
Block production
Peer count
RPC requests
Transaction count
CPU
Memory
Disk
Network
Backend health
Database health
Indexer lag
```

Create Grafana dashboards.

Example alert conditions:

```text
Validator down
Peer count = 0
Block height not increasing
Indexer lag too high
Disk usage > 80%
Backend unhealthy
Database unavailable
```

---

# 23. Logging

Use structured logs.

Example:

```json
{
  "level": "info",
  "service": "indexer",
  "event": "block_processed",
  "blockNumber": 12345,
  "durationMs": 84
}
```

Never log:

- private keys
- secrets
- passwords
- authentication tokens

---

# 24. CI/CD

GitHub Actions should run:

```text
lint
typecheck
unit tests
contract tests
build
Docker build
```

Production deployment should be manual approval or protected deployment where appropriate.

Suggested workflows:

```text
.github/
└── workflows/
    ├── ci.yml
    ├── contracts.yml
    └── deploy.yml
```

---

# 25. Repository Structure

Use a monorepo.

Suggested structure:

```text
besu-enterprise-network/
│
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── contracts/
│   ├── contracts/
│   ├── test/
│   ├── scripts/
│   ├── hardhat.config.ts
│   └── package.json
│
├── apps/
│   ├── api/
│   ├── frontend/
│   ├── indexer/
│   └── explorer/
│
├── besu/
│   ├── genesis/
│   ├── config/
│   ├── permissioning/
│   └── scripts/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   ├── systemd/
│   ├── firewall/
│   └── deployment/
│
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   └── alerts/
│
├── scripts/
│   ├── setup-network.sh
│   ├── deploy-contracts.ts
│   ├── health-check.sh
│   └── backup.sh
│
├── docs/
│   ├── architecture.md
│   ├── besu.md
│   ├── qbft.md
│   ├── deployment.md
│   ├── security.md
│   ├── monitoring.md
│   ├── contracts.md
│   ├── api.md
│   └── troubleshooting.md
│
└── .github/
    └── workflows/
```

---

# 26. Local Development

The entire project should be runnable locally.

Target:

```bash
git clone <repo>

cp .env.example .env

docker compose up -d

npm install

npm run contracts:compile

npm run contracts:test

npm run contracts:deploy

npm run dev
```

Provide a single documented local setup flow.

A new developer should be able to reproduce the environment without manually editing dozens of files.

---

# 27. Environment Configuration

Use:

```text
.env.example
```

Example variables:

```env
CHAIN_ID=
RPC_URL=
WS_RPC_URL=

DATABASE_URL=

DEPLOYER_PRIVATE_KEY=

TOKEN_CONTRACT_ADDRESS=
ASSET_REGISTRY_ADDRESS=
PERMISSIONED_TRANSFER_ADDRESS=

API_PORT=
FRONTEND_URL=
```

Never include real secrets.

---

# 28. Testing

Testing should cover multiple layers.

## Smart contracts

- unit tests
- access control
- edge cases
- event assertions

## Backend

- unit tests
- API tests
- validation tests
- blockchain service tests

## Indexer

- event indexing
- restart behavior
- duplicate protection
- checkpoint recovery

## Infrastructure

Create scripts that verify:

```text
all validators reachable
peer connectivity
RPC health
block production
database health
API health
indexer health
```

---

# 29. Failure Testing

Demonstrate distributed-system behavior.

Test at least:

### Validator failure

```text
Stop validator 4
```

Expected:

```text
Network continues
Blocks continue
Remaining validators maintain consensus
```

### Validator recovery

```text
Start validator 4
```

Expected:

```text
Node reconnects
Node catches up
```

### Backend restart

```text
Restart API
```

Expected:

```text
No blockchain corruption
API reconnects
```

### Indexer restart

```text
Kill indexer
Restart indexer
```

Expected:

```text
Indexer resumes from checkpoint
No duplicate events
```

### Database restart

Expected:

```text
Application recovers gracefully
```

Document every test.

---

# 30. Performance Testing

Measure:

```text
block time
transaction throughput
RPC latency
indexing latency
API latency
```

Do not make exaggerated performance claims.

Create a simple benchmark script.

Example:

```text
100 transactions
500 transactions
1000 transactions
```

Measure:

```text
TPS
p50 latency
p95 latency
p99 latency
```

Document the machine specifications used.

---

# 31. Production Domain Structure

Use a real domain if available.

Suggested structure:

```text
besu.example.com
api.example.com
explorer.example.com
grafana.example.com
```

Do not expose internal validator RPC directly.

The public website should link to:

```text
Live Demo
GitHub
Architecture
Explorer
```

---

# 32. Public Demo

The public demo should show:

```text
LIVE
```

Network status.

Example:

```text
Hyperledger Besu Enterprise Network

Status: HEALTHY
Consensus: QBFT
Chain ID: XXXXX
Validators: 4
Latest Block: XXXXX
Block Time: ~2s
Peers: 3
```

Then allow users to inspect:

- blocks
- transactions
- assets
- token
- validators

Do not require users to have blockchain knowledge to understand the dashboard.

---

# 33. Documentation

The README must contain:

## Project

What this is.

## Architecture

Diagram and explanation.

## Why Besu?

Explain:

- EVM compatibility
- enterprise/private networks
- QBFT
- permissioning
- operational features

## Consensus

Explain QBFT and validator assumptions.

## Local Setup

Exact commands.

## Deployment

Exact deployment process.

## Smart Contracts

Contract descriptions.

## API

Endpoint documentation.

## Monitoring

Grafana/Prometheus setup.

## Security

Security decisions and limitations.

## Failure Testing

Results.

## Performance

Benchmark results.

## Live Demo

Links.

## Screenshots

Add screenshots of:

- dashboard
- explorer
- Grafana
- validator network
- transactions

---

# 34. Architecture Diagram

Create a professional architecture diagram in:

```text
docs/architecture.png
```

and optionally:

```text
docs/architecture.drawio
```

The diagram should show:

```text
Users
 |
Frontend
 |
API
 |
RPC
 |
Besu validators
 |
QBFT
 |
PostgreSQL Indexer
 |
Monitoring
```

---

# 35. Security Review

Before making the project public, review:

- exposed ports
- RPC permissions
- private keys
- secrets
- CORS
- rate limiting
- SQL injection
- input validation
- smart contract access control
- reentrancy
- integer handling
- denial of service vectors
- log leakage
- Docker permissions
- Linux permissions
- TLS configuration

Do not claim the system is "production secure" merely because it has these controls.

Call it:

> production-style portfolio infrastructure

unless it has undergone an actual professional security audit.

---

# 36. Portfolio Quality Requirements

The project should demonstrate engineering depth rather than simply technology usage.

The final portfolio should communicate:

### Blockchain

"I can design and operate an EVM-compatible permissioned network."

### Distributed Systems

"I understand consensus, validators, failure recovery, networking, and state synchronization."

### Backend

"I can build reliable blockchain-backed APIs."

### Infrastructure

"I can deploy and operate blockchain infrastructure on Linux."

### Observability

"I can monitor and debug distributed systems."

### Smart Contracts

"I understand secure Solidity development."

### DevOps

"I can automate testing and deployment."

---

# 37. Final Portfolio Description

Use something similar to:

> **Enterprise EVM Network — Hyperledger Besu**
>
> Designed and deployed a production-style permissioned EVM blockchain using Hyperledger Besu and QBFT consensus. Built a four-validator network, Solidity smart-contract suite, TypeScript API, PostgreSQL blockchain indexer, lightweight block explorer, monitoring stack, and automated deployment pipeline. Implemented validator failure testing, transaction indexing, RPC security, observability, and infrastructure automation.

Do not copy this blindly. Update it with actual measured results after implementation.

---

# 38. GitHub Repository Quality

Before publishing:

```text
[ ] README complete
[ ] Architecture diagram
[ ] Setup instructions verified
[ ] Deployment instructions verified
[ ] .env.example present
[ ] No secrets committed
[ ] No private keys committed
[ ] Tests passing
[ ] Lint passing
[ ] Typecheck passing
[ ] Docker build passing
[ ] CI passing
[ ] Screenshots added
[ ] Live demo working
[ ] Monitoring working
[ ] Failure tests documented
[ ] Performance results documented
```

Use meaningful commit history.

Avoid one giant:

```text
initial commit
```

Prefer commits such as:

```text
feat: initialize QBFT Besu network
feat: add enterprise token contracts
feat: implement blockchain API
feat: add PostgreSQL indexer
feat: add block explorer
feat: add Prometheus monitoring
feat: add Grafana dashboards
feat: add production deployment
test: validate validator failure recovery
docs: add architecture and deployment guide
```

---

# 39. Development Rules for Cursor

When implementing this project:

1. Do not generate the entire application in one giant step.
2. Build incrementally.
3. Keep modules small and maintainable.
4. Prefer established libraries over custom cryptography/security implementations.
5. Never invent Besu configuration values without checking the official Besu documentation.
6. Never hardcode secrets.
7. Never commit private keys.
8. Use TypeScript strict mode.
9. Add tests as features are implemented.
10. Keep Docker builds reproducible.
11. Use environment variables for deployment-specific configuration.
12. Validate all external input.
13. Use structured logging.
14. Handle blockchain transaction failures explicitly.
15. Make the indexer restart-safe.
16. Make important database writes idempotent.
17. Add health/readiness endpoints.
18. Document architectural decisions.
19. Prefer simple infrastructure over unnecessary complexity.
20. Do not introduce Kubernetes unless explicitly requested.
21. Do not use mock blockchain behavior in the final production deployment.
22. The final demo must interact with a real Besu network.

---

# 40. Implementation Order

Follow this order.

## Stage 1

Create repository and tooling.

```text
contracts
besu
apps/api
apps/indexer
apps/frontend
apps/explorer
docs
monitoring
infrastructure
```

## Stage 2

Build local QBFT network.

Goal:

```text
4 validators
blocks produced
peers connected
```

## Stage 3

Build smart contracts.

Goal:

```text
contracts compiled
tests passing
deployed to local Besu
```

## Stage 4

Build backend.

Goal:

```text
API
blockchain service
transaction service
health endpoints
```

## Stage 5

Build indexer.

Goal:

```text
Besu -> Indexer -> PostgreSQL
```

## Stage 6

Build explorer.

Goal:

```text
Blocks
Transactions
Addresses
Assets
```

## Stage 7

Build monitoring.

Goal:

```text
Besu -> Prometheus -> Grafana
```

## Stage 8

Deploy to cloud.

Goal:

```text
4 live validators
```

## Stage 9

Deploy backend/frontend/indexer.

Goal:

```text
public demo
```

## Stage 10

Security hardening.

Goal:

```text
no unnecessary public RPC
TLS
firewall
secret management
rate limiting
```

## Stage 11

Failure testing.

Goal:

```text
validator failure
validator recovery
indexer restart
backend restart
```

## Stage 12

Performance benchmarking.

Goal:

```text
TPS
latency
block time
indexer latency
```

## Stage 13

Documentation + portfolio.

Goal:

```text
GitHub
Live Demo
Architecture
Technical write-up
Screenshots
Benchmark results
```

---

# 41. Definition of Done

The project is complete only when all of the following are true:

```text
[ ] 4-node QBFT network works locally
[ ] 4-node QBFT network works on cloud
[ ] Validators communicate correctly
[ ] Blocks are produced
[ ] Validator failure test passes
[ ] Validator recovery test passes
[ ] Solidity contracts deployed
[ ] Contract tests pass
[ ] Backend API deployed
[ ] PostgreSQL indexer deployed
[ ] Indexer restart recovery works
[ ] Frontend deployed
[ ] Explorer deployed
[ ] Prometheus deployed
[ ] Grafana deployed
[ ] Alerts configured
[ ] TLS configured
[ ] Firewall configured
[ ] RPC secured
[ ] CI pipeline works
[ ] No secrets in Git
[ ] Documentation complete
[ ] Live demo accessible
[ ] Architecture diagram complete
[ ] Performance benchmark completed
[ ] GitHub README complete
```

---

# 42. First Cursor Task

Do NOT build everything immediately.

Start with:

> "Initialize the repository according to this specification. Create the monorepo structure, package managers/configuration, TypeScript configuration, ESLint/Prettier, basic README, .env.example, Docker Compose skeleton, and a local development plan. Do not implement the application yet."

After that is complete, proceed to:

> "Implement Stage 2: create a real 4-validator Hyperledger Besu QBFT network that runs locally with Docker Compose. Generate the genesis configuration and validator configuration correctly, start all four validators, verify peer connectivity and block production, and document every command and configuration decision."

After Stage 2 works, continue one stage at a time.

---

# 43. Important Principle

The objective is not:

> "I ran Hyperledger Besu."

The objective is:

> "I designed, implemented, deployed, secured, monitored, tested, and documented a real permissioned EVM blockchain network and the applications running on top of it."

That distinction is what makes this a strong portfolio project.
