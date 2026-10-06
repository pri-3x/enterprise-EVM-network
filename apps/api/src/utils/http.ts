import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeAny } from 'zod';
import { AppError } from './errors.js';

export function parse<T extends ZodTypeAny>(schema: T, value: unknown): T['_output'] {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw AppError.invalidRequest('Request validation failed', result.error.flatten());
  }
  return result.data;
}

/** Requires the X-API-Key header to match API_WRITE_KEY. Absent key disables writes entirely. */
export function requireWriteKey(expected: string | undefined) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (!expected) {
      throw AppError.unavailable('Write endpoints are disabled: API_WRITE_KEY is not configured');
    }
    const provided = request.headers['x-api-key'];
    if (typeof provided !== 'string' || provided.length === 0) {
      throw AppError.unauthorized('Missing X-API-Key header');
    }
    if (!timingSafeEqual(provided, expected)) {
      throw AppError.unauthorized('Invalid API key');
    }
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function idempotencyKey(request: FastifyRequest): string | undefined {
  const header = request.headers['idempotency-key'];
  if (header === undefined) return undefined;
  if (typeof header !== 'string' || header.length < 8 || header.length > 128) {
    throw AppError.invalidRequest('Idempotency-Key must be between 8 and 128 characters');
  }
  return header;
}

export type App = FastifyInstance;
