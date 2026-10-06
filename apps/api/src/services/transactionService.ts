import { eq } from 'drizzle-orm';
import { submittedTransactions, type Database } from '@besu-net/db';
import type { TxStatus, TxSubmissionResult } from '@besu-net/shared';
import type { TransactionResponse } from 'ethers';
import type { BlockchainService } from '../blockchain/BlockchainService.js';
import type { Metrics } from '../metrics.js';
import { AppError, describeChainError } from '../utils/errors.js';

export interface SubmitRequest {
  operation: string;
  payload: Record<string, unknown>;
  /** Caller-supplied key. A repeat with the same key returns the original result and never re-sends. */
  idempotencyKey?: string;
  /** Builds (does not send) the transaction data. */
  build: () => Promise<{ to: string; data: string }>;
}

/**
 * Transaction lifecycle:
 *
 *   REQUESTED -> SUBMITTED -> PENDING -> MINED -> CONFIRMED
 *                    \                     \
 *                     +-------> FAILED <----+
 *
 * A transaction is never re-broadcast once it has a hash. If confirmation
 * times out the row stays PENDING; a later poll (or the indexer) observes the
 * receipt. Retrying a send that might already be in a block would risk a
 * duplicate state change.
 */
export class TransactionService {
  constructor(
    private readonly db: Database,
    private readonly chain: BlockchainService,
    private readonly confirmations: number,
    private readonly timeoutMs: number,
    private readonly metrics?: Metrics,
  ) {}

  async submit(req: SubmitRequest): Promise<TxSubmissionResult> {
    if (req.idempotencyKey) {
      const existing = await this.findByKey(req.idempotencyKey);
      if (existing) return this.toResult(existing);
    }

    const [row] = await this.db
      .insert(submittedTransactions)
      .values({
        idempotencyKey: req.idempotencyKey ?? null,
        operation: req.operation,
        payload: req.payload,
        status: 'REQUESTED',
      })
      .returning();
    if (!row) throw AppError.unavailable('failed to persist transaction request');

    let tx: TransactionResponse;
    try {
      const built = await req.build();
      await this.update(row.id, { status: 'SUBMITTED', attempts: row.attempts + 1 });
      tx = await this.chain.sendTransaction(built);
    } catch (err) {
      const message = err instanceof AppError ? err.message : describeChainError(err);
      await this.update(row.id, { status: 'FAILED', error: message });
      this.metrics?.txSubmissions.inc({ operation: req.operation, status: 'FAILED' });
      throw err instanceof AppError ? err : AppError.blockchain(message);
    }

    await this.update(row.id, { txHash: tx.hash, status: 'PENDING' });

    const { receipt, timedOut } = await this.chain.waitForConfirmation(tx, {
      confirmations: this.confirmations,
      timeoutMs: this.timeoutMs,
    });

    if (timedOut || !receipt) {
      this.metrics?.txSubmissions.inc({ operation: req.operation, status: 'PENDING' });
      return { txHash: tx.hash, status: 'PENDING', blockNumber: null, gasUsed: null, confirmations: 0 };
    }

    if (receipt.status === 0) {
      await this.update(row.id, {
        status: 'FAILED',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        error: 'execution reverted',
      });
      this.metrics?.txSubmissions.inc({ operation: req.operation, status: 'FAILED' });
      throw AppError.txFailed('Transaction reverted on chain', { txHash: tx.hash });
    }

    const head = await this.chain.getLatestBlockNumber();
    const confs = head - receipt.blockNumber + 1;
    const status: TxStatus = confs >= this.confirmations ? 'CONFIRMED' : 'MINED';
    await this.update(row.id, { status, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed });
    this.metrics?.txSubmissions.inc({ operation: req.operation, status });

    return {
      txHash: tx.hash,
      status,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      confirmations: confs,
    };
  }

  async getByHash(txHash: string) {
    const [row] = await this.db
      .select()
      .from(submittedTransactions)
      .where(eq(submittedTransactions.txHash, txHash))
      .limit(1);
    return row ?? null;
  }

  private async findByKey(key: string) {
    const [row] = await this.db
      .select()
      .from(submittedTransactions)
      .where(eq(submittedTransactions.idempotencyKey, key))
      .limit(1);
    return row ?? null;
  }

  private async update(id: number, patch: Partial<typeof submittedTransactions.$inferInsert>) {
    await this.db
      .update(submittedTransactions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(submittedTransactions.id, id));
  }

  private toResult(row: typeof submittedTransactions.$inferSelect): TxSubmissionResult {
    return {
      txHash: row.txHash ?? '',
      status: row.status as TxStatus,
      blockNumber: row.blockNumber,
      gasUsed: row.gasUsed?.toString() ?? null,
      confirmations: 0,
      ...(row.error ? { error: row.error } : {}),
    };
  }
}
