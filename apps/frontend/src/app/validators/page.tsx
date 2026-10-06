import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Validator {
  address: string;
  proposedBlocks: number;
  lastProposedBlock: number | null;
  isActive: boolean;
}

export default async function ValidatorsPage() {
  const { data } = await apiGet<Validator[]>('/network/validators');
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Validators</h1>
      <p className="max-w-2xl text-sm text-ink-500">
        The validator set is encoded in the genesis extraData and enforced by QBFT. Node permissioning only allows the four configured enodes to peer.
      </p>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead>
            <tr><th>#</th><th>Address</th><th>Blocks proposed</th><th>Last block</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.map((v, i) => (
              <tr key={v.address}>
                <td>{i + 1}</td>
                <td><Link className="rowlink" href={`/accounts/${v.address}`}>{v.address}</Link></td>
                <td>{formatNumber(v.proposedBlocks)}</td>
                <td>{v.lastProposedBlock !== null ? <Link className="rowlink" href={`/blocks/${v.lastProposedBlock}`}>{v.lastProposedBlock}</Link> : '—'}</td>
                <td>{v.isActive ? 'active' : 'inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
