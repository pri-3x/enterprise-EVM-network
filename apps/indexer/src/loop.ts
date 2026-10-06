import type { Block, JsonRpcProvider, TransactionReceipt, TransactionResponse } from 'ethers';
import type { Logger } from 'pino';
import type { Database } from '@besu-net/db';
import type { IndexerConfig } from './config.js';
import { indexBlock, readCheckpoint, type IndexableBlock, type IndexableTx } from './store.js';
import type { IndexerMetrics } from './metrics.js';

export async function runLoop(
  db: Database,
  provider: JsonRpcProvider,
  config: IndexerConfig,
  log: Logger,
  metrics: IndexerMetrics,
  signal: AbortSignal,
) {
  const known = new Set(
    [config.contracts.token, config.contracts.registry, config.contracts.policy].filter((a): a is string => !!a),
  );
  let backoff = config.INDEXER_POLL_INTERVAL_MS;

  while (!signal.aborted) {
    try {
      const head = await provider.getBlockNumber();
      const checkpoint = await readCheckpoint(db);
      const next = checkpoint ? checkpoint.block + 1 : config.INDEXER_START_BLOCK;
      metrics.chainHead.set(head);
      metrics.indexedHead.set(checkpoint?.block ?? next - 1);
      metrics.lag.set(Math.max(0, head - (checkpoint?.block ?? next - 1)));

      if (next > head) {
        await sleep(config.INDEXER_POLL_INTERVAL_MS, signal);
        continue;
      }

      const end = Math.min(head, next + config.INDEXER_BATCH_SIZE - 1);
      for (let n = next; n <= end; n++) {
        if (signal.aborted) return;
        const started = Date.now();
        const block = await fetchBlock(provider, n);
        const result = await indexBlock(db, block, config.contracts, known);
        metrics.blocksProcessed.inc();
        log.info(
          {
            event: 'block_processed',
            blockNumber: n,
            transactions: result.transactions,
            logs: result.logs,
            alreadyIndexed: result.alreadyIndexed,
            durationMs: Date.now() - started,
          },
          'block_processed',
        );
      }
      backoff = config.INDEXER_POLL_INTERVAL_MS;
    } catch (err) {
      metrics.errors.inc();
      log.error({ event: 'index_error', err: err instanceof Error ? err.message : String(err) }, 'index_error');
      await sleep(backoff, signal);
      backoff = Math.min(backoff * 2, 30_000);
    }
  }
}

async function fetchBlock(provider: JsonRpcProvider, number: number): Promise<IndexableBlock> {
  const block = await provider.getBlock(number, true);
  if (!block) throw new Error(`block ${number} not found`);
  const txs: IndexableTx[] = [];
  for (const tx of block.prefetchedTransactions) {
    const receipt = await provider.getTransactionReceipt(tx.hash);
    txs.push(toIndexableTx(tx, receipt));
  }
  return toIndexableBlock(block, txs);
}

function toIndexableBlock(block: Block, transactions: IndexableTx[]): IndexableBlock {
  return {
    number: block.number,
    hash: block.hash ?? '',
    parentHash: block.parentHash,
    timestamp: block.timestamp,
    miner: block.miner,
    gasUsed: block.gasUsed,
    gasLimit: block.gasLimit,
    baseFeePerGas: block.baseFeePerGas,
    size: null,
    extraData: block.extraData ?? null,
    transactions,
  };
}

function toIndexableTx(tx: TransactionResponse, receipt: TransactionReceipt | null): IndexableTx {
  return {
    hash: tx.hash,
    index: tx.index,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    gasLimit: tx.gasLimit,
    gasPrice: tx.gasPrice,
    nonce: tx.nonce,
    input: tx.data,
    receipt: receipt
      ? {
          status: receipt.status ?? 0,
          gasUsed: receipt.gasUsed,
          cumulativeGasUsed: receipt.cumulativeGasUsed,
          effectiveGasPrice: receipt.gasPrice,
          contractAddress: receipt.contractAddress,
          logs: receipt.logs.map((log) => ({
            index: log.index,
            address: log.address,
            topics: [...log.topics],
            data: log.data,
          })),
        }
      : null,
  };
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
