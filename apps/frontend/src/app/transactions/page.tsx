import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { formatTime, short } from '@/lib/format';
import { Pager } from '@/components/Pager';

export const dynamic = 'force-dynamic';

interface Tx {
  hash: string;
  blockNumber: number | null;
  from: string;
  to: string | null;
  method: string | null;
  status: string | null;
  timestamp: number | null;
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Number((await searchParams).page ?? '1') || 1;
  const res = await apiGet<Tx[]>(`/transactions?page=${page}&pageSize=20`);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Transactions</h1>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Hash</th>
              <th>Method</th>
              <th>Block</th>
              <th>From</th>
              <th>To</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {res.data.map((t) => (
              <tr key={t.hash}>
                <td><Link className="rowlink" href={`/transactions/${t.hash}`}>{short(t.hash, 8, 6)}</Link></td>
                <td>{t.method ?? '—'}</td>
                <td>{t.blockNumber !== null ? <Link className="rowlink" href={`/blocks/${t.blockNumber}`}>{t.blockNumber}</Link> : '—'}</td>
                <td><Link className="rowlink" href={`/accounts/${t.from}`}>{short(t.from)}</Link></td>
                <td>{t.to ? <Link className="rowlink" href={`/accounts/${t.to}`}>{short(t.to)}</Link> : 'create'}</td>
                <td>{t.status ?? 'pending'}</td>
                <td>{formatTime(t.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {res.data.length === 0 && <p className="px-3 py-6 text-sm text-ink-500">No transactions indexed yet.</p>}
      </div>
      <Pager page={page} totalPages={res.meta?.totalPages ?? 1} base="/transactions" />
    </div>
  );
}
