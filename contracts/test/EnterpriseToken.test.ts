import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { deployAllFixture, ROLE, CAP } from './fixtures';

const ONE = ethers.parseUnits('1', 18);

describe('EnterpriseToken', () => {
  describe('deployment', () => {
    it('sets name, symbol, cap and zero supply', async () => {
      const { token } = await loadFixture(deployAllFixture);
      expect(await token.name()).to.equal('Enterprise Token');
      expect(await token.symbol()).to.equal('ENT');
      expect(await token.decimals()).to.equal(18);
      expect(await token.cap()).to.equal(CAP);
      expect(await token.totalSupply()).to.equal(0n);
    });

    it('grants all roles to the admin', async () => {
      const { token, admin } = await loadFixture(deployAllFixture);
      for (const role of [ROLE.ADMIN, ROLE.MINTER, ROLE.BURNER, ROLE.PAUSER]) {
        expect(await token.hasRole(role, admin.address)).to.equal(true);
      }
    });

    it('rejects zero admin', async () => {
      const Token = await ethers.getContractFactory('EnterpriseToken');
      await expect(Token.deploy('x', 'X', 0, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        Token,
        'ZeroAddress',
      );
    });
  });

  describe('minting', () => {
    it('allows MINTER_ROLE to mint and emits events', async () => {
      const { token, admin, alice } = await loadFixture(deployAllFixture);
      await expect(token.connect(admin).mint(alice.address, ONE))
        .to.emit(token, 'Transfer')
        .withArgs(ethers.ZeroAddress, alice.address, ONE)
        .and.to.emit(token, 'Minted')
        .withArgs(alice.address, ONE, admin.address);
      expect(await token.balanceOf(alice.address)).to.equal(ONE);
      expect(await token.totalSupply()).to.equal(ONE);
    });

    it('rejects unauthorized minting', async () => {
      const { token, mallory } = await loadFixture(deployAllFixture);
      await expect(token.connect(mallory).mint(mallory.address, ONE))
        .to.be.revertedWithCustomError(token, 'AccessControlUnauthorizedAccount')
        .withArgs(mallory.address, ROLE.MINTER);
    });

    it('allows a delegated minter after role grant and revoke', async () => {
      const { token, admin, minter, alice } = await loadFixture(deployAllFixture);
      await token.connect(admin).grantRole(ROLE.MINTER, minter.address);
      await token.connect(minter).mint(alice.address, ONE);
      await token.connect(admin).revokeRole(ROLE.MINTER, minter.address);
      await expect(token.connect(minter).mint(alice.address, ONE)).to.be.revertedWithCustomError(
        token,
        'AccessControlUnauthorizedAccount',
      );
    });

    it('rejects zero address / zero amount', async () => {
      const { token, admin, alice } = await loadFixture(deployAllFixture);
      await expect(token.mint(ethers.ZeroAddress, ONE)).to.be.revertedWithCustomError(
        token,
        'ZeroAddress',
      );
      await expect(token.connect(admin).mint(alice.address, 0)).to.be.revertedWithCustomError(
        token,
        'ZeroAmount',
      );
    });

    it('enforces the supply cap', async () => {
      const { token, alice } = await loadFixture(deployAllFixture);
      await token.mint(alice.address, CAP);
      await expect(token.mint(alice.address, 1n))
        .to.be.revertedWithCustomError(token, 'CapExceeded')
        .withArgs(CAP + 1n, CAP);
    });
  });

  describe('burning', () => {
    it('allows BURNER_ROLE to burn from any account', async () => {
      const { token, admin, alice } = await loadFixture(deployAllFixture);
      await token.mint(alice.address, ONE * 5n);
      await expect(token.burn(alice.address, ONE * 2n))
        .to.emit(token, 'Burned')
        .withArgs(alice.address, ONE * 2n, admin.address);
      expect(await token.balanceOf(alice.address)).to.equal(ONE * 3n);
    });

    it('rejects unauthorized burning', async () => {
      const { token, alice, mallory } = await loadFixture(deployAllFixture);
      await token.mint(alice.address, ONE);
      await expect(token.connect(mallory).burn(alice.address, ONE)).to.be.revertedWithCustomError(
        token,
        'AccessControlUnauthorizedAccount',
      );
    });

    it('rejects burning more than balance', async () => {
      const { token, alice } = await loadFixture(deployAllFixture);
      await token.mint(alice.address, ONE);
      await expect(token.burn(alice.address, ONE * 2n)).to.be.revertedWithCustomError(
        token,
        'ERC20InsufficientBalance',
      );
    });
  });

  describe('pausing', () => {
    it('blocks transfers and minting while paused', async () => {
      const { token, admin, alice, bob } = await loadFixture(deployAllFixture);
      await token.mint(alice.address, ONE);
      await expect(token.connect(admin).pause()).to.emit(token, 'Paused').withArgs(admin.address);
      await expect(token.connect(alice).transfer(bob.address, ONE)).to.be.revertedWithCustomError(
        token,
        'EnforcedPause',
      );
      await expect(token.mint(alice.address, ONE)).to.be.revertedWithCustomError(
        token,
        'EnforcedPause',
      );
      await token.unpause();
      await token.connect(alice).transfer(bob.address, ONE);
      expect(await token.balanceOf(bob.address)).to.equal(ONE);
    });

    it('rejects unauthorized pause/unpause', async () => {
      const { token, mallory } = await loadFixture(deployAllFixture);
      await expect(token.connect(mallory).pause()).to.be.revertedWithCustomError(
        token,
        'AccessControlUnauthorizedAccount',
      );
      await token.pause();
      await expect(token.connect(mallory).unpause()).to.be.revertedWithCustomError(
        token,
        'AccessControlUnauthorizedAccount',
      );
    });
  });

  describe('role administration', () => {
    it('rejects role grants from non-admins', async () => {
      const { token, mallory } = await loadFixture(deployAllFixture);
      await expect(
        token.connect(mallory).grantRole(ROLE.MINTER, mallory.address),
      ).to.be.revertedWithCustomError(token, 'AccessControlUnauthorizedAccount');
    });

    it('rejects setTransferPolicy from non-admins', async () => {
      const { token, policy, mallory } = await loadFixture(deployAllFixture);
      await expect(
        token.connect(mallory).setTransferPolicy(await policy.getAddress()),
      ).to.be.revertedWithCustomError(token, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('transfer policy integration', () => {
    it('emits TransferPolicyUpdated and enforces blocked accounts', async () => {
      const { token, policy, alice, bob, admin } = await loadFixture(deployAllFixture);
      const policyAddr = await policy.getAddress();
      await expect(token.setTransferPolicy(policyAddr))
        .to.emit(token, 'TransferPolicyUpdated')
        .withArgs(ethers.ZeroAddress, policyAddr);

      await token.mint(alice.address, ONE * 10n);
      await policy.connect(admin).blockAddress(bob.address, 'sanctions screening');

      await expect(token.connect(alice).transfer(bob.address, ONE))
        .to.be.revertedWithCustomError(policy, 'TransferBlocked')
        .withArgs(bob.address);

      await policy.unblockAddress(bob.address);
      await token.connect(alice).transfer(bob.address, ONE);
      expect(await token.balanceOf(bob.address)).to.equal(ONE);
    });

    it('still allows mint/burn to blocked addresses (supply ops bypass policy)', async () => {
      const { token, policy, bob } = await loadFixture(deployAllFixture);
      await token.setTransferPolicy(await policy.getAddress());
      await policy.blockAddress(bob.address, 'test');
      await token.mint(bob.address, ONE);
      await token.burn(bob.address, ONE);
      expect(await token.balanceOf(bob.address)).to.equal(0n);
    });

    it('enforces allowlist mode on both sides', async () => {
      const { token, policy, alice, bob, carol } = await loadFixture(deployAllFixture);
      await token.setTransferPolicy(await policy.getAddress());
      await token.mint(alice.address, ONE * 10n);
      await policy.setAllowlistEnabled(true);

      await expect(token.connect(alice).transfer(bob.address, ONE))
        .to.be.revertedWithCustomError(policy, 'TransferNotApproved')
        .withArgs(alice.address);

      await policy.approveAddresses([alice.address, bob.address]);
      await token.connect(alice).transfer(bob.address, ONE);

      await expect(token.connect(alice).transfer(carol.address, ONE))
        .to.be.revertedWithCustomError(policy, 'TransferNotApproved')
        .withArgs(carol.address);
    });

    it('clearing the policy removes restrictions', async () => {
      const { token, policy, alice, bob } = await loadFixture(deployAllFixture);
      await token.setTransferPolicy(await policy.getAddress());
      await policy.blockAddress(bob.address, 'x');
      await token.mint(alice.address, ONE);
      await token.setTransferPolicy(ethers.ZeroAddress);
      await token.connect(alice).transfer(bob.address, ONE);
      expect(await token.balanceOf(bob.address)).to.equal(ONE);
    });
  });

  describe('ERC-20 edge cases', () => {
    it('transferFrom respects allowance', async () => {
      const { token, alice, bob, carol } = await loadFixture(deployAllFixture);
      await token.mint(alice.address, ONE * 3n);
      await token.connect(alice).approve(bob.address, ONE);
      await token.connect(bob).transferFrom(alice.address, carol.address, ONE);
      await expect(
        token.connect(bob).transferFrom(alice.address, carol.address, ONE),
      ).to.be.revertedWithCustomError(token, 'ERC20InsufficientAllowance');
    });

    it('rejects transfer exceeding balance', async () => {
      const { token, alice, bob } = await loadFixture(deployAllFixture);
      await expect(token.connect(alice).transfer(bob.address, 1n)).to.be.revertedWithCustomError(
        token,
        'ERC20InsufficientBalance',
      );
    });
  });
});
