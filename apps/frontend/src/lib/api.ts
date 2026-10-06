export function apiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiGet<T>(path: string): Promise<ApiSuccess<T>> {
  const res = await fetch(`${apiBase()}${path}`, { cache: 'no-store' });
  const body = (await res.json()) as ApiSuccess<T> | { success: false; error: { message: string } };
  if (!res.ok || !body.success) {
    const message = 'error' in body ? body.error.message : `request failed (${res.status})`;
    throw new ApiRequestError(message, res.status);
  }
  return body;
}
