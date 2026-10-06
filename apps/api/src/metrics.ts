import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export function createMetrics(serviceName: string) {
  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });
  collectDefaultMetrics({ register: registry });

  const httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'HTTP requests handled by the API',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry],
  });

  const httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const rpcLatency = new Histogram({
    name: 'besu_rpc_duration_seconds',
    help: 'Latency of JSON-RPC calls made by the API',
    labelNames: ['method'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [registry],
  });

  const chainHead = new Gauge({
    name: 'besu_chain_head_block',
    help: 'Latest block number observed by the API',
    registers: [registry],
  });

  const txSubmissions = new Counter({
    name: 'tx_submissions_total',
    help: 'Transactions submitted through the API',
    labelNames: ['operation', 'status'] as const,
    registers: [registry],
  });

  return { registry, httpRequests, httpDuration, rpcLatency, chainHead, txSubmissions };
}

export type Metrics = ReturnType<typeof createMetrics>;
