// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ITransferPolicy} from "./interfaces/ITransferPolicy.sol";

/// @title PermissionedTransfer
/// @notice Simple, auditable transfer-restriction policy for an enterprise network.
///
/// Two independent lists are maintained:
///   * blocked   — addresses that can never send or receive (always enforced)
///   * approved  — addresses allowed to send/receive when `allowlistEnabled` is true
///
/// Decision table for a transfer from A to B:
///   blocked[A] || blocked[B]                        -> denied
///   allowlistEnabled && !(approved[A] && approved[B]) -> denied
///   otherwise                                        -> allowed
///
/// The zero address (mint/burn) is treated as approved so that supply operations
/// are governed by the token's own roles rather than this policy.
contract PermissionedTransfer is AccessControl, ITransferPolicy {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    mapping(address => bool) private _approved;
    mapping(address => bool) private _blocked;
    bool public allowlistEnabled;

    event AddressApproved(address indexed account, address indexed by);
    event AddressRevoked(address indexed account, address indexed by);
    event AddressBlocked(address indexed account, address indexed by, string reason);
    event AddressUnblocked(address indexed account, address indexed by);
    event AllowlistModeChanged(bool enabled, address indexed by);

    error TransferBlocked(address account);
    error TransferNotApproved(address account);
    error ZeroAddress();
    error EmptyBatch();

    constructor(address admin, bool allowlistEnabled_) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        allowlistEnabled = allowlistEnabled_;
        emit AllowlistModeChanged(allowlistEnabled_, admin);
    }

    // ----------------------------------------------------------------- admin

    function setAllowlistEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowlistEnabled = enabled;
        emit AllowlistModeChanged(enabled, msg.sender);
    }

    function approveAddress(address account) public onlyRole(COMPLIANCE_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        _approved[account] = true;
        emit AddressApproved(account, msg.sender);
    }

    function approveAddresses(address[] calldata accounts) external onlyRole(COMPLIANCE_ROLE) {
        if (accounts.length == 0) revert EmptyBatch();
        for (uint256 i = 0; i < accounts.length; i++) {
            approveAddress(accounts[i]);
        }
    }

    function revokeAddress(address account) external onlyRole(COMPLIANCE_ROLE) {
        _approved[account] = false;
        emit AddressRevoked(account, msg.sender);
    }

    function blockAddress(address account, string calldata reason) external onlyRole(COMPLIANCE_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        _blocked[account] = true;
        emit AddressBlocked(account, msg.sender, reason);
    }

    function unblockAddress(address account) external onlyRole(COMPLIANCE_ROLE) {
        _blocked[account] = false;
        emit AddressUnblocked(account, msg.sender);
    }

    // ----------------------------------------------------------------- views

    function isApproved(address account) public view returns (bool) {
        return account == address(0) || _approved[account];
    }

    function isBlocked(address account) public view returns (bool) {
        return _blocked[account];
    }

    /// @inheritdoc ITransferPolicy
    function isTransferAllowed(address from, address to) public view override returns (bool) {
        if (_blocked[from] || _blocked[to]) return false;
        if (allowlistEnabled && !(isApproved(from) && isApproved(to))) return false;
        return true;
    }

    /// @inheritdoc ITransferPolicy
    function checkTransfer(address from, address to, uint256 /* amount */) external view override {
        if (_blocked[from]) revert TransferBlocked(from);
        if (_blocked[to]) revert TransferBlocked(to);
        if (allowlistEnabled) {
            if (!isApproved(from)) revert TransferNotApproved(from);
            if (!isApproved(to)) revert TransferNotApproved(to);
        }
    }
}
