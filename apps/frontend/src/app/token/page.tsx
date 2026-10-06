import { apiGet } from '@/lib/api';
import { formatToken } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  cap: string;
  paused: boolean;
  transferPolicy: string;
  holders: number;
  transfers: number;
}

export default async function TokenPage() {
  const { data } = await apiGet<TokenInfo>('/token');
  const rows: Array<[string, string]> = [
    ['Name', data.name],
    ['Symbol', data.symbol],
    ['Contract', data.address],
    ['Decimals', String(data.decimals)],
    ['Total supply', formatToken(data.totalSupply, data.decimals, data.symbol)],
    ['Cap', formatToken(data.cap, data.decimals, data.symbol)],
    ['Paused', data.paused ? 'yes' : 'no'],
    ['Holders (indexed)', String(data.holders)],
    ['Transfers (indexed)', String(data.transfers)],
    ['Transfer policy', data.transferPolicy],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Enterprise token</h1>
      <p className="max-w-2xl text-sm text-ink-500">
        ERC-20 with minter, burner and pauser roles. When a transfer policy is set, blocked or non-approved accounts cannot send or receive. Mint and burn stay under role control.
      </p>
      <div className="card">
        <table className="data">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><td className="w-56 !font-sans text-ink-500">{k}</td><td className="break-all">{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
