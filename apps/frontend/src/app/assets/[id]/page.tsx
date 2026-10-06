import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiRequestError, apiGet } from '@/lib/api';
import { formatTime, short } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface AssetEvent {
  eventType: string;
  txHash: string;
  blockNumber: number;
  fromAddress: string | null;
  toAddress: string | null;
  actor: string | null;
  timestamp: number;
}

interface Asset {
  id: number;
  name: string;
  assetType: string;
  value: string;
  owner: string;
  active: boolean;
  registeredBlock: number;
  updatedBlock: number;
  events: AssetEvent[];
}

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let asset: Asset;
  try {
    asset = (await apiGet<Asset>(`/assets/${id}`)).data;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) notFound();
    throw err;
  }
  const fields: Array<[string, ReactNode]> = [
    ['Name', asset.name],
    ['Type', asset.assetType],
    ['Value', Number(asset.value).toLocaleString('en-US')],
    ['Owner', <Link className="rowlink" href={`/accounts/${asset.owner}`}>{asset.owner}</Link>],
    ['Status', asset.active ? 'active' : 'inactive'],
    ['Registered in block', <Link className="rowlink" href={`/blocks/${asset.registeredBlock}`}>{asset.registeredBlock}</Link>],
    ['Last update block', String(asset.updatedBlock)],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Asset #{asset.id}</h1>
      <div className="card">
        <table className="data">
          <tbody>
            {fields.map(([k, v]) => (
              <tr key={k}><td className="w-56 !font-sans text-ink-500">{k}</td><td className="break-all">{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-semibold">History</h2>
        <table className="data">
          <thead><tr><th>Event</th><th>From</th><th>To</th><th>Actor</th><th>Tx</th><th>Time</th></tr></thead>
          <tbody>
            {(asset.events ?? []).map((e) => (
              <tr key={e.txHash + e.eventType}>
                <td>{e.eventType}</td>
                <td>{short(e.fromAddress)}</td>
                <td>{short(e.toAddress)}</td>
                <td>{short(e.actor)}</td>
                <td><Link className="rowlink" href={`/transactions/${e.txHash}`}>{short(e.txHash)}</Link></td>
                <td>{formatTime(e.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
