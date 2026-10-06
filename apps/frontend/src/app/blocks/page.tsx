import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { formatNumber, formatTime, short } from '@/lib/format';
import { Pager } from '@/components/Pager';

export const dynamic = 'force-dynamic';

interface BlockRow {
  number: number;
  hash: string;
  timestamp: number;
  miner: string;
  transactionCount: number;
  gasUsed: string;
  gasLimit: string;
}

export default async function BlocksPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Number((await searchParams).page ?? '1') || 1;
  const res = await apiGet<BlockRow[]>(`/blocks?page=${page}&pageSize=20`);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Blocks</h1>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead>
            <tr>
              <th>Number</th>
              <th>Hash</th>
              <th>Proposer</th>
              <th>Txs</th>
              <th>Gas used</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {res.data.map((b) => (
              <tr key={b.number}>
                <td>
                  <Link className="rowlink" href={`/blocks/${b.number}`}>{b.number}</Link>
                </td>
                <td>{short(b.hash, 8, 6)}</td>
                <td>
                  <Link className="rowlink" href={`/accounts/${b.miner}`}>{short(b.miner)}</Link>
                </td>
                <td>{b.transactionCount}</td>
                <td>{formatNumber(b.gasUsed)}</td>
                <td>{formatTime(b.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={res.meta?.totalPages ?? 1} base="/blocks" />
    </div>
  );
}
