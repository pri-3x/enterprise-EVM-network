/** Shared API response envelope — every endpoint returns exactly one of these shapes. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'BLOCKCHAIN_ERROR'
  | 'TRANSACTION_FAILED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

/** Transaction lifecycle as documented in docs/api.md */
export type TxStatus = 'REQUESTED' | 'SUBMITTED' | 'PENDING' | 'MINED' | 'CONFIRMED' | 'FAILED';

export interface NetworkInfo {
  name: string;
  chainId: number;
  consensus: 'QBFT';
  clientVersion: string;
  latestBlock: number;
  latestBlockTimestamp: number;
  blockTimeSeconds: number | null;
  peerCount: number;
  validatorCount: number;
  syncing: boolean;
  gasPrice: string;
}

export interface BlockSummary {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  gasUsed: string;
  gasLimit: string;
  transactionCount: number;
  size: number | null;
  baseFeePerGas: string | null;
}

export interface TransactionSummary {
  hash: string;
  blockNumber: number | null;
  blockHash: string | null;
  transactionIndex: number | null;
  from: string;
  to: string | null;
  value: string;
  gasLimit: string;
  gasUsed: string | null;
  gasPrice: string | null;
  nonce: number;
  input: string;
  status: 'success' | 'failed' | 'pending' | null;
  contractAddress: string | null;
  timestamp: number | null;
  method: string | null;
}

export interface AccountSummary {
  address: string;
  balance: string;
  tokenBalance: string;
  nonce: number;
  isContract: boolean;
  transactionCount: number;
  assetCount: number;
}

export interface AssetRecord {
  id: number;
  name: string;
  assetType: string;
  value: string;
  owner: string;
  active: boolean;
  registeredBlock: number;
  updatedBlock: number;
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  cap: string;
  paused: boolean;
  transferPolicy: string;
  holders: number;
  transfers: number;
}

export interface ValidatorInfo {
  address: string;
  proposedBlocks: number;
  lastProposedBlock: number | null;
  isActive: boolean;
}

export interface TxSubmissionResult {
  txHash: string;
  status: TxStatus;
  blockNumber: number | null;
  gasUsed: string | null;
  confirmations: number;
  error?: string;
}
