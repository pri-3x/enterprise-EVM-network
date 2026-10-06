import {
  Contract,
  JsonRpcProvider,
  Wallet,
  type Block,
  type InterfaceAbi,
  type JsonRpcApiProvider,
  type TransactionReceipt,
  type TransactionResponse,
} from 'ethers';
import { AppError, describeChainError } from '../utils/errors.js';

export interface WaitOptions {
  confirmations: number;
  timeoutMs: number;
}

/**
 * Single place that talks to Besu. Controllers and other services never call
 * ethers directly so RPC behaviour (timeouts, error mapping, method allowlists)
 * stays in one module.
 */
export class BlockchainService {
  constructor(
    readonly provider: JsonRpcApiProvider,
    private readonly expectedChainId: number,
    readonly signer?: Wallet,
  ) {}

  static connect(rpcUrl: string, chainId: number, privateKey?: string): BlockchainService {
    const provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
    const signer = privateKey ? new Wallet(privateKey, provider) : undefined;
    return new BlockchainService(provider, chainId, signer);
  }

  async assertChain(): Promise<void> {
    const net = await this.provider.getNetwork();
    if (Number(net.chainId) !== this.expectedChainId) {
      throw AppError.blockchain(
        `RPC chain id ${net.chainId} does not match configured CHAIN_ID ${this.expectedChainId}`,
      );
    }
  }

  async getLatestBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  async getBlock(numberOrHash: number | string, prefetchTxs = false): Promise<Block | null> {
    return this.provider.getBlock(numberOrHash, prefetchTxs);
  }

  async getTransaction(hash: string): Promise<TransactionResponse | null> {
    return this.provider.getTransaction(hash);
  }

  async getReceipt(hash: string): Promise<TransactionReceipt | null> {
    return this.provider.getTransactionReceipt(hash);
  }

  async getBalance(address: string): Promise<bigint> {
    return this.provider.getBalance(address);
  }

  async getCode(address: string): Promise<string> {
    return this.provider.getCode(address);
  }

  async getNonce(address: string): Promise<number> {
    return this.provider.getTransactionCount(address);
  }

  async getClientVersion(): Promise<string> {
    return this.rpc<string>('web3_clientVersion', []);
  }

  async getPeerCount(): Promise<number> {
    const hex = await this.rpc<string>('net_peerCount', []);
    return parseInt(hex, 16);
  }

  async isSyncing(): Promise<boolean> {
    const result = await this.rpc<false | Record<string, string>>('eth_syncing', []);
    return result !== false;
  }

  async getValidators(block: number | 'latest' = 'latest'): Promise<string[]> {
    const tag = typeof block === 'number' ? `0x${block.toString(16)}` : block;
    return this.rpc<string[]>('qbft_getValidatorsByBlockNumber', [tag]);
  }

  getContract(address: string, abi: InterfaceAbi): Contract {
    return new Contract(address, abi, this.signer ?? this.provider);
  }

  /**
   * Broadcast a signed transaction. Does NOT retry: a retried send can double-spend
   * if the first attempt was actually accepted. Callers persist the hash first.
   */
  async sendTransaction(tx: { to: string; data: string; gasLimit?: bigint }): Promise<TransactionResponse> {
    if (!this.signer) {
      throw AppError.unavailable('Write operations are disabled: DEPLOYER_PRIVATE_KEY is not configured');
    }
    try {
      return await this.signer.sendTransaction({
        to: tx.to,
        data: tx.data,
        gasLimit: tx.gasLimit,
        gasPrice: 0n, // zeroBaseFee network
      });
    } catch (err) {
      throw AppError.blockchain(describeChainError(err));
    }
  }

  /**
   * Wait until the transaction is mined and has `confirmations` blocks on top,
   * or until timeout. A timeout is not a failure — the tx may still land later.
   */
  async waitForConfirmation(
    tx: TransactionResponse,
    opts: WaitOptions,
  ): Promise<{ receipt: TransactionReceipt | null; timedOut: boolean }> {
    try {
      const receipt = await tx.wait(opts.confirmations, opts.timeoutMs);
      return { receipt, timedOut: false };
    } catch (err) {
      const message = describeChainError(err);
      if (/timeout/i.test(message)) return { receipt: null, timedOut: true };
      // Receipt exists but the EVM reverted: surface it as a failed transaction,
      // not as an infrastructure error.
      const receipt = await this.getReceipt(tx.hash).catch(() => null);
      if (receipt && receipt.status === 0) return { receipt, timedOut: false };
      throw AppError.blockchain(message);
    }
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    try {
      return await this.provider.send(method, params);
    } catch (err) {
      throw AppError.blockchain(`${method} failed: ${describeChainError(err)}`);
    }
  }
}
