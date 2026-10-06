/**
 * Sends `COUNT` zero-gas transactions from the deployer to itself and reports
 * inclusion latency. Also samples recent block intervals.
 *
 *   npx tsx scripts/benchmark.ts            # 100 txs
 *   COUNT=500 npx tsx scripts/benchmark.ts
 *
 * Results describe this machine only. Do not compare them to a WAN deployment.
 */
import { JsonRpcProvider, Wallet } from 'ethers';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const value = m[2]!.replace(/^"|"$/g, '');
    if (!process.env[m[1]!]) process.env[m[1]!] = value;
  }
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

async function main() {
  loadEnv();
  const count = Number(process.env.COUNT ?? 100);
  const rpc = process.env.RPC_URL ?? 'http://localhost:8545';
  const provider = new JsonRpcProvider(rpc, Number(process.env.CHAIN_ID ?? 7117), { staticNetwork: true });
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error('DEPLOYER_PRIVATE_KEY missing');
  const wallet = new Wallet(key, provider);

  const head = await provider.getBlockNumber();
  const intervals: number[] = [];
  let prev = await provider.getBlock(head - 10);
  for (let n = head - 9; n <= head; n++) {
    const block = await provider.getBlock(n);
    if (prev && block) intervals.push(block.timestamp - prev.timestamp);
    prev = block;
  }

  const started = Date.now();
  const latencies: number[] = [];
  let nonce = await wallet.getNonce();
  const pending: Array<Promise<void>> = [];

  for (let i = 0; i < count; i++) {
    const t0 = Date.now();
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0n,
      gasPrice: 0n,
      gasLimit: 21_000n,
      nonce: nonce++,
    });
    pending.push(
      tx.wait(1, 60_000).then(() => {
        latencies.push(Date.now() - t0);
      }),
    );
    // Keep a small window in flight so we measure inclusion, not just signing.
    if (pending.length >= 25) await pending.shift();
  }
  await Promise.all(pending);
  const elapsed = (Date.now() - started) / 1000;
  latencies.sort((a, b) => a - b);

  const report = {
    machine: 'see docs/performance.md',
    count,
    elapsedSeconds: Number(elapsed.toFixed(2)),
    throughputTps: Number((count / elapsed).toFixed(2)),
    inclusionLatencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
    },
    blockIntervalSeconds: {
      samples: intervals,
      mean: Number((intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(2)),
    },
  };
  console.log(JSON.stringify(report, null, 2));
  provider.destroy();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
