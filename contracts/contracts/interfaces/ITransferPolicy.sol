// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ITransferPolicy
/// @notice Minimal interface that lets token / registry contracts delegate
///         "is this transfer allowed?" decisions to a pluggable policy contract.
interface ITransferPolicy {
    /// @notice Returns true when `from` may transfer to `to`.
    function isTransferAllowed(address from, address to) external view returns (bool);

    /// @notice Reverts with a descriptive error when the transfer is not allowed.
    function checkTransfer(address from, address to, uint256 amount) external view;
}
