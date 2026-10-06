import { createDb, runMigrations } from '@besu-net/db';
import { BlockchainService } from './blockchain/BlockchainService.js';
import { loadEnv } from './config/env.js';
import { createMetrics } from './metrics.js';
import { ExplorerRepository } from './repositories/explorerRepository.js';
import { ReadService } from './services/readService.js';
import { TransactionService } from './services/transactionService.js';
import { buildApp } from './app.js';

async function main() {
  const env = loadEnv();
  const handle = createDb(env.DATABASE_URL);
  await runMigrations(env.DATABASE_URL);

  const chain = BlockchainService.connect(env.RPC_URL, env.CHAIN_ID, env.DEPLOYER_PRIVATE_KEY);
  await chain.assertChain();

  const metrics = createMetrics('api');
  const reads = new ReadService(chain, new ExplorerRepository(handle.db), env);
  const txs = new TransactionService(handle.db, chain, env.TX_CONFIRMATIONS, env.TX_TIMEOUT_MS, metrics);

  const app = await buildApp(env, {
    chain,
    reads,
    txs,
    db: handle.db,
    dbReady: () => handle.ping(),
    metrics,
    startedAt: Date.now(),
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting_down');
    await app.close();
    await handle.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
