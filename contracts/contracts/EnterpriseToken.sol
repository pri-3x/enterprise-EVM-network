// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ITransferPolicy} from "./interfaces/ITransferPolicy.sol";

/// @title EnterpriseToken
/// @notice ERC-20 representing a fictional enterprise asset unit on the permissioned network.
///
/// Roles (OpenZeppelin AccessControl):
///   DEFAULT_ADMIN_ROLE — manages roles, transfer policy, supply cap
///   MINTER_ROLE        — mint()
///   BURNER_ROLE        — burn() from any account (controlled supply reduction)
///   PAUSER_ROLE        — pause()/unpause()
///
/// Transfers may be gated by an optional ITransferPolicy (see PermissionedTransfer).
contract EnterpriseToken is ERC20, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Maximum total supply (0 = uncapped)
    uint256 public immutable cap;

    ITransferPolicy public transferPolicy;

    event TransferPolicyUpdated(address indexed previousPolicy, address indexed newPolicy);
    event Minted(address indexed to, uint256 amount, address indexed by);
    event Burned(address indexed from, uint256 amount, address indexed by);

    error ZeroAddress();
    error ZeroAmount();
    error CapExceeded(uint256 requested, uint256 cap);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 cap_,
        address admin
    ) ERC20(name_, symbol_) {
        if (admin == address(0)) revert ZeroAddress();
        cap = cap_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BURNER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ----------------------------------------------------------------- supply

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (cap != 0 && totalSupply() + amount > cap) revert CapExceeded(totalSupply() + amount, cap);
        _mint(to, amount);
        emit Minted(to, amount, msg.sender);
    }

    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _burn(from, amount);
        emit Burned(from, amount, msg.sender);
    }

    // ----------------------------------------------------------------- pausing

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ----------------------------------------------------------------- policy

    /// @notice Set (or clear with address(0)) the transfer policy consulted on every transfer.
    function setTransferPolicy(address policy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address previous = address(transferPolicy);
        transferPolicy = ITransferPolicy(policy);
        emit TransferPolicyUpdated(previous, policy);
    }

    // ----------------------------------------------------------------- internals

    /// @dev Single hook for mint/burn/transfer in OZ v5. Pausable check comes from
    ///      ERC20Pausable; the policy is only consulted for real transfers (not supply ops).
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        if (from != address(0) && to != address(0) && address(transferPolicy) != address(0)) {
            transferPolicy.checkTransfer(from, to, value);
        }
        super._update(from, to, value);
    }
}
