import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { formatEth, formatToken, formatTime, short } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Account {
  address: string;
  balance: string;
  tokenBalance: string;
  nonce: number;
  isContract: boolean;
  transactionCount: number;
  assetCount: number;
}

interface Tx {
  hash: string;
  blockNumber: number | null;
  from: string;
  to: string | null;
  method: string | null;
  status: string | null;
  timestamp: number | null;
}

interface Asset {
  id: number;
  name: string;
  assetType: string;
  active: boolean;
  value: string;
}

export default async function AccountPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const account = (await apiGet<Account>(`/accounts/${address}`)).data;
  const [txs, assets] = await Promise.all([
    apiGet<Tx[]>(`/accounts/${address}/transactions?pageSize=15`),
    apiGet<Asset[]>(`/assets?owner=${address}&pageSize=20`).catch(() => ({ data: [] as Asset[] })),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Address</h1>
        <p className="break-all font-mono text-sm text-ink-700">{account.address}</p>
        {account.isContract && <span className="mt-1 inline-block rounded bg-ink-100 px-2 py-0.5 text-xs">Contract</span>}
      </div>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card"><div className="stat-label">Balance</div><div className="stat-value text-base">{formatEth(account.balance)}</div></div>
        <div className="card"><div className="stat-label">Token balance</div><div className="stat-value text-base">{formatToken(account.tokenBalance)}</div></div>
        <div className="card"><div className="stat-label">Transactions</div><div className="stat-value">{account.transactionCount}</div></div>
        <div className="card"><div className="stat-label">Assets</div><div className="stat-value">{account.assetCount}</div></div>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-semibold">Transactions</h2>
        <table className="data">
          <thead><tr><th>Hash</th><th>Method</th><th>Block</th><th>Direction</th><th>Time</th></tr></thead>
          <tbody>
            {txs.data.map((t) => (
              <tr key={t.hash}>
                <td><Link className="rowlink" href={`/transactions/${t.hash}`}>{short(t.hash)}</Link></td>
                <td>{t.method ?? '—'}</td>
                <td>{t.blockNumber ?? '—'}</td>
                <td>{t.from.toLowerCase() === address.toLowerCase() ? 'out' : 'in'}</td>
                <td>{formatTime(t.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {txs.data.length === 0 && <p className="text-sm text-ink-500">No indexed transactions for this address.</p>}
      </section>
      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-semibold">Asset holdings</h2>
        <table className="data">
          <thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Value</th><th>Active</th></tr></thead>
          <tbody>
            {assets.data.map((a) => (
              <tr key={a.id}>
                <td><Link className="rowlink" href={`/assets/${a.id}`}>{a.id}</Link></td>
                <td className="!font-sans">{a.name}</td>
                <td>{a.assetType}</td>
                <td>{a.value}</td>
                <td>{a.active ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {assets.data.length === 0 && <p className="text-sm text-ink-500">No assets recorded for this address.</p>}
      </section>
    </div>
  );
}
