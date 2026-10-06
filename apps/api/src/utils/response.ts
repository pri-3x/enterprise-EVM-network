import type { ApiError, ApiSuccess, PaginationMeta } from '@besu-net/shared';
import type { AppError } from './errors.js';

export function ok<T>(data: T, meta?: PaginationMeta): ApiSuccess<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function fail(err: AppError): ApiError {
  return {
    success: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
  };
}

export function paginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** JSON.stringify replacer that renders bigint as decimal strings. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}
