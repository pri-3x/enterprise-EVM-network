import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiRequestError, apiGet } from '@/lib/api';
import { formatEth, formatNumber, formatTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Tx {
  hash: string;
  blockNumber: number | null;
  from: string;
  to: string | null;
  value: string;
  gasUsed: string | null;
  gasLimit: string;
  gasPrice: string | null;
  nonce: number;
  status: string | null;
  timestamp: number | null;
  method: string | null;
  contractAddress: string | null;
  input: string;
}

export default async function TransactionPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  let tx: Tx;
  try {
    tx = (await apiGet<Tx>(`/transactions/${hash}`)).data;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) notFound();
    throw err;
  }
  const rows: Array<[string, ReactNode]> = [
    ['Hash', tx.hash],
    ['Status', tx.status ?? 'pending'],
    ['Block', tx.blockNumber !== null ? <Link className="rowlink" href={`/blocks/${tx.blockNumber}`}>{tx.blockNumber}</Link> : 'pending'],
    ['Timestamp', formatTime(tx.timestamp)],
    ['From', <Link className="rowlink" href={`/accounts/${tx.from}`}>{tx.from}</Link>],
    ['To', tx.to ? <Link className="rowlink" href={`/accounts/${tx.to}`}>{tx.to}</Link> : 'Contract creation'],
    ['Value', formatEth(tx.value)],
    ['Method', tx.method ?? '—'],
    ['Nonce', String(tx.nonce)],
    ['Gas used', tx.gasUsed ? formatNumber(tx.gasUsed) : '—'],
    ['Gas limit', formatNumber(tx.gasLimit)],
    ['Contract created', tx.contractAddress ?? '—'],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Transaction</h1>
      <div className="card">
        <table className="data">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="w-48 !font-sans text-ink-500">{k}</td>
                <td className="break-all">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2 className="mb-2 text-sm font-semibold">Input</h2>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-ink-700">{tx.input}</pre>
      </div>
    </div>
  );
}
