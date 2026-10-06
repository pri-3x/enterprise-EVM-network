import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { AppError, describeChainError } from '../src/utils/errors.js';
import { paginationMeta } from '../src/utils/response.js';
import { parse } from '../src/utils/http.js';
import { mintTokenSchema, pageQuerySchema } from '../src/utils/schemas.js';

const baseEnv = {
  RPC_URL: 'http://localhost:8545',
  DATABASE_URL: 'postgresql://besu:besu_dev_password@localhost:5433/besu_network',
  CHAIN_ID: '7117',
};

describe('loadEnv', () => {
  it('applies defaults and treats empty contract addresses as unset', () => {
    const env = loadEnv({ ...baseEnv, TOKEN_CONTRACT_ADDRESS: '' });
    expect(env.CHAIN_ID).toBe(7117);
    expect(env.API_PORT).toBe(4000);
    expect(env.TOKEN_CONTRACT_ADDRESS).toBeUndefined();
  });

  it('rejects a malformed private key', () => {
    expect(() => loadEnv({ ...baseEnv, DEPLOYER_PRIVATE_KEY: 'not-a-key' })).toThrow(/DEPLOYER_PRIVATE_KEY/);
  });

  it('requires a database url', () => {
    expect(() => loadEnv({ RPC_URL: 'http://localhost:8545' })).toThrow(/DATABASE_URL/);
  });
});

describe('request validation', () => {
  it('coerces pagination defaults', () => {
    expect(parse(pageQuerySchema, {})).toEqual({ page: 1, pageSize: 20 });
  });

  it('rejects an oversized page', () => {
    expect(() => parse(pageQuerySchema, { pageSize: 500 })).toThrow(AppError);
  });

  it('rejects a non-numeric mint amount', () => {
    expect(() =>
      parse(mintTokenSchema, { to: '0xfe3b557e8fb62b89f4916b721be55ceb828dbd73', amount: '1.5' }),
    ).toThrow(/validation/i);
  });
});

describe('errors', () => {
  it('maps a reverted call to a short message', () => {
    expect(describeChainError({ revert: { name: 'CapExceeded' }, message: 'long' })).toBe(
      'reverted: CapExceeded',
    );
  });

  it('builds a stable error envelope', () => {
    const body = {
      success: false as const,
      error: { code: 'NOT_FOUND' as const, message: 'missing' },
    };
    const err = AppError.notFound('missing');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe(body.error.code);
  });
});

describe('pagination', () => {
  it('computes total pages', () => {
    expect(paginationMeta(2, 20, 41)).toEqual({ page: 2, pageSize: 20, total: 41, totalPages: 3 });
  });
});
