import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Interface } from 'ethers';
import { createDb, runMigrations, blocks, tokenBalances, tokenTransfers, indexerCheckpoints, type DbHandle } from '@besu-net/db';
import { EnterpriseTokenAbi } from '@besu-net/shared';
import { indexBlock, readCheckpoint, type IndexableBlock } from '../src/store.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://besu:besu_dev_password@localhost:5433/besu_network';
const TOKEN = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ALICE = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const BLOCK = 8_000_001;
const TX = '0x' + 'ab'.repeat(32);

const iface = new Interface(EnterpriseTokenAbi);

function transferLog(from: string, to: string, value: bigint) {
  const encoded = iface.encodeEventLog(iface.getEvent('Transfer')!, [from, to, value]);
  return { index: 0, address: TOKEN, topics: [...encoded.topics], data: encoded.data };
}

function block(value: bigint): IndexableBlock {
  return {
    number: BLOCK,
    hash: '0x' + '11'.repeat(32),
    parentHash: '0x' + '22'.repeat(32),
    timestamp: 1_700_000_000,
    miner: '0x' + '33'.repeat(20),
    gasUsed: 21000n,
    gasLimit: 30_000_000n,
    baseFeePerGas: 0n,
    size: 500,
    extraData: '0x',
    transactions: [
      {
        hash: TX,
        index: 0,
        from: ALICE,
        to: TOKEN,
        value: 0n,
        gasLimit: 100000n,
        gasPrice: 0n,
        nonce: 1,
        input: '0x40c10f19',
        receipt: {
          status: 1,
          gasUsed: 50000n,
          cumulativeGasUsed: 50000n,
          effectiveGasPrice: 0n,
          contractAddress: null,
          logs: [transferLog('0x0000000000000000000000000000000000000000', ALICE, value)],
        },
      },
    ],
  };
}

describe('indexBlock idempotency', () => {
  let handle: DbHandle;
  let previous: { block: number; hash: string } | null = null;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL);
    handle = createDb(DATABASE_URL, { max: 2 });
    previous = await readCheckpoint(handle.db);
  });

  afterAll(async () => {
    await handle.db.delete(blocks).where(eq(blocks.number, BLOCK));
    await handle.db.delete(tokenBalances).where(eq(tokenBalances.tokenAddress, TOKEN));
    if (previous) {
      await handle.db
        .update(indexerCheckpoints)
        .set({ lastIndexedBlock: previous.block, lastIndexedHash: previous.hash })
        .where(eq(indexerCheckpoints.id, 'main'));
    } else {
      await handle.db.delete(indexerCheckpoints).where(eq(indexerCheckpoints.id, 'main'));
    }
    await handle.close();
  });

  it('stores a mint once when the same block is indexed twice', async () => {
    const contracts = { token: TOKEN };
    const first = await indexBlock(handle.db, block(1000n), contracts, new Set([TOKEN]));
    const second = await indexBlock(handle.db, block(1000n), contracts, new Set([TOKEN]));

    expect(first.alreadyIndexed).toBe(false);
    expect(first.logs).toBe(1);
    expect(second.alreadyIndexed).toBe(true);

    const transfers = await handle.db.select().from(tokenTransfers).where(eq(tokenTransfers.txHash, TX));
    expect(transfers).toHaveLength(1);

    const [balance] = await handle.db.select().from(tokenBalances).where(eq(tokenBalances.address, ALICE));
    expect(balance?.balance).toBe('1000');
  });
});
