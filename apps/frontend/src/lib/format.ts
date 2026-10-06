export function short(value: string | null | undefined, head = 6, tail = 4): string {
  if (!value) return '—';
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head + 2)}…${value.slice(-tail)}`;
}

export function formatEth(wei: string | null | undefined): string {
  if (!wei) return '0';
  const v = BigInt(wei);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, '0').slice(0, 4).replace(/0+$/, '');
  return `${whole.toLocaleString('en-US')}${frac ? '.' + frac : ''} ETH`;
}

export function formatToken(units: string | null | undefined, decimals = 18, symbol = 'ENT'): string {
  if (!units) return `0 ${symbol}`;
  const v = BigInt(units);
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, '0').slice(0, 2).replace(/0+$/, '');
  return `${whole.toLocaleString('en-US')}${frac ? '.' + frac : ''} ${symbol}`;
}

export function formatTime(unix: number | null | undefined): string {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleString('en-GB', { hour12: false });
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-US');
}
