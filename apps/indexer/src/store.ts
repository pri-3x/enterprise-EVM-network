import { eq, sql } from 'drizzle-orm';
import {
  accounts,
  assetEvents,
  assets,
  blocks,
  indexerCheckpoints,
  networkEvents,
  tokenBalances,
  tokenTransfers,
  transactionReceipts,
  transactions,
  type Database,
} from '@besu-net/db';
import type { DecodedLog } from './decode.js';
import { decodeLog, methodName } from './decode.js';

const ZERO = '0x0000000000000000000000000000000000000000';
const CHECKPOINT_ID = 'main';

export interface IndexableLog {
  index: number;
  address: string;
  topics: string[];
  data: string;
}

export interface IndexableReceipt {
  status: number;
  gasUsed: bigint;
  cumulativeGasUsed: bigint;
  effectiveGasPrice: bigint | null;
  contractAddress: string | null;
  logs: IndexableLog[];
}

export interface IndexableTx {
  hash: string;
  index: number;
  from: string;
  to: string | null;
  value: bigint;
  gasLimit: bigint;
  gasPrice: bigint | null;
  nonce: number;
  input: string;
  receipt: IndexableReceipt | null;
}

export interface IndexableBlock {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  gasUsed: bigint;
  gasLimit: bigint;
  baseFeePerGas: bigint | null;
  size: number | null;
  extraData: string | null;
  transactions: IndexableTx[];
}

export interface IndexerContracts {
  token?: string;
  registry?: string;
  policy?: string;
}

export interface IndexResult {
  blockNumber: number;
  transactions: number;
  logs: number;
  /** True when this block was already committed (restart replay). */
  alreadyIndexed: boolean;
}

/**
 * Persist one block, its transactions, receipts and decoded events.
 *
 * The whole block is one database transaction that ends by advancing the
 * checkpoint. A crash rolls everything back, so the next start re-reads the
 * same block. Unique keys (block number, tx hash, tx_hash+log_index) make a
 * replay that *does* commit twice a no-op: derived balances only move when the
 * source row is newly inserted.
 *
 * QBFT commits are final, so a stored block is never rewritten. If the parent
 * hash does not match the checkpoint we refuse to continue rather than silently
 * fork the index.
 */
export async function indexBlock(
  db: Database,
  block: IndexableBlock,
  contracts: IndexerContracts,
  knownContracts: Set<string>,
): Promise<IndexResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7117)`);

    const [checkpoint] = await tx
      .select()
      .from(indexerCheckpoints)
      .where(eq(indexerCheckpoints.id, CHECKPOINT_ID));
    if (checkpoint && block.number <= checkpoint.lastIndexedBlock) {
      return { blockNumber: block.number, transactions: 0, logs: 0, alreadyIndexed: true };
    }
    if (checkpoint && block.number === checkpoint.lastIndexedBlock + 1 && block.parentHash !== checkpoint.lastIndexedHash) {
      throw new Error(
        `parent hash mismatch at block ${block.number}: index has ${checkpoint.lastIndexedHash}, chain has ${block.parentHash}`,
      );
    }

    const insertedBlock = await tx
      .insert(blocks)
      .values({
        number: block.number,
        hash: block.hash,
        parentHash: block.parentHash,
        timestamp: block.timestamp,
        miner: block.miner.toLowerCase(),
        gasUsed: block.gasUsed,
        gasLimit: block.gasLimit,
        baseFeePerGas: block.baseFeePerGas?.toString() ?? null,
        transactionCount: block.transactions.length,
        size: block.size,
        extraData: block.extraData,
      })
      .onConflictDoNothing()
      .returning({ number: blocks.number });

    const fresh = insertedBlock.length > 0;
    let logs = 0;

    if (fresh) {
      await touchAccount(tx, block.miner, block.number, knownContracts.has(block.miner.toLowerCase()), false);
      for (const item of block.transactions) {
        logs += await indexTransaction(tx, block, item, contracts, knownContracts);
      }
    }

    await tx
      .insert(indexerCheckpoints)
      .values({ id: CHECKPOINT_ID, lastIndexedBlock: block.number, lastIndexedHash: block.hash })
      .onConflictDoUpdate({
        target: indexerCheckpoints.id,
        set: { lastIndexedBlock: block.number, lastIndexedHash: block.hash, updatedAt: new Date() },
      });

    return { blockNumber: block.number, transactions: fresh ? block.transactions.length : 0, logs, alreadyIndexed: !fresh };
  });
}

async function indexTransaction(
  tx: Tx,
  block: IndexableBlock,
  item: IndexableTx,
  contracts: IndexerContracts,
  knownContracts: Set<string>,
): Promise<number> {
  const from = item.from.toLowerCase();
  const to = item.to?.toLowerCase() ?? null;
  const method = methodName(item.input);

  const inserted = await tx
    .insert(transactions)
    .values({
      hash: item.hash,
      blockNumber: block.number,
      blockHash: block.hash,
      transactionIndex: item.index,
      fromAddress: from,
      toAddress: to,
      value: item.value.toString(),
      gasLimit: item.gasLimit,
      gasPrice: item.gasPrice?.toString() ?? null,
      nonce: item.nonce,
      input: item.input,
      methodSelector: method.selector,
      methodName: method.name,
      timestamp: block.timestamp,
    })
    .onConflictDoNothing()
    .returning({ hash: transactions.hash });

  if (inserted.length === 0) return 0;

  await touchAccount(tx, from, block.number, knownContracts.has(from), true);
  if (to) await touchAccount(tx, to, block.number, knownContracts.has(to), true);

  const receipt = item.receipt;
  if (!receipt) return 0;

  await tx.insert(transactionReceipts).values({
    txHash: item.hash,
    status: receipt.status,
    gasUsed: receipt.gasUsed,
    cumulativeGasUsed: receipt.cumulativeGasUsed,
    effectiveGasPrice: receipt.effectiveGasPrice?.toString() ?? null,
    contractAddress: receipt.contractAddress?.toLowerCase() ?? null,
    logsCount: receipt.logs.length,
  });

  let decoded = 0;
  for (const log of receipt.logs) {
    const event = decodeLog(log.address, log.topics, log.data, contracts);
    if (!event) continue;
    await applyEvent(tx, block, item.hash, log.index, log.address.toLowerCase(), event);
    decoded += 1;
  }
  return decoded;
}

async function applyEvent(
  tx: Tx,
  block: IndexableBlock,
  txHash: string,
  logIndex: number,
  contractAddress: string,
  event: DecodedLog,
) {
  if (event.kind === 'token' && event.name === 'Transfer') {
    const from = String(event.args.from).toLowerCase();
    const to = String(event.args.to).toLowerCase();
    const value = String(event.args.value);
    const inserted = await tx
      .insert(tokenTransfers)
      .values({
        txHash,
        logIndex,
        blockNumber: block.number,
        tokenAddress: contractAddress,
        fromAddress: from,
        toAddress: to,
        value,
        timestamp: block.timestamp,
      })
      .onConflictDoNothing()
      .returning({ id: tokenTransfers.id });
    if (inserted.length === 0) return;
    if (from !== ZERO) await addBalance(tx, contractAddress, from, `-${value}`, block.number);
    if (to !== ZERO) await addBalance(tx, contractAddress, to, value, block.number);
    return;
  }

  const assetEvents = new Set([
    'AssetRegistered',
    'AssetUpdated',
    'AssetTransferred',
    'AssetDeactivated',
    'AssetReactivated',
  ]);
  if (event.kind === 'registry' && assetEvents.has(event.name)) {
    const applied = await insertAssetEvent(tx, block, txHash, logIndex, event);
    if (!applied) return;
    await applyAssetState(tx, block, txHash, contractAddress, event);
    return;
  }

  await tx
    .insert(networkEvents)
    .values({
      eventType: event.name,
      contractAddress,
      contractName: event.kind,
      txHash,
      logIndex,
      blockNumber: block.number,
      data: event.args,
      timestamp: block.timestamp,
    })
    .onConflictDoNothing();
}

async function insertAssetEvent(tx: Tx, block: IndexableBlock, txHash: string, logIndex: number, event: DecodedLog) {
  const id = Number(event.args.id);
  const inserted = await tx
    .insert(assetEvents)
    .values({
      assetId: id,
      eventType: event.name,
      txHash,
      logIndex,
      blockNumber: block.number,
      fromAddress: event.args.from ? String(event.args.from).toLowerCase() : null,
      toAddress: event.args.to ? String(event.args.to).toLowerCase() : event.args.owner ? String(event.args.owner).toLowerCase() : null,
      actor: event.args.by ? String(event.args.by).toLowerCase() : event.args.registrar ? String(event.args.registrar).toLowerCase() : null,
      data: event.args,
      timestamp: block.timestamp,
    })
    .onConflictDoNothing()
    .returning({ id: assetEvents.id });
  return inserted.length > 0;
}

async function applyAssetState(
  tx: Tx,
  block: IndexableBlock,
  txHash: string,
  registryAddress: string,
  event: DecodedLog,
) {
  const id = Number(event.args.id);
  if (event.name === 'AssetRegistered') {
    await tx
      .insert(assets)
      .values({
        id,
        registryAddress,
        name: String(event.args.name),
        assetType: String(event.args.assetType),
        value: String(event.args.value),
        owner: String(event.args.owner).toLowerCase(),
        active: true,
        registeredBlock: block.number,
        registeredTxHash: txHash,
        updatedBlock: block.number,
      })
      .onConflictDoNothing();
    return;
  }
  if (event.name === 'AssetUpdated') {
    await tx
      .update(assets)
      .set({
        name: String(event.args.name),
        assetType: String(event.args.assetType),
        value: String(event.args.value),
        updatedBlock: block.number,
        updatedAt: new Date(),
      })
      .where(sql`${assets.id} = ${id}`);
    return;
  }
  if (event.name === 'AssetTransferred') {
    await tx
      .update(assets)
      .set({ owner: String(event.args.to).toLowerCase(), updatedBlock: block.number, updatedAt: new Date() })
      .where(sql`${assets.id} = ${id}`);
    return;
  }
  if (event.name === 'AssetDeactivated' || event.name === 'AssetReactivated') {
    await tx
      .update(assets)
      .set({ active: event.name === 'AssetReactivated', updatedBlock: block.number, updatedAt: new Date() })
      .where(sql`${assets.id} = ${id}`);
  }
}

async function addBalance(tx: Tx, tokenAddress: string, address: string, delta: string, blockNumber: number) {
  await tx
    .insert(tokenBalances)
      .values({ tokenAddress, address, balance: delta, updatedBlock: blockNumber })
    .onConflictDoUpdate({
      target: [tokenBalances.tokenAddress, tokenBalances.address],
      set: {
        balance: sql`${tokenBalances.balance} + ${delta}::numeric`,
        updatedBlock: blockNumber,
        updatedAt: new Date(),
      },
    });
}

async function touchAccount(tx: Tx, address: string, block: number, isContract: boolean, increment: boolean) {
  const addr = address.toLowerCase();
  await tx
    .insert(accounts)
    .values({
      address: addr,
      isContract,
      firstSeenBlock: block,
      lastSeenBlock: block,
      transactionCount: increment ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: accounts.address,
      set: {
        lastSeenBlock: sql`greatest(${accounts.lastSeenBlock}, ${block})`,
        transactionCount: increment ? sql`${accounts.transactionCount} + 1` : accounts.transactionCount,
        isContract: sql`${accounts.isContract} or ${isContract}`,
        updatedAt: new Date(),
      },
    });
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function readCheckpoint(db: Database): Promise<{ block: number; hash: string } | null> {
  const [row] = await db
    .select()
    .from(indexerCheckpoints)
    .where(eq(indexerCheckpoints.id, CHECKPOINT_ID));
  return row ? { block: row.lastIndexedBlock, hash: row.lastIndexedHash } : null;
}
