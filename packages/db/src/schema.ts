import {
  pgTable,
  text,
  bigint,
  integer,
  boolean,
  numeric,
  timestamp,
  jsonb,
  serial,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';

/**
 * Idempotency strategy
 * --------------------
 * The indexer may crash at any point between "fetch block" and "save checkpoint".
 * On restart it re-processes from the last checkpoint, so every row it writes
 * must be safe to write twice. We rely on PostgreSQL uniqueness constraints:
 *
 *   blocks.number            PRIMARY KEY
 *   transactions.hash        PRIMARY KEY
 *   *_events (tx_hash, log_index)   UNIQUE   <- a log is uniquely identified by its tx + index
 *
 * and use INSERT ... ON CONFLICT DO NOTHING / DO UPDATE everywhere. Derived
 * tables (token_balances, accounts) are updated in the same DB transaction as
 * the block, so a crash can never leave a half-applied block.
 */

// 256-bit unsigned integers (wei, token amounts) need up to 78 decimal digits.
const uint256 = (name: string) => numeric(name, { precision: 78, scale: 0 });

export const blocks = pgTable(
  'blocks',
  {
    number: bigint('number', { mode: 'number' }).primaryKey(),
    hash: text('hash').notNull(),
    parentHash: text('parent_hash').notNull(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    miner: text('miner').notNull(),
    gasUsed: bigint('gas_used', { mode: 'bigint' }).notNull(),
    gasLimit: bigint('gas_limit', { mode: 'bigint' }).notNull(),
    baseFeePerGas: uint256('base_fee_per_gas'),
    transactionCount: integer('transaction_count').notNull(),
    size: integer('size'),
    extraData: text('extra_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('blocks_hash_idx').on(t.hash),
    index('blocks_timestamp_idx').on(t.timestamp),
    index('blocks_miner_idx').on(t.miner),
  ],
);

export const transactions = pgTable(
  'transactions',
  {
    hash: text('hash').primaryKey(),
    blockNumber: bigint('block_number', { mode: 'number' })
      .notNull()
      .references(() => blocks.number, { onDelete: 'cascade' }),
    blockHash: text('block_hash').notNull(),
    transactionIndex: integer('transaction_index').notNull(),
    fromAddress: text('from_address').notNull(),
    toAddress: text('to_address'),
    value: uint256('value').notNull(),
    gasLimit: bigint('gas_limit', { mode: 'bigint' }).notNull(),
    gasPrice: uint256('gas_price'),
    nonce: bigint('nonce', { mode: 'number' }).notNull(),
    input: text('input').notNull(),
    methodSelector: text('method_selector'),
    methodName: text('method_name'),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('transactions_block_idx').on(t.blockNumber, t.transactionIndex),
    index('transactions_from_idx').on(t.fromAddress),
    index('transactions_to_idx').on(t.toAddress),
    index('transactions_timestamp_idx').on(t.timestamp),
  ],
);

export const transactionReceipts = pgTable('transaction_receipts', {
  txHash: text('tx_hash')
    .primaryKey()
    .references(() => transactions.hash, { onDelete: 'cascade' }),
  status: integer('status').notNull(), // 1 success, 0 failed
  gasUsed: bigint('gas_used', { mode: 'bigint' }).notNull(),
  cumulativeGasUsed: bigint('cumulative_gas_used', { mode: 'bigint' }).notNull(),
  effectiveGasPrice: uint256('effective_gas_price'),
  contractAddress: text('contract_address'),
  logsCount: integer('logs_count').notNull(),
  revertReason: text('revert_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    address: text('address').primaryKey(),
    isContract: boolean('is_contract').notNull().default(false),
    firstSeenBlock: bigint('first_seen_block', { mode: 'number' }).notNull(),
    lastSeenBlock: bigint('last_seen_block', { mode: 'number' }).notNull(),
    transactionCount: integer('transaction_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('accounts_tx_count_idx').on(t.transactionCount)],
);

export const tokenTransfers = pgTable(
  'token_transfers',
  {
    id: serial('id').primaryKey(),
    txHash: text('tx_hash')
      .notNull()
      .references(() => transactions.hash, { onDelete: 'cascade' }),
    logIndex: integer('log_index').notNull(),
    blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
    tokenAddress: text('token_address').notNull(),
    fromAddress: text('from_address').notNull(),
    toAddress: text('to_address').notNull(),
    value: uint256('value').notNull(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('token_transfers_tx_log_idx').on(t.txHash, t.logIndex),
    index('token_transfers_from_idx').on(t.fromAddress),
    index('token_transfers_to_idx').on(t.toAddress),
    index('token_transfers_block_idx').on(t.blockNumber),
  ],
);

export const tokenBalances = pgTable(
  'token_balances',
  {
    tokenAddress: text('token_address').notNull(),
    address: text('address').notNull(),
    balance: uint256('balance').notNull(),
    updatedBlock: bigint('updated_block', { mode: 'number' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.tokenAddress, t.address] }), index('token_balances_balance_idx').on(t.balance)],
);

export const assets = pgTable(
  'assets',
  {
    id: bigint('id', { mode: 'number' }).primaryKey(),
    registryAddress: text('registry_address').notNull(),
    name: text('name').notNull(),
    assetType: text('asset_type').notNull(),
    value: uint256('value').notNull(),
    owner: text('owner').notNull(),
    active: boolean('active').notNull().default(true),
    registeredBlock: bigint('registered_block', { mode: 'number' }).notNull(),
    registeredTxHash: text('registered_tx_hash').notNull(),
    updatedBlock: bigint('updated_block', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('assets_owner_idx').on(t.owner), index('assets_type_idx').on(t.assetType)],
);

export const assetEvents = pgTable(
  'asset_events',
  {
    id: serial('id').primaryKey(),
    assetId: bigint('asset_id', { mode: 'number' }).notNull(),
    eventType: text('event_type').notNull(), // AssetRegistered | AssetUpdated | AssetTransferred | AssetDeactivated | AssetReactivated
    txHash: text('tx_hash')
      .notNull()
      .references(() => transactions.hash, { onDelete: 'cascade' }),
    logIndex: integer('log_index').notNull(),
    blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
    fromAddress: text('from_address'),
    toAddress: text('to_address'),
    actor: text('actor'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('asset_events_tx_log_idx').on(t.txHash, t.logIndex),
    index('asset_events_asset_idx').on(t.assetId),
    index('asset_events_block_idx').on(t.blockNumber),
  ],
);

export const networkEvents = pgTable(
  'network_events',
  {
    id: serial('id').primaryKey(),
    eventType: text('event_type').notNull(), // Paused, Unpaused, RoleGranted, AddressBlocked, Minted, ...
    contractAddress: text('contract_address').notNull(),
    contractName: text('contract_name').notNull(),
    txHash: text('tx_hash')
      .notNull()
      .references(() => transactions.hash, { onDelete: 'cascade' }),
    logIndex: integer('log_index').notNull(),
    blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('network_events_tx_log_idx').on(t.txHash, t.logIndex),
    index('network_events_type_idx').on(t.eventType),
    index('network_events_block_idx').on(t.blockNumber),
  ],
);

export const indexerCheckpoints = pgTable('indexer_checkpoints', {
  id: text('id').primaryKey(), // e.g. "main"
  lastIndexedBlock: bigint('last_indexed_block', { mode: 'number' }).notNull(),
  lastIndexedHash: text('last_indexed_hash').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** API-side record of transactions submitted through POST endpoints (idempotency + lifecycle). */
export const submittedTransactions = pgTable(
  'submitted_transactions',
  {
    id: serial('id').primaryKey(),
    idempotencyKey: text('idempotency_key'),
    operation: text('operation').notNull(), // token.mint | token.transfer | asset.register | asset.transfer
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    txHash: text('tx_hash'),
    status: text('status').notNull(), // REQUESTED | SUBMITTED | PENDING | MINED | CONFIRMED | FAILED
    blockNumber: bigint('block_number', { mode: 'number' }),
    gasUsed: bigint('gas_used', { mode: 'bigint' }),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('submitted_tx_idempotency_idx').on(t.idempotencyKey),
    index('submitted_tx_hash_idx').on(t.txHash),
    index('submitted_tx_status_idx').on(t.status),
  ],
);

export type Block = typeof blocks.$inferSelect;
export type NewBlock = typeof blocks.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionReceipt = typeof transactionReceipts.$inferSelect;
export type NewTransactionReceipt = typeof transactionReceipts.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type TokenTransfer = typeof tokenTransfers.$inferSelect;
export type NewTokenTransfer = typeof tokenTransfers.$inferInsert;
export type TokenBalance = typeof tokenBalances.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type AssetEvent = typeof assetEvents.$inferSelect;
export type NewAssetEvent = typeof assetEvents.$inferInsert;
export type NetworkEvent = typeof networkEvents.$inferSelect;
export type NewNetworkEvent = typeof networkEvents.$inferInsert;
export type IndexerCheckpoint = typeof indexerCheckpoints.$inferSelect;
export type SubmittedTransaction = typeof submittedTransactions.$inferSelect;
export type NewSubmittedTransaction = typeof submittedTransactions.$inferInsert;
