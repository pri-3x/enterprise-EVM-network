import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';
import http from 'node:http';

export function createIndexerMetrics() {
  const registry = new Registry();
  registry.setDefaultLabels({ service: 'indexer' });
  collectDefaultMetrics({ register: registry });

  const blocksProcessed = new Counter({
    name: 'indexer_blocks_processed_total',
    help: 'Blocks committed by the indexer',
    registers: [registry],
  });
  const errors = new Counter({
    name: 'indexer_errors_total',
    help: 'Indexer loop errors',
    registers: [registry],
  });
  const chainHead = new Gauge({
    name: 'indexer_chain_head_block',
    help: 'Latest block on the node',
    registers: [registry],
  });
  const indexedHead = new Gauge({
    name: 'indexer_last_indexed_block',
    help: 'Last block committed to PostgreSQL',
    registers: [registry],
  });
  const lag = new Gauge({
    name: 'indexer_lag_blocks',
    help: 'Blocks the indexer is behind the chain head',
    registers: [registry],
  });

  return { registry, blocksProcessed, errors, chainHead, indexedHead, lag };
}

export type IndexerMetrics = ReturnType<typeof createIndexerMetrics>;

export function startMetricsServer(port: number, metrics: IndexerMetrics, healthy: () => boolean) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      const ok = healthy();
      res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { status: ok ? 'ok' : 'stopping', service: 'indexer' } }));
      return;
    }
    if (req.url === '/metrics') {
      res.writeHead(200, { 'content-type': metrics.registry.contentType });
      res.end(await metrics.registry.metrics());
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port);
  return server;
}
