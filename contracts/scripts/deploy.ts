/**
 * Deploys PermissionedTransfer, EnterpriseToken and AssetRegistry, wires the
 * transfer policy into both consumers, and records addresses in
 *   contracts/deployments/<network>.local.json   (git-ignored)
 * It also updates the monorepo root .env (if present) so the API, indexer and
 * frontend pick the addresses up without manual editing.
 *
 *   npm run contracts:deploy            # -> besu network from .env
 *   npx hardhat run scripts/deploy.ts --network localhost
 */
import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_NAME = process.env.TOKEN_NAME ?? 'Enterprise Token';
const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL ?? 'ENT';
const TOKEN_CAP = ethers.parseUnits(process.env.TOKEN_CAP ?? '1000000000', 18);
const ALLOWLIST_ENABLED = (process.env.ALLOWLIST_ENABLED ?? 'false') === 'true';

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No deployer account configured (DEPLOYER_PRIVATE_KEY)');

  const chainId = (await ethers.provider.getNetwork()).chainId;
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`network=${network.name} chainId=${chainId}`);
  console.log(`deployer=${deployer.address} balance=${ethers.formatEther(balance)} ETH`);

  const startBlock = await ethers.provider.getBlockNumber();

  // 1. Transfer policy
  const Policy = await ethers.getContractFactory('PermissionedTransfer');
  const policy = await Policy.deploy(deployer.address, ALLOWLIST_ENABLED);
  await policy.waitForDeployment();
  const policyAddr = await policy.getAddress();
  console.log(`PermissionedTransfer  ${policyAddr}`);

  // 2. Token
  const Token = await ethers.getContractFactory('EnterpriseToken');
  const token = await Token.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_CAP, deployer.address);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`EnterpriseToken       ${tokenAddr}`);

  // 3. Registry
  const Registry = await ethers.getContractFactory('AssetRegistry');
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`AssetRegistry         ${registryAddr}`);

  // 4. Wire policy
  await (await token.setTransferPolicy(policyAddr)).wait();
  await (await registry.setTransferPolicy(policyAddr)).wait();
  console.log('transfer policy wired into token + registry');

  const deployBlock = (await ethers.provider.getBlockNumber()) || startBlock;

  const deployment = {
    network: network.name,
    chainId: Number(chainId),
    deployer: deployer.address,
    deployBlock: startBlock,
    deployedAt: new Date().toISOString(),
    contracts: {
      PermissionedTransfer: policyAddr,
      EnterpriseToken: tokenAddr,
      AssetRegistry: registryAddr,
    },
    lastBlock: deployBlock,
  };

  const outDir = path.resolve(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.local.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log(`wrote ${path.relative(process.cwd(), outFile)}`);

  if (process.env.UPDATE_ENV !== 'false') {
    updateRootEnv({
      TOKEN_CONTRACT_ADDRESS: tokenAddr,
      ASSET_REGISTRY_ADDRESS: registryAddr,
      PERMISSIONED_TRANSFER_ADDRESS: policyAddr,
      CONTRACTS_DEPLOY_BLOCK: String(startBlock),
    });
  }
}

function updateRootEnv(values: Record<string, string>) {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.log('no root .env found; add these to your environment:');
    for (const [k, v] of Object.entries(values)) console.log(`  ${k}=${v}`);
    return;
  }
  let content = fs.readFileSync(envPath, 'utf8');
  for (const [k, v] of Object.entries(values)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    content = re.test(content) ? content.replace(re, `${k}=${v}`) : `${content.trimEnd()}\n${k}=${v}\n`;
  }
  fs.writeFileSync(envPath, content);
  console.log(`updated ${path.relative(process.cwd(), envPath)} with contract addresses`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
