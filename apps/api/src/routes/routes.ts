import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';
import type { BlockchainService } from '../blockchain/BlockchainService.js';
import type { Metrics } from '../metrics.js';
import type { ReadService } from '../services/readService.js';
import type { TransactionService } from '../services/transactionService.js';
import { ExplorerRepository } from '../repositories/explorerRepository.js';
import type { Database } from '@besu-net/db';
import { ok, paginationMeta } from '../utils/response.js';
import { idempotencyKey, parse, requireWriteKey } from '../utils/http.js';
import {
  addressParamsSchema,
  assetParamsSchema,
  blockParamsSchema,
  mintTokenSchema,
  pageQuerySchema,
  registerAssetSchema,
  transferAssetSchema,
  transferTokenSchema,
  txParamsSchema,
} from '../utils/schemas.js';

export interface RouteDeps {
  env: Env;
  chain: BlockchainService;
  reads: ReadService;
  txs: TransactionService;
  db: Database;
  dbReady: () => Promise<boolean>;
  metrics: Metrics;
  startedAt: number;
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps) {
  const { env, chain, reads, txs, db, startedAt } = deps;
  const repo = new ExplorerRepository(db);
  const guard = requireWriteKey(env.API_WRITE_KEY);

  app.get('/health', async () =>
    ok({ status: 'ok', service: 'api', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) }),
  );

  app.get('/ready', async (_req, reply) => {
    const [dbOk, block] = await Promise.all([
      deps.dbReady(),
      chain.getLatestBlockNumber().catch(() => null),
    ]);
    const ready = dbOk && block !== null;
    return reply.code(ready ? 200 : 503).send(
      ok({ status: ready ? 'ready' : 'not_ready', database: dbOk, rpc: block !== null, latestBlock: block }),
    );
  });

  app.get('/network', async () => {
    const [clientVersion, latest, peers, syncing, validators] = await Promise.all([
      chain.getClientVersion(),
      chain.getBlock('latest'),
      chain.getPeerCount(),
      chain.isSyncing(),
      chain.getValidators(),
    ]);
    if (!latest) throw new Error('no latest block');
    const prev = latest.number > 0 ? await chain.getBlock(latest.number - 1) : null;
    deps.metrics.chainHead.set(latest.number);
    return ok({
      name: env.NETWORK_NAME,
      chainId: env.CHAIN_ID,
      consensus: 'QBFT',
      clientVersion,
      latestBlock: latest.number,
      latestBlockTimestamp: latest.timestamp,
      blockTimeSeconds: prev ? latest.timestamp - prev.timestamp : null,
      peerCount: peers,
      validatorCount: validators.length,
      syncing,
      gasPrice: '0',
    });
  });

  app.get('/network/validators', async () => {
    const validators = await chain.getValidators();
    const stats = await Promise.all(
      validators.map(async (address) => {
        const proposed = await repo.blocksProposedBy(address.toLowerCase());
        return {
          address,
          proposedBlocks: proposed.count,
          lastProposedBlock: proposed.last === null ? null : Number(proposed.last),
          isActive: true,
        };
      }),
    );
    return ok(stats);
  });

  app.get('/blocks', async (req) => {
    const q = parse(pageQuerySchema, req.query);
    const { data, total } = await reads.listBlocks(q.page, q.pageSize);
    return ok(data, paginationMeta(q.page, q.pageSize, total));
  });

  app.get('/blocks/:number', async (req) => {
    const { number } = parse(blockParamsSchema, req.params);
    return ok(await reads.getBlock(number));
  });

  app.get('/blocks/:number/transactions', async (req) => {
    const { number } = parse(blockParamsSchema, req.params);
    return ok(await reads.listTransactionsByBlock(number));
  });

  app.get('/transactions', async (req) => {
    const q = parse(pageQuerySchema, req.query);
    const { data, total } = await reads.listTransactions(q.page, q.pageSize);
    return ok(data, paginationMeta(q.page, q.pageSize, total));
  });

  app.get('/transactions/:hash', async (req) => {
    const { hash } = parse(txParamsSchema, req.params);
    return ok(await reads.getTransaction(hash));
  });

  app.get('/accounts/:address', async (req) => {
    const { address } = parse(addressParamsSchema, req.params);
    return ok(await reads.getAccount(address));
  });

  app.get('/accounts/:address/balance', async (req) => {
    const { address } = parse(addressParamsSchema, req.params);
    const account = await reads.getAccount(address);
    return ok({ address, balance: account.balance, tokenBalance: account.tokenBalance });
  });

  app.get('/accounts/:address/transactions', async (req) => {
    const { address } = parse(addressParamsSchema, req.params);
    const q = parse(pageQuerySchema, req.query);
    const { data, total } = await reads.listTransactions(q.page, q.pageSize, address.toLowerCase());
    return ok(data, paginationMeta(q.page, q.pageSize, total));
  });

  app.get('/assets', async (req) => {
    const q = parse(pageQuerySchema, req.query);
    const owner = typeof (req.query as { owner?: string }).owner === 'string'
      ? parse(addressParamsSchema, { address: (req.query as { owner: string }).owner }).address
      : undefined;
    const { data, total } = await reads.listAssets(q.page, q.pageSize, owner);
    return ok(data, paginationMeta(q.page, q.pageSize, total));
  });

  app.get('/assets/:id', async (req) => {
    const { id } = parse(assetParamsSchema, req.params);
    const [asset, events] = await Promise.all([reads.getAsset(id), reads.assetHistory(id)]);
    return ok({ ...asset, events });
  });

  app.post('/assets', { preHandler: guard }, async (req) => {
    const body = parse(registerAssetSchema, req.body);
    const key = idempotencyKey(req);
    const result = await txs.submit({
      operation: 'asset.register',
      payload: body,
      idempotencyKey: key,
      build: async () => reads.encodeRegistry('registerAsset', [body.name, body.assetType, BigInt(body.value), body.owner]),
    });
    return ok(result);
  });

  app.post('/assets/:id/transfer', { preHandler: guard }, async (req) => {
    const { id } = parse(assetParamsSchema, req.params);
    const body = parse(transferAssetSchema, req.body);
    const result = await txs.submit({
      operation: 'asset.transfer',
      payload: { id, ...body },
      idempotencyKey: idempotencyKey(req),
      build: async () => reads.encodeRegistry('transferAsset', [id, body.to]),
    });
    return ok(result);
  });

  app.get('/token', async () => ok(await reads.tokenInfo()));

  app.post('/token/mint', { preHandler: guard }, async (req) => {
    const body = parse(mintTokenSchema, req.body);
    const result = await txs.submit({
      operation: 'token.mint',
      payload: body,
      idempotencyKey: idempotencyKey(req),
      build: async () => reads.encodeToken('mint', [body.to, BigInt(body.amount)]),
    });
    return ok(result);
  });

  app.post('/token/transfer', { preHandler: guard }, async (req) => {
    const body = parse(transferTokenSchema, req.body);
    const result = await txs.submit({
      operation: 'token.transfer',
      payload: body,
      idempotencyKey: idempotencyKey(req),
      build: async () => reads.encodeToken('transfer', [body.to, BigInt(body.amount)]),
    });
    return ok(result);
  });

  app.get('/metrics', async (_req, reply) => {
    const body = await deps.metrics.registry.metrics();
    return reply.type(deps.metrics.registry.contentType).send(body);
  });
}
