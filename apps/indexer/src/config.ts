import { z } from 'zod';

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const schema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CHAIN_ID: z.coerce.number().int().positive().default(7117),
  RPC_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  INDEXER_START_BLOCK: z.coerce.number().int().min(0).default(0),
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().int().min(200).default(1000),
  INDEXER_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(25),
  INDEXER_METRICS_PORT: z.coerce.number().int().default(4100),
  TOKEN_CONTRACT_ADDRESS: address.optional().or(z.literal('')),
  ASSET_REGISTRY_ADDRESS: address.optional().or(z.literal('')),
  PERMISSIONED_TRANSFER_ADDRESS: address.optional().or(z.literal('')),
});

export type IndexerConfig = z.infer<typeof schema> & {
  contracts: { token?: string; registry?: string; policy?: string };
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): IndexerConfig {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid indexer configuration:\n${issues}`);
  }
  const env = parsed.data;
  const clean = (v?: string) => (v && v.length > 0 ? v.toLowerCase() : undefined);
  return {
    ...env,
    contracts: {
      token: clean(env.TOKEN_CONTRACT_ADDRESS),
      registry: clean(env.ASSET_REGISTRY_ADDRESS),
      policy: clean(env.PERMISSIONED_TRANSFER_ADDRESS),
    },
  };
}
