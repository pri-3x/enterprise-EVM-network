import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load the monorepo root .env (contracts/ is one level below the root)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const CHAIN_ID = Number(process.env.CHAIN_ID ?? 7117);
const RPC_URL = process.env.RPC_URL ?? 'http://localhost:8545';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Besu 26.x supports Cancun; keep the EVM target explicit so bytecode is
      // reproducible regardless of the compiler default.
      evmVersion: 'cancun',
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    // Local Besu QBFT network started with `docker compose up -d`
    besu: {
      url: RPC_URL,
      chainId: CHAIN_ID,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      // zeroBaseFee network: legacy, zero-priced transactions
      gasPrice: 0,
      gas: 8_000_000,
      timeout: 120_000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
  mocha: {
    timeout: 60_000,
  },
};

export default config;
