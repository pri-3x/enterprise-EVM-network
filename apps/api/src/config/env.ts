import { z } from 'zod';

const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte hex address');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  CHAIN_ID: z.coerce.number().int().positive().default(7117),
  NETWORK_NAME: z.string().default('Enterprise Besu Network'),
  RPC_URL: z.string().url(),
  WS_RPC_URL: z.string().optional(),

  DATABASE_URL: z.string().min(1),

  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_WRITE_KEY: z.string().min(8, 'API_WRITE_KEY must be at least 8 characters').optional(),
  CORS_ORIGINS: z.string().default('http://localhost:3001'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // Write operations — the key is never logged or returned by any endpoint
  DEPLOYER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hex key')
    .optional(),
  TX_CONFIRMATIONS: z.coerce.number().int().min(1).default(2),
  TX_TIMEOUT_MS: z.coerce.number().int().min(1000).default(60_000),

  TOKEN_CONTRACT_ADDRESS: addressSchema.optional().or(z.literal('')),
  ASSET_REGISTRY_ADDRESS: addressSchema.optional().or(z.literal('')),
  PERMISSIONED_TRANSFER_ADDRESS: addressSchema.optional().or(z.literal('')),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  // Treat empty strings as "not configured"
  for (const key of ['TOKEN_CONTRACT_ADDRESS', 'ASSET_REGISTRY_ADDRESS', 'PERMISSIONED_TRANSFER_ADDRESS'] as const) {
    if (env[key] === '') env[key] = undefined;
  }
  return env;
}

export function corsOrigins(env: Env): string[] | boolean {
  if (env.CORS_ORIGINS === '*') return true;
  return env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
