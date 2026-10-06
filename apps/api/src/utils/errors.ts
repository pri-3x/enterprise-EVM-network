import type { ErrorCode } from '@besu-net/shared';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static invalidRequest(message: string, details?: unknown) {
    return new AppError('INVALID_REQUEST', message, 400, details);
  }
  static notFound(message: string) {
    return new AppError('NOT_FOUND', message, 404);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError('UNAUTHORIZED', message, 401);
  }
  static forbidden(message = 'Forbidden') {
    return new AppError('FORBIDDEN', message, 403);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError('CONFLICT', message, 409, details);
  }
  static blockchain(message: string, details?: unknown) {
    return new AppError('BLOCKCHAIN_ERROR', message, 502, details);
  }
  static txFailed(message: string, details?: unknown) {
    return new AppError('TRANSACTION_FAILED', message, 422, details);
  }
  static unavailable(message: string) {
    return new AppError('SERVICE_UNAVAILABLE', message, 503);
  }
}

/** Extract a human-readable reason from an ethers / RPC error without leaking internals. */
export function describeChainError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { reason?: string; shortMessage?: string; code?: string; message?: string; revert?: { name?: string } };
    if (e.revert?.name) return `reverted: ${e.revert.name}`;
    if (e.reason) return e.reason;
    if (e.shortMessage) return e.shortMessage;
    if (e.message) return e.message.split('\n')[0] ?? 'unknown error';
  }
  return 'unknown blockchain error';
}
