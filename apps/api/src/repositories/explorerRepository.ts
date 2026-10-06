import { and, desc, eq, or, sql, count } from 'drizzle-orm';
import {
  accounts,
  assetEvents,
  assets,
  blocks,
  networkEvents,
  tokenBalances,
  tokenTransfers,
  transactionReceipts,
  transactions,
  type Database,
} from '@besu-net/db';

export class ExplorerRepository {
  constructor(private readonly db: Database) {}

  async listBlocks(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const [rows, totalRow] = await Promise.all([
      this.db.select().from(blocks).orderBy(desc(blocks.number)).limit(pageSize).offset(offset),
      this.db.select({ value: count() }).from(blocks),
    ]);
    return { rows, total: totalRow[0]?.value ?? 0 };
  }

  async getBlock(number: number) {
    const [row] = await this.db.select().from(blocks).where(eq(blocks.number, number)).limit(1);
    return row ?? null;
  }

  async listTransactions(page: number, pageSize: number, address?: string) {
    const offset = (page - 1) * pageSize;
    const where = address
      ? or(eq(transactions.fromAddress, address), eq(transactions.toAddress, address))
      : undefined;
    const [rows, totalRow] = await Promise.all([
      this.db
        .select({
          tx: transactions,
          receipt: transactionReceipts,
        })
        .from(transactions)
        .leftJoin(transactionReceipts, eq(transactionReceipts.txHash, transactions.hash))
        .where(where)
        .orderBy(desc(transactions.blockNumber), desc(transactions.transactionIndex))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(transactions).where(where),
    ]);
    return { rows, total: totalRow[0]?.value ?? 0 };
  }

  async listTransactionsByBlock(blockNumber: number) {
    const rows = await this.db
      .select({ tx: transactions, receipt: transactionReceipts })
      .from(transactions)
      .leftJoin(transactionReceipts, eq(transactionReceipts.txHash, transactions.hash))
      .where(eq(transactions.blockNumber, blockNumber))
      .orderBy(transactions.transactionIndex);
    return rows;
  }

  async getTransaction(hash: string) {
    const [row] = await this.db
      .select({ tx: transactions, receipt: transactionReceipts })
      .from(transactions)
      .leftJoin(transactionReceipts, eq(transactionReceipts.txHash, transactions.hash))
      .where(eq(transactions.hash, hash))
      .limit(1);
    return row ?? null;
  }

  async getAccount(address: string) {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.address, address)).limit(1);
    return row ?? null;
  }

  async tokenBalance(tokenAddress: string, address: string) {
    const [row] = await this.db
      .select()
      .from(tokenBalances)
      .where(and(eq(tokenBalances.tokenAddress, tokenAddress), eq(tokenBalances.address, address)))
      .limit(1);
    return row ?? null;
  }

  async holderCount(tokenAddress: string) {
    const [row] = await this.db
      .select({ value: count() })
      .from(tokenBalances)
      .where(and(eq(tokenBalances.tokenAddress, tokenAddress), sql`${tokenBalances.balance} > 0`));
    return row?.value ?? 0;
  }

  async transferCount(tokenAddress: string) {
    const [row] = await this.db
      .select({ value: count() })
      .from(tokenTransfers)
      .where(eq(tokenTransfers.tokenAddress, tokenAddress));
    return row?.value ?? 0;
  }

  async listAssets(page: number, pageSize: number, owner?: string) {
    const offset = (page - 1) * pageSize;
    const where = owner ? eq(assets.owner, owner) : undefined;
    const [rows, totalRow] = await Promise.all([
      this.db.select().from(assets).where(where).orderBy(desc(assets.id)).limit(pageSize).offset(offset),
      this.db.select({ value: count() }).from(assets).where(where),
    ]);
    return { rows, total: totalRow[0]?.value ?? 0 };
  }

  async getAsset(id: number) {
    const [row] = await this.db.select().from(assets).where(eq(assets.id, id)).limit(1);
    return row ?? null;
  }

  async assetEvents(assetId: number) {
    return this.db
      .select()
      .from(assetEvents)
      .where(eq(assetEvents.assetId, assetId))
      .orderBy(desc(assetEvents.blockNumber));
  }

  async recentNetworkEvents(limit = 20) {
    return this.db.select().from(networkEvents).orderBy(desc(networkEvents.blockNumber)).limit(limit);
  }

  async blocksProposedBy(miner: string) {
    const [row] = await this.db
      .select({ value: count(), last: sql<number>`max(${blocks.number})` })
      .from(blocks)
      .where(eq(blocks.miner, miner));
    return { count: row?.value ?? 0, last: row?.last ?? null };
  }

  async indexedHead(): Promise<number | null> {
    const [row] = await this.db.select({ n: sql<number>`max(${blocks.number})` }).from(blocks);
    return row?.n ?? null;
  }
}
