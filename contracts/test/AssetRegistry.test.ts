import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { deployAllFixture, ROLE } from './fixtures';

describe('AssetRegistry', () => {
  describe('deployment', () => {
    it('starts empty and grants roles to admin', async () => {
      const { registry, admin } = await loadFixture(deployAllFixture);
      expect(await registry.totalAssets()).to.equal(0n);
      expect(await registry.hasRole(ROLE.REGISTRAR, admin.address)).to.equal(true);
      expect(await registry.hasRole(ROLE.PAUSER, admin.address)).to.equal(true);
    });

    it('rejects zero admin', async () => {
      const Registry = await ethers.getContractFactory('AssetRegistry');
      await expect(Registry.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        Registry,
        'ZeroAddress',
      );
    });
  });

  describe('registerAsset', () => {
    it('registers with sequential ids and emits AssetRegistered', async () => {
      const { registry, admin, alice } = await loadFixture(deployAllFixture);
      await expect(registry.registerAsset('Turbine A', 'EQUIPMENT', 5_000_000n, alice.address))
        .to.emit(registry, 'AssetRegistered')
        .withArgs(1n, alice.address, 'Turbine A', 'EQUIPMENT', 5_000_000n, admin.address);

      await registry.registerAsset('Turbine B', 'EQUIPMENT', 6_000_000n, alice.address);
      expect(await registry.totalAssets()).to.equal(2n);
      expect(await registry.balanceOf(alice.address)).to.equal(2n);

      const a = await registry.getAsset(1n);
      expect(a.id).to.equal(1n);
      expect(a.name).to.equal('Turbine A');
      expect(a.assetType).to.equal('EQUIPMENT');
      expect(a.value).to.equal(5_000_000n);
      expect(a.owner).to.equal(alice.address);
      expect(a.active).to.equal(true);
      expect(a.createdAt).to.be.gt(0n);
    });

    it('rejects unauthorized registration', async () => {
      const { registry, mallory } = await loadFixture(deployAllFixture);
      await expect(
        registry.connect(mallory).registerAsset('x', 'y', 1n, mallory.address),
      ).to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
    });

    it('validates input', async () => {
      const { registry, alice } = await loadFixture(deployAllFixture);
      await expect(registry.registerAsset('x', 'y', 1n, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        registry,
        'ZeroAddress',
      );
      await expect(registry.registerAsset('', 'y', 1n, alice.address))
        .to.be.revertedWithCustomError(registry, 'EmptyString')
        .withArgs('name');
      await expect(registry.registerAsset('x', '', 1n, alice.address))
        .to.be.revertedWithCustomError(registry, 'EmptyString')
        .withArgs('assetType');
    });
  });

  describe('updateAsset', () => {
    it('updates fields and emits AssetUpdated', async () => {
      const { registry, admin, alice } = await loadFixture(deployAllFixture);
      await registry.registerAsset('Old', 'EQUIPMENT', 1n, alice.address);
      await expect(registry.updateAsset(1n, 'New', 'LICENSE', 42n))
        .to.emit(registry, 'AssetUpdated')
        .withArgs(1n, 'New', 'LICENSE', 42n, admin.address);
      const a = await registry.getAsset(1n);
      expect(a.name).to.equal('New');
      expect(a.assetType).to.equal('LICENSE');
      expect(a.value).to.equal(42n);
    });

    it('rejects update of unknown or inactive asset', async () => {
      const { registry, alice } = await loadFixture(deployAllFixture);
      await expect(registry.updateAsset(99n, 'a', 'b', 1n))
        .to.be.revertedWithCustomError(registry, 'AssetNotFound')
        .withArgs(99n);
      await registry.registerAsset('x', 'y', 1n, alice.address);
      await registry.deactivateAsset(1n, 'retired');
      await expect(registry.updateAsset(1n, 'a', 'b', 1n))
        .to.be.revertedWithCustomError(registry, 'AssetInactive')
        .withArgs(1n);
    });

    it('rejects update by non-registrar (even owner)', async () => {
      const { registry, alice } = await loadFixture(deployAllFixture);
      await registry.registerAsset('x', 'y', 1n, alice.address);
      await expect(
        registry.connect(alice).updateAsset(1n, 'a', 'b', 1n),
      ).to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('transferAsset', () => {
    it('owner can transfer; balances and event are correct', async () => {
      const { registry, alice, bob } = await loadFixture(deployAllFixture);
      await registry.registerAsset('x', 'y', 1n, alice.address);
      await expect(registry.connect(alice).transferAsset(1n, bob.address))
        .to.emit(registry, 'AssetTransferred')
        .withArgs(1n, alice.address, bob.address, alice.address);
      expect((await registry.getAsset(1n)).owner).to.equal(bob.address);
      expect(await registry.balanceOf(alice.address)).to.equal(0n);
      expect(await registry.balanceOf(bob.address)).to.equal(1n);
    });

    it('registrar can transfer on behalf of owner', async () => {
      const { registry, admin, alice, bob } = await loadFixture(deployAllFixture);
      await registry.registerAsset('x', 'y', 1n, alice.address);
      await expect(registry.connect(admin).transferAsset(1n, bob.address))
        .to.emit(registry, 'AssetTransferred')
        .withArgs(1n, alice.address, bob.address, admin.address);
    });

    it('rejects transfer by third party, to zero, to same owner, of inactive asset', async () => {
      const { registry, alice, bob, mallory } = await loadFixture(deployAllFixture);
      await registry.registerAsset('x', 'y', 1n, alice.address);
      await expect(registry.connect(mallory).transferAsset(1n, bob.address))
        .to.be.revertedWithCustomError(registry, 'NotAuthorized')
        .withArgs(mallory.address, 1n);
      await expect(
        registry.connect(alice).transferAsset(1n, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(registry, 'ZeroAddress');
      await expect(registry.connect(alice).transferAsset(1n, alice.address))
        .to.be.revertedWithCustomError(registry, 'SameOwner')
        .withArgs(alice.address);
      await registry.deactivateAsset(1n, 'r');
      await expect(
        registry.connect(alice).transferAsset(1n, bob.address),
      ).to.be.revertedWithCustomError(registry, 'AssetInactive');
    });

    it('enforces the transfer policy when configured', async () => {
      const { registry, policy, alice, bob } = await loadFixture(deployAllFixture);
      await registry.setTransferPolicy(await policy.getAddress());
      await registry.registerAsset('x', 'y', 1n, alice.address);
      await policy.blockAddress(bob.address, 'kyc failed');
      await expect(registry.connect(alice).transferAsset(1n, bob.address))
        .to.be.revertedWithCustomError(policy, 'TransferBlocked')
        .withArgs(bob.address);
    });
  });

  describe('deactivate / reactivate', () => {
    it('deactivates with reason and reactivates', async () => {
      const { registry, admin, alice } = await loadFixture(deployAllFixture);
      await registry.registerAsset('x', 'y', 1n, alice.address);
      await expect(registry.deactivateAsset(1n, 'decommissioned'))
        .to.emit(registry, 'AssetDeactivated')
        .withArgs(1n, admin.address, 'decommissioned');
      expect((await registry.getAsset(1n)).active).to.equal(false);
      await expect(registry.deactivateAsset(1n, 'again')).to.be.revertedWithCustomError(
        registry,
        'AssetInactive',
      );
      await expect(registry.reactivateAsset(1n))
        .to.emit(registry, 'AssetReactivated')
        .withArgs(1n, admin.address);
      await expect(registry.reactivateAsset(1n)).to.be.revertedWithCustomError(
        registry,
        'AssetAlreadyActive',
      );
    });

    it('rejects unauthorized deactivation', async () => {
      const { registry, alice } = await loadFixture(deployAllFixture);
      await registry.registerAsset('x', 'y', 1n, alice.address);
      await expect(
        registry.connect(alice).deactivateAsset(1n, 'nope'),
      ).to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('pausing', () => {
    it('blocks mutations while paused', async () => {
      const { registry, alice, bob } = await loadFixture(deployAllFixture);
      await registry.registerAsset('x', 'y', 1n, alice.address);
      await registry.pause();
      await expect(
        registry.registerAsset('x', 'y', 1n, alice.address),
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause');
      await expect(
        registry.connect(alice).transferAsset(1n, bob.address),
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause');
      // reads still work
      expect((await registry.getAsset(1n)).owner).to.equal(alice.address);
      await registry.unpause();
      await registry.connect(alice).transferAsset(1n, bob.address);
    });
  });

  describe('views', () => {
    it('getAsset reverts for unknown id; exists() reflects state', async () => {
      const { registry, alice } = await loadFixture(deployAllFixture);
      await expect(registry.getAsset(1n)).to.be.revertedWithCustomError(registry, 'AssetNotFound');
      expect(await registry.exists(1n)).to.equal(false);
      await registry.registerAsset('x', 'y', 1n, alice.address);
      expect(await registry.exists(1n)).to.equal(true);
    });
  });
});
