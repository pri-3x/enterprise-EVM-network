import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { short } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Asset {
  id: number;
  name: string;
  assetType: string;
  value: string;
  owner: string;
  active: boolean;
  registeredBlock: number;
}

export default async function AssetsPage() {
  const res = await apiGet<Asset[]>('/assets?pageSize=50');
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Assets</h1>
      <p className="max-w-2xl text-sm text-ink-500">
        Fictional enterprise assets registered on-chain. Transfers are checked against the permissioned transfer policy before ownership changes.
      </p>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Type</th><th>Value</th><th>Owner</th><th>Status</th><th>Block</th></tr>
          </thead>
          <tbody>
            {res.data.map((a) => (
              <tr key={a.id}>
                <td><Link className="rowlink" href={`/assets/${a.id}`}>{a.id}</Link></td>
                <td className="!font-sans">{a.name}</td>
                <td>{a.assetType}</td>
                <td>{Number(a.value).toLocaleString('en-US')}</td>
                <td><Link className="rowlink" href={`/accounts/${a.owner}`}>{short(a.owner)}</Link></td>
                <td>{a.active ? 'active' : 'inactive'}</td>
                <td><Link className="rowlink" href={`/blocks/${a.registeredBlock}`}>{a.registeredBlock}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {res.data.length === 0 && <p className="px-3 py-6 text-sm text-ink-500">No assets indexed yet.</p>}
      </div>
    </div>
  );
}
