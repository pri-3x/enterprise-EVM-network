import { Interface, type Contract } from 'ethers';
import {
  AssetRegistryAbi,
  EnterpriseTokenAbi,
  KNOWN_METHOD_SELECTORS,
  PermissionedTransferAbi,
  type AssetRecord,
  type BlockSummary,
  type TokenInfo,
  type TransactionSummary,
} from '@besu-net/shared';
import type { Env } from '../config/env.js';
import type { BlockchainService } from '../blockchain/BlockchainService.js';
import type { ExplorerRepository } from '../repositories/explorerRepository.js';
import { AppError } from '../utils/errors.js';

const tokenIface = new Interface(EnterpriseTokenAbi);
const registryIface = new Interface(AssetRegistryAbi);

export class ReadService {
  readonly token: Contract | null;
  readonly registry: Contract | null;
  readonly policy: Contract | null;

  constructor(
    private readonly chain: BlockchainService,
    private readonly repo: ExplorerRepository,
    env: Env,
  ) {
    this.token = env.TOKEN_CONTRACT_ADDRESS
      ? chain.getContract(env.TOKEN_CONTRACT_ADDRESS, EnterpriseTokenAbi)
      : null;
    this.registry = env.ASSET_REGISTRY_ADDRESS
      ? chain.getContract(env.ASSET_REGISTRY_ADDRESS, AssetRegistryAbi)
      : null;
    this.policy = env.PERMISSIONED_TRANSFER_ADDRESS
      ? chain.getContract(env.PERMISSIONED_TRANSFER_ADDRESS, PermissionedTransferAbi)
      : null;
  }

  requireToken(): Contract {
    if (!this.token) throw AppError.unavailable('TOKEN_CONTRACT_ADDRESS is not configured');
    return this.token;
  }

  requireRegistry(): Contract {
    if (!this.registry) throw AppError.unavailable('ASSET_REGISTRY_ADDRESS is not configured');
    return this.registry;
  }

  async listBlocks(page: number, pageSize: number) {
    const { rows, total } = await this.repo.listBlocks(page, pageSize);
    return { data: rows.map(toBlockSummary), total };
  }

  async getBlock(number: number): Promise<BlockSummary> {
    const indexed = await this.repo.getBlock(number);
    if (indexed) return toBlockSummary(indexed);
    const live = await this.chain.getBlock(number);
    if (!live) throw AppError.notFound(`Block ${number} not found`);
    return {
      number: live.number,
      hash: live.hash ?? '',
      parentHash: live.parentHash,
      timestamp: live.timestamp,
      miner: live.miner,
      gasUsed: live.gasUsed.toString(),
      gasLimit: live.gasLimit.toString(),
      transactionCount: live.transactions.length,
      size: null,
      baseFeePerGas: live.baseFeePerGas?.toString() ?? null,
    };
  }

  async listTransactionsByBlock(blockNumber: number) {
    const rows = await this.repo.listTransactionsByBlock(blockNumber);
    return rows.map(({ tx, receipt }) => toTxSummary(tx, receipt));
  }

  async listTransactions(page: number, pageSize: number, address?: string) {
    const { rows, total } = await this.repo.listTransactions(page, pageSize, address);
    return {
      data: rows.map(({ tx, receipt }) => toTxSummary(tx, receipt)),
      total,
    };
  }

  async getTransaction(hash: string): Promise<TransactionSummary> {
    const indexed = await this.repo.getTransaction(hash);
    if (indexed) return toTxSummary(indexed.tx, indexed.receipt);
    const live = await this.chain.getTransaction(hash);
    if (!live) throw AppError.notFound(`Transaction ${hash} not found`);
    const receipt = await this.chain.getReceipt(hash);
    const block = live.blockNumber !== null ? await this.chain.getBlock(live.blockNumber) : null;
    return {
      hash: live.hash,
      blockNumber: live.blockNumber,
      blockHash: live.blockHash,
      transactionIndex: live.index,
      from: live.from,
      to: live.to,
      value: live.value.toString(),
      gasLimit: live.gasLimit.toString(),
      gasUsed: receipt?.gasUsed.toString() ?? null,
      gasPrice: live.gasPrice?.toString() ?? null,
      nonce: live.nonce,
      input: live.data,
      status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
      contractAddress: receipt?.contractAddress ?? null,
      timestamp: block?.timestamp ?? null,
      method: decodeMethod(live.data),
    };
  }

  async getAccount(address: string) {
    const [balance, nonce, code, indexed, tokenRow, assetPage] = await Promise.all([
      this.chain.getBalance(address),
      this.chain.getNonce(address),
      this.chain.getCode(address),
      this.repo.getAccount(address),
      this.token
        ? this.repo.tokenBalance(await this.token.getAddress(), address.toLowerCase())
        : Promise.resolve(null),
      this.repo.listAssets(1, 1, address.toLowerCase()),
    ]);
    return {
      address,
      balance: balance.toString(),
      tokenBalance: tokenRow?.balance ?? '0',
      nonce,
      isContract: code !== '0x',
      transactionCount: indexed?.transactionCount ?? 0,
      assetCount: assetPage.total,
    };
  }

  async listAssets(page: number, pageSize: number, owner?: string) {
    const { rows, total } = await this.repo.listAssets(page, pageSize, owner?.toLowerCase());
    return { data: rows.map(toAsset), total };
  }

  async getAsset(id: number): Promise<AssetRecord> {
    const indexed = await this.repo.getAsset(id);
    if (indexed) return toAsset(indexed);
    // Fall back to the chain for assets the indexer has not reached yet.
    const registry = this.requireRegistry();
    try {
      const a = await registry.getFunction('getAsset')(id);
      return {
        id: Number(a.id),
        name: a.name,
        assetType: a.assetType,
        value: a.value.toString(),
        owner: a.owner,
        active: a.active,
        registeredBlock: 0,
        updatedBlock: 0,
      };
    } catch {
      throw AppError.notFound(`Asset ${id} not found`);
    }
  }

  async assetHistory(id: number) {
    return this.repo.assetEvents(id);
  }

  async tokenInfo(): Promise<TokenInfo> {
    const token = this.requireToken();
    const address = (await token.getAddress()).toLowerCase();
    const call = <T>(fn: string) => token.getFunction(fn)() as Promise<T>;
    const [name, symbol, decimals, totalSupply, cap, paused, policy, holders, transfers] = await Promise.all([
      call<string>('name'),
      call<string>('symbol'),
      call<bigint>('decimals'),
      call<bigint>('totalSupply'),
      call<bigint>('cap'),
      call<boolean>('paused'),
      call<string>('transferPolicy'),
      this.repo.holderCount(address),
      this.repo.transferCount(address),
    ]);
    return {
      address,
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: totalSupply.toString(),
      cap: cap.toString(),
      paused,
      transferPolicy: policy,
      holders,
      transfers,
    };
  }

  encodeToken(fn: 'mint' | 'transfer', args: unknown[]) {
    return { to: this.requireToken().target as string, data: tokenIface.encodeFunctionData(fn, args) };
  }

  encodeRegistry(fn: 'registerAsset' | 'transferAsset', args: unknown[]) {
    return { to: this.requireRegistry().target as string, data: registryIface.encodeFunctionData(fn, args) };
  }
}

function toBlockSummary(b: {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  gasUsed: bigint;
  gasLimit: bigint;
  transactionCount: number;
  size: number | null;
  baseFeePerGas: string | null;
}): BlockSummary {
  return {
    number: b.number,
    hash: b.hash,
    parentHash: b.parentHash,
    timestamp: b.timestamp,
    miner: b.miner,
    gasUsed: b.gasUsed.toString(),
    gasLimit: b.gasLimit.toString(),
    transactionCount: b.transactionCount,
    size: b.size,
    baseFeePerGas: b.baseFeePerGas,
  };
}

function toTxSummary(
  tx: {
    hash: string;
    blockNumber: number;
    blockHash: string;
    transactionIndex: number;
    fromAddress: string;
    toAddress: string | null;
    value: string;
    gasLimit: bigint;
    gasPrice: string | null;
    nonce: number;
    input: string;
    methodName: string | null;
    timestamp: number;
  },
  receipt: { status: number; gasUsed: bigint; contractAddress: string | null } | null,
): TransactionSummary {
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber,
    blockHash: tx.blockHash,
    transactionIndex: tx.transactionIndex,
    from: tx.fromAddress,
    to: tx.toAddress,
    value: tx.value,
    gasLimit: tx.gasLimit.toString(),
    gasUsed: receipt?.gasUsed.toString() ?? null,
    gasPrice: tx.gasPrice,
    nonce: tx.nonce,
    input: tx.input,
    status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : null,
    contractAddress: receipt?.contractAddress ?? null,
    timestamp: tx.timestamp,
    method: tx.methodName,
  };
}

function toAsset(a: {
  id: number;
  name: string;
  assetType: string;
  value: string;
  owner: string;
  active: boolean;
  registeredBlock: number;
  updatedBlock: number;
}): AssetRecord {
  return {
    id: a.id,
    name: a.name,
    assetType: a.assetType,
    value: a.value,
    owner: a.owner,
    active: a.active,
    registeredBlock: a.registeredBlock,
    updatedBlock: a.updatedBlock,
  };
}

export function decodeMethod(input: string): string | null {
  if (!input || input === '0x' || input.length < 10) return null;
  return KNOWN_METHOD_SELECTORS[input.slice(0, 10).toLowerCase()] ?? input.slice(0, 10);
}
