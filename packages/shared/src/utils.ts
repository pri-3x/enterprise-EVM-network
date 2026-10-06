const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export function isAddress(value: string): boolean {
  return ADDRESS_RE.test(value);
}

export function isTxHash(value: string): boolean {
  return HASH_RE.test(value);
}

export function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

/** Convert a hex quantity ("0x1bcd") or decimal string to a number. */
export function toNumber(value: string | number | bigint): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return value.startsWith('0x') ? parseInt(value, 16) : Number(value);
}

export function shortHash(value: string, chars = 6): string {
  if (value.length <= chars * 2 + 2) return value;
  return `${value.slice(0, chars + 2)}…${value.slice(-chars)}`;
}

/** Format a bigint wei/units amount with the given decimals, trimmed to `precision` fraction digits. */
export function formatUnits(value: bigint | string, decimals = 18, precision = 4): string {
  const v = typeof value === 'bigint' ? value : BigInt(value);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, '0').slice(0, precision).replace(/0+$/, '');
  const wholeStr = whole.toLocaleString('en-US');
  return `${negative ? '-' : ''}${wholeStr}${frac ? '.' + frac : ''}`;
}

export const KNOWN_METHOD_SELECTORS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x23b872dd': 'transferFrom',
  '0x095ea7b3': 'approve',
  '0x40c10f19': 'mint',
  '0x9dc29fac': 'burn',
  '0x8456cb59': 'pause',
  '0x3f4ba83a': 'unpause',
  '0x2f2ff15d': 'grantRole',
  '0xd547741f': 'revokeRole',
};
