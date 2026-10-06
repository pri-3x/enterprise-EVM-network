import { Interface, type LogDescription } from 'ethers';
import { AssetRegistryAbi, EnterpriseTokenAbi, PermissionedTransferAbi } from '@besu-net/shared';

const tokenIface = new Interface(EnterpriseTokenAbi);
const registryIface = new Interface(AssetRegistryAbi);
const policyIface = new Interface(PermissionedTransferAbi);

export type ContractKind = 'token' | 'registry' | 'policy';

export interface DecodedLog {
  kind: ContractKind;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Decode a log against the three application contracts. Returns null for logs
 * we do not recognise (other contracts, anonymous logs) so the indexer stores
 * the transaction regardless and simply skips the event.
 */
export function decodeLog(
  address: string,
  topics: string[],
  data: string,
  contracts: Partial<Record<ContractKind, string>>,
): DecodedLog | null {
  const kind = (Object.entries(contracts) as Array<[ContractKind, string | undefined]>).find(
    ([, addr]) => addr && addr.toLowerCase() === address.toLowerCase(),
  )?.[0];
  if (!kind || topics.length === 0) return null;

  const iface = kind === 'token' ? tokenIface : kind === 'registry' ? registryIface : policyIface;
  let parsed: LogDescription | null;
  try {
    parsed = iface.parseLog({ topics, data });
  } catch {
    return null;
  }
  if (!parsed) return null;
  return { kind, name: parsed.name, args: normalizeArgs(parsed) };
}

/** ethers Result exposes named fields as non-enumerable properties, so walk the ABI inputs. */
function normalizeArgs(parsed: LogDescription): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  parsed.fragment.inputs.forEach((input, i) => {
    const name = input.name && input.name.length > 0 ? input.name : String(i);
    out[name] = normalize(parsed.args[i]);
  });
  return out;
}

function normalize(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(normalize);
  return value;
}

const SELECTORS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x23b872dd': 'transferFrom',
  '0x095ea7b3': 'approve',
  '0x40c10f19': 'mint',
  '0x9dc29fac': 'burn',
  '0x8456cb59': 'pause',
  '0x3f4ba83a': 'unpause',
};

export function methodName(input: string): { selector: string | null; name: string | null } {
  if (!input || input === '0x' || input.length < 10) return { selector: null, name: null };
  const selector = input.slice(0, 10).toLowerCase();
  return { selector, name: SELECTORS[selector] ?? null };
}
