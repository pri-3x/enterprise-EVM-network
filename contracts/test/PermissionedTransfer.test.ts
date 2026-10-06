import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { deployAllFixture, ROLE } from './fixtures';

describe('PermissionedTransfer', () => {
  describe('deployment', () => {
    it('grants admin + compliance roles and sets allowlist mode', async () => {
      const { policy, admin } = await loadFixture(deployAllFixture);
      expect(await policy.hasRole(ROLE.ADMIN, admin.address)).to.equal(true);
      expect(await policy.hasRole(ROLE.COMPLIANCE, admin.address)).to.equal(true);
      expect(await policy.allowlistEnabled()).to.equal(false);
    });

    it('emits AllowlistModeChanged on deploy and rejects zero admin', async () => {
      const Policy = await ethers.getContractFactory('PermissionedTransfer');
      const [admin] = await ethers.getSigners();
      const p = await Policy.deploy(admin.address, true);
      await expect(p.deploymentTransaction())
        .to.emit(p, 'AllowlistModeChanged')
        .withArgs(true, admin.address);
      await expect(Policy.deploy(ethers.ZeroAddress, false)).to.be.revertedWithCustomError(
        Policy,
        'ZeroAddress',
      );
    });
  });

  describe('open mode (allowlist disabled)', () => {
    it('allows arbitrary transfers unless blocked', async () => {
      const { policy, alice, bob } = await loadFixture(deployAllFixture);
      expect(await policy.isTransferAllowed(alice.address, bob.address)).to.equal(true);
      await expect(policy.checkTransfer(alice.address, bob.address, 1n)).to.not.be.reverted;
    });

    it('blocks sender or receiver when blocked', async () => {
      const { policy, admin, alice, bob } = await loadFixture(deployAllFixture);
      await expect(policy.blockAddress(bob.address, 'fraud'))
        .to.emit(policy, 'AddressBlocked')
        .withArgs(bob.address, admin.address, 'fraud');

      expect(await policy.isBlocked(bob.address)).to.equal(true);
      expect(await policy.isTransferAllowed(alice.address, bob.address)).to.equal(false);
      expect(await policy.isTransferAllowed(bob.address, alice.address)).to.equal(false);

      await expect(policy.checkTransfer(alice.address, bob.address, 1n))
        .to.be.revertedWithCustomError(policy, 'TransferBlocked')
        .withArgs(bob.address);
      await expect(policy.checkTransfer(bob.address, alice.address, 1n))
        .to.be.revertedWithCustomError(policy, 'TransferBlocked')
        .withArgs(bob.address);

      await expect(policy.unblockAddress(bob.address))
        .to.emit(policy, 'AddressUnblocked')
        .withArgs(bob.address, admin.address);
      expect(await policy.isTransferAllowed(alice.address, bob.address)).to.equal(true);
    });
  });

  describe('allowlist mode', () => {
    it('requires both parties approved', async () => {
      const { policy, admin, alice, bob } = await loadFixture(deployAllFixture);
      await expect(policy.setAllowlistEnabled(true))
        .to.emit(policy, 'AllowlistModeChanged')
        .withArgs(true, admin.address);

      expect(await policy.isTransferAllowed(alice.address, bob.address)).to.equal(false);
      await expect(policy.checkTransfer(alice.address, bob.address, 1n))
        .to.be.revertedWithCustomError(policy, 'TransferNotApproved')
        .withArgs(alice.address);

      await expect(policy.approveAddress(alice.address))
        .to.emit(policy, 'AddressApproved')
        .withArgs(alice.address, admin.address);
      await expect(policy.checkTransfer(alice.address, bob.address, 1n))
        .to.be.revertedWithCustomError(policy, 'TransferNotApproved')
        .withArgs(bob.address);

      await policy.approveAddress(bob.address);
      expect(await policy.isTransferAllowed(alice.address, bob.address)).to.equal(true);
    });

    it('treats the zero address as approved (mint/burn)', async () => {
      const { policy, alice } = await loadFixture(deployAllFixture);
      await policy.setAllowlistEnabled(true);
      await policy.approveAddress(alice.address);
      expect(await policy.isTransferAllowed(ethers.ZeroAddress, alice.address)).to.equal(true);
      expect(await policy.isTransferAllowed(alice.address, ethers.ZeroAddress)).to.equal(true);
    });

    it('blocked takes precedence over approved', async () => {
      const { policy, alice, bob } = await loadFixture(deployAllFixture);
      await policy.setAllowlistEnabled(true);
      await policy.approveAddresses([alice.address, bob.address]);
      await policy.blockAddress(alice.address, 'x');
      expect(await policy.isTransferAllowed(alice.address, bob.address)).to.equal(false);
      await expect(policy.checkTransfer(alice.address, bob.address, 1n)).to.be.revertedWithCustomError(
        policy,
        'TransferBlocked',
      );
    });

    it('revoke removes approval', async () => {
      const { policy, admin, alice, bob } = await loadFixture(deployAllFixture);
      await policy.setAllowlistEnabled(true);
      await policy.approveAddresses([alice.address, bob.address]);
      await expect(policy.revokeAddress(alice.address))
        .to.emit(policy, 'AddressRevoked')
        .withArgs(alice.address, admin.address);
      expect(await policy.isTransferAllowed(alice.address, bob.address)).to.equal(false);
    });
  });

  describe('access control', () => {
    it('rejects compliance operations from non-compliance accounts', async () => {
      const { policy, mallory, alice } = await loadFixture(deployAllFixture);
      const p = policy.connect(mallory);
      for (const call of [
        p.approveAddress(alice.address),
        p.approveAddresses([alice.address]),
        p.revokeAddress(alice.address),
        p.blockAddress(alice.address, 'x'),
        p.unblockAddress(alice.address),
      ]) {
        await expect(call).to.be.revertedWithCustomError(policy, 'AccessControlUnauthorizedAccount');
      }
    });

    it('only DEFAULT_ADMIN_ROLE may toggle allowlist mode', async () => {
      const { policy, admin, bob } = await loadFixture(deployAllFixture);
      await policy.connect(admin).grantRole(ROLE.COMPLIANCE, bob.address);
      await expect(policy.connect(bob).setAllowlistEnabled(true)).to.be.revertedWithCustomError(
        policy,
        'AccessControlUnauthorizedAccount',
      );
    });
  });

  describe('input validation', () => {
    it('rejects zero address and empty batches', async () => {
      const { policy } = await loadFixture(deployAllFixture);
      await expect(policy.approveAddress(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        policy,
        'ZeroAddress',
      );
      await expect(policy.blockAddress(ethers.ZeroAddress, 'x')).to.be.revertedWithCustomError(
        policy,
        'ZeroAddress',
      );
      await expect(policy.approveAddresses([])).to.be.revertedWithCustomError(policy, 'EmptyBatch');
    });
  });
});
