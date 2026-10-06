import { JsonRpcProvider } from 'ethers';
import pino from 'pino';
import { createDb, runMigrations } from '@besu-net/db';
import { loadConfig } from './config.js';
import { runLoop } from './loop.js';
import { createIndexerMetrics, startMetricsServer } from './metrics.js';

async function main() {
  const config = loadConfig();
  const log = pino({
    level: config.LOG_LEVEL,
    base: { service: 'indexer' },
    ...(config.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } } }
      : {}),
  });

  await runMigrations(config.DATABASE_URL);
  const handle = createDb(config.DATABASE_URL);
  const provider = new JsonRpcProvider(config.RPC_URL, config.CHAIN_ID, { staticNetwork: true });
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.CHAIN_ID) {
    throw new Error(`RPC chain id ${network.chainId} != configured ${config.CHAIN_ID}`);
  }

  const metrics = createIndexerMetrics();
  const controller = new AbortController();
  let running = true;
  const server = startMetricsServer(config.INDEXER_METRICS_PORT, metrics, () => running);

  const stop = (signal: string) => {
    log.info({ event: 'shutdown', signal }, 'shutdown');
    running = false;
    controller.abort();
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  log.info({ event: 'indexer_started', chainId: config.CHAIN_ID, startBlock: config.INDEXER_START_BLOCK }, 'indexer_started');
  await runLoop(handle.db, provider, config, log, metrics, controller.signal);

  server.close();
  provider.destroy();
  await handle.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
