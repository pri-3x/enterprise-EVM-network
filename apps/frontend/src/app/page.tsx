import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { formatNumber, formatTime, short } from '@/lib/format';

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
}

interface TokenInfo {
  symbol: string;
  totalSupply: string;
  decimals: number;
  paused: boolean;
}

interface BlockRow {
  number: number;
  hash: string;
  timestamp: number;
  miner: string;
  transactionCount: number;
  gasUsed: string;
}

export default async function DashboardPage() {
  const [network, token, blocks] = await Promise.all([
    apiGet<Network>('/network'),
    apiGet<TokenInfo>('/token').catch(() => null),
    apiGet<BlockRow[]>('/blocks?pageSize=8'),
  ]);
  const n = network.data;
  const supply = token ? formatSupply(token.data.totalSupply, token.data.decimals, token.data.symbol) : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-accent-700">Live</p>
          <h1 className="text-2xl font-semibold">{n.name}</h1>
          <p className="text-sm text-ink-500">{n.clientVersion}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${n.syncing ? 'bg-amber-100 text-amber-800' : 'bg-accent-100 text-accent-700'}`}>
          {n.syncing ? 'SYNCING' : 'HEALTHY'}
        </span>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Chain ID" value={String(n.chainId)} />
        <Stat label="Consensus" value={n.consensus} />
        <Stat label="Latest block" value={formatNumber(n.latestBlock)} />
        <Stat label="Block time" value={n.blockTimeSeconds !== null ? `~${n.blockTimeSeconds}s` : '—'} />
        <Stat label="Validators" value={String(n.validatorCount)} />
        <Stat label="Peers" value={String(n.peerCount)} />
        <Stat label="Token supply" value={supply} />
        <Stat label="Head time" value={formatTime(n.latestBlockTimestamp)} />
      </section>

      <section className="card overflow-x-auto">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent blocks</h2>
          <Link href="/blocks" className="text-sm text-accent-700 hover:underline">
            View all
          </Link>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Block</th>
              <th>Hash</th>
              <th>Proposer</th>
              <th>Txs</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {blocks.data.map((b) => (
              <tr key={b.number}>
                <td>
                  <Link className="rowlink" href={`/blocks/${b.number}`}>
                    {b.number}
                  </Link>
                </td>
                <td>{short(b.hash)}</td>
                <td>
                  <Link className="rowlink" href={`/accounts/${b.miner}`}>
                    {short(b.miner)}
                  </Link>
                </td>
                <td>{b.transactionCount}</td>
                <td>{formatTime(b.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {blocks.data.length === 0 && <p className="px-3 py-6 text-sm text-ink-500">No blocks indexed yet. The indexer catches up within a few seconds of start.</p>}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value truncate">{value}</div>
    </div>
  );
}

function formatSupply(units: string, decimals: number, symbol: string) {
  const v = BigInt(units);
  const whole = v / 10n ** BigInt(decimals);
  return `${whole.toLocaleString('en-US')} ${symbol}`;
}
