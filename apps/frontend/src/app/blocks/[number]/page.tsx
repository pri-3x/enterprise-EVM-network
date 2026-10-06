import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiRequestError, apiGet } from '@/lib/api';
import { formatNumber, formatTime, short } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Block {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  transactionCount: number;
  size: number | null;
  baseFeePerGas: string | null;
}

interface Tx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  method: string | null;
  status: string | null;
}

export default async function BlockPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  let block: Block;
  try {
    block = (await apiGet<Block>(`/blocks/${number}`)).data;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) notFound();
    throw err;
  }
  const inBlock = (await apiGet<Tx[]>(`/blocks/${block.number}/transactions`)).data;

  const fields: Array<[string, string]> = [
    ['Hash', block.hash],
    ['Parent hash', block.parentHash],
    ['Timestamp', formatTime(block.timestamp)],
    ['Proposer', block.miner],
    ['Transactions', String(block.transactionCount)],
    ['Gas used', formatNumber(block.gasUsed)],
    ['Gas limit', formatNumber(block.gasLimit)],
    ['Size', block.size ? `${formatNumber(block.size)} bytes` : '—'],
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Block #{block.number}</h1>
      <div className="card">
        <table className="data">
          <tbody>
            {fields.map(([k, v]) => (
              <tr key={k}>
                <td className="w-48 !font-sans text-ink-500">{k}</td>
                <td className="break-all">
                  {k === 'Proposer' ? <Link className="rowlink" href={`/accounts/${v}`}>{v}</Link> : k === 'Parent hash' ? <Link className="rowlink" href={`/blocks/${block.number - 1}`}>{v}</Link> : v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-semibold">Transactions in this block</h2>
        {inBlock.length === 0 ? (
          <p className="text-sm text-ink-500">No transactions.</p>
        ) : (
          <TxTable rows={inBlock} />
        )}
      </div>
    </div>
  );
}

function TxTable({ rows }: { rows: Tx[] }) {
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Hash</th>
          <th>Method</th>
          <th>From</th>
          <th>To</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.hash}>
            <td><Link className="rowlink" href={`/transactions/${t.hash}`}>{short(t.hash)}</Link></td>
            <td>{t.method ?? '—'}</td>
            <td><Link className="rowlink" href={`/accounts/${t.from}`}>{short(t.from)}</Link></td>
            <td>{t.to ? <Link className="rowlink" href={`/accounts/${t.to}`}>{short(t.to)}</Link> : 'contract create'}</td>
            <td>{t.status ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
