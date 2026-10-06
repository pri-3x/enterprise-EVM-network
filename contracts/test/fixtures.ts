import { ethers } from 'hardhat';

export const CAP = ethers.parseUnits('1000000000', 18); // 1B tokens

export async function deployAllFixture() {
  const [admin, minter, pauser, alice, bob, carol, mallory] = await ethers.getSigners();

  const Policy = await ethers.getContractFactory('PermissionedTransfer');
  const policy = await Policy.deploy(admin.address, false);

  const Token = await ethers.getContractFactory('EnterpriseToken');
  const token = await Token.deploy('Enterprise Token', 'ENT', CAP, admin.address);

  const Registry = await ethers.getContractFactory('AssetRegistry');
  const registry = await Registry.deploy(admin.address);

  return { admin, minter, pauser, alice, bob, carol, mallory, policy, token, registry };
}

export const ROLE = {
  ADMIN: ethers.ZeroHash,
  MINTER: ethers.id('MINTER_ROLE'),
  BURNER: ethers.id('BURNER_ROLE'),
  PAUSER: ethers.id('PAUSER_ROLE'),
  REGISTRAR: ethers.id('REGISTRAR_ROLE'),
  COMPLIANCE: ethers.id('COMPLIANCE_ROLE'),
};
