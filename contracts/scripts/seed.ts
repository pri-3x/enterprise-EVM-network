/**
 * Seeds the deployed contracts with demo data so the dashboard/explorer have
 * something to show: mints tokens to the dev accounts, registers a few assets,
 * performs transfers and approves addresses in the policy.
 *
 *   npm run seed:besu -w contracts
 */
import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// Well-known Besu dev accounts (public keys, never used outside local dev)
const DEV_ACCOUNTS = [
  '0x627306090abaB3A6e1400e9345bC60c78a8BEf57',
  '0xf17f52151EbEF6C7334FAD080c5704D77216b732',
];

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No deployer account configured');

  const depFile = path.resolve(__dirname, '..', 'deployments', `${network.name}.local.json`);
  const dep = fs.existsSync(depFile)
    ? (JSON.parse(fs.readFileSync(depFile, 'utf8')) as { contracts: Record<string, string> })
    : null;

  const tokenAddr = process.env.TOKEN_CONTRACT_ADDRESS || dep?.contracts.EnterpriseToken;
  const registryAddr = process.env.ASSET_REGISTRY_ADDRESS || dep?.contracts.AssetRegistry;
  const policyAddr = process.env.PERMISSIONED_TRANSFER_ADDRESS || dep?.contracts.PermissionedTransfer;
  if (!tokenAddr || !registryAddr || !policyAddr) throw new Error('contract addresses not found; deploy first');

  const token = await ethers.getContractAt('EnterpriseToken', tokenAddr);
  const registry = await ethers.getContractAt('AssetRegistry', registryAddr);
  const policy = await ethers.getContractAt('PermissionedTransfer', policyAddr);

  console.log('approving dev accounts in policy...');
  await (await policy.approveAddresses([deployer.address, ...DEV_ACCOUNTS])).wait();

  console.log('minting tokens...');
  await (await token.mint(deployer.address, ethers.parseUnits('1000000', 18))).wait();
  for (const acct of DEV_ACCOUNTS) {
    await (await token.mint(acct, ethers.parseUnits('250000', 18))).wait();
  }
  await (await token.transfer(DEV_ACCOUNTS[0]!, ethers.parseUnits('1234', 18))).wait();

  console.log('registering assets...');
  const assets: Array<[string, string, bigint, string]> = [
    ['Gas Turbine GT-7', 'EQUIPMENT', 4_500_000n, deployer.address],
    ['Warehouse Lease #221', 'REAL_ESTATE', 1_200_000n, DEV_ACCOUNTS[0]!],
    ['ERP Software Licence', 'LICENSE', 85_000n, DEV_ACCOUNTS[1]!],
    ['Fleet Vehicle VH-104', 'VEHICLE', 42_000n, deployer.address],
    ['Patent US-11,223,344', 'IP', 950_000n, DEV_ACCOUNTS[0]!],
  ];
  for (const [name, type, value, owner] of assets) {
    await (await registry.registerAsset(name, type, value, owner)).wait();
  }

  console.log('transferring asset #4 to dev account 2...');
  await (await registry.transferAsset(4n, DEV_ACCOUNTS[1]!)).wait();

  console.log('updating asset #1 valuation...');
  await (await registry.updateAsset(1n, 'Gas Turbine GT-7', 'EQUIPMENT', 4_650_000n)).wait();

  console.log(`done. totalSupply=${ethers.formatUnits(await token.totalSupply(), 18)} assets=${await registry.totalAssets()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
