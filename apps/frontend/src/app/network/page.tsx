import { apiGet } from '@/lib/api';
import { formatNumber, formatTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Network {
  name: string;
  chainId: number;
  consensus: string;
  clientVersion: string;
  latestBlock: number;
  latestBlockTimestamp: number;
  blockTimeSeconds: number | null;
  peerCount: number;
  validatorCount: number;
  syncing: boolean;
  gasPrice: string;
}

export default async function NetworkPage() {
  const { data } = await apiGet<Network>('/network');
  const rows: Array<[string, string]> = [
    ['Name', data.name],
    ['Chain ID', String(data.chainId)],
    ['Consensus', data.consensus],
    ['Client', data.clientVersion],
    ['Status', data.syncing ? 'Syncing' : 'Healthy'],
    ['Latest block', formatNumber(data.latestBlock)],
    ['Latest block time', formatTime(data.latestBlockTimestamp)],
    ['Observed block time', data.blockTimeSeconds !== null ? `${data.blockTimeSeconds}s` : '—'],
    ['Validators', String(data.validatorCount)],
    ['Connected peers', String(data.peerCount)],
    ['Min gas price', data.gasPrice],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Network</h1>
      <p className="max-w-2xl text-sm text-ink-500">
        Four Besu validators run QBFT. With N = 3f + 1 the network tolerates one unavailable or Byzantine validator and keeps producing blocks.
      </p>
      <div className="card overflow-hidden">
        <table className="data">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="w-56 !font-sans text-ink-500">{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
