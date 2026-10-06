// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ITransferPolicy} from "./interfaces/ITransferPolicy.sol";

/// @title AssetRegistry
/// @notice On-chain registry of fictional enterprise assets (equipment, licences, real estate...).
///
/// Roles:
///   DEFAULT_ADMIN_ROLE — role management, transfer policy
///   REGISTRAR_ROLE     — register / update / deactivate assets
///   PAUSER_ROLE        — emergency stop
///
/// Ownership transfers may be performed by the current owner or a registrar and are
/// optionally gated by the same ITransferPolicy used by the token.
contract AssetRegistry is AccessControl, Pausable {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct Asset {
        uint256 id;
        string name;
        string assetType;
        uint256 value;
        address owner;
        bool active;
        uint64 createdAt;
        uint64 updatedAt;
    }

    uint256 private _nextId = 1;
    mapping(uint256 => Asset) private _assets;
    mapping(address => uint256) private _ownedCount;

    ITransferPolicy public transferPolicy;

    event AssetRegistered(
        uint256 indexed id,
        address indexed owner,
        string name,
        string assetType,
        uint256 value,
        address indexed registrar
    );
    event AssetUpdated(uint256 indexed id, string name, string assetType, uint256 value, address indexed by);
    event AssetTransferred(uint256 indexed id, address indexed from, address indexed to, address by);
    event AssetDeactivated(uint256 indexed id, address indexed by, string reason);
    event AssetReactivated(uint256 indexed id, address indexed by);
    event TransferPolicyUpdated(address indexed previousPolicy, address indexed newPolicy);

    error AssetNotFound(uint256 id);
    error AssetInactive(uint256 id);
    error AssetAlreadyActive(uint256 id);
    error NotAuthorized(address caller, uint256 id);
    error ZeroAddress();
    error EmptyString(string field);
    error SameOwner(address owner);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ----------------------------------------------------------------- modifiers

    modifier assetExists(uint256 id) {
        if (_assets[id].owner == address(0)) revert AssetNotFound(id);
        _;
    }

    modifier assetActive(uint256 id) {
        if (!_assets[id].active) revert AssetInactive(id);
        _;
    }

    // ----------------------------------------------------------------- mutations

    function registerAsset(
        string calldata name,
        string calldata assetType,
        uint256 value,
        address owner
    ) external onlyRole(REGISTRAR_ROLE) whenNotPaused returns (uint256 id) {
        if (owner == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert EmptyString("name");
        if (bytes(assetType).length == 0) revert EmptyString("assetType");

        id = _nextId++;
        uint64 nowTs = uint64(block.timestamp);
        _assets[id] = Asset({
            id: id,
            name: name,
            assetType: assetType,
            value: value,
            owner: owner,
            active: true,
            createdAt: nowTs,
            updatedAt: nowTs
        });
        _ownedCount[owner] += 1;

        emit AssetRegistered(id, owner, name, assetType, value, msg.sender);
    }

    function updateAsset(
        uint256 id,
        string calldata name,
        string calldata assetType,
        uint256 value
    ) external onlyRole(REGISTRAR_ROLE) whenNotPaused assetExists(id) assetActive(id) {
        if (bytes(name).length == 0) revert EmptyString("name");
        if (bytes(assetType).length == 0) revert EmptyString("assetType");

        Asset storage a = _assets[id];
        a.name = name;
        a.assetType = assetType;
        a.value = value;
        a.updatedAt = uint64(block.timestamp);

        emit AssetUpdated(id, name, assetType, value, msg.sender);
    }

    /// @notice Transfer ownership. Callable by the current owner or a registrar.
    function transferAsset(uint256 id, address to) external whenNotPaused assetExists(id) assetActive(id) {
        if (to == address(0)) revert ZeroAddress();
        Asset storage a = _assets[id];
        address from = a.owner;
        if (to == from) revert SameOwner(from);
        if (msg.sender != from && !hasRole(REGISTRAR_ROLE, msg.sender)) revert NotAuthorized(msg.sender, id);

        if (address(transferPolicy) != address(0)) {
            transferPolicy.checkTransfer(from, to, a.value);
        }

        a.owner = to;
        a.updatedAt = uint64(block.timestamp);
        _ownedCount[from] -= 1;
        _ownedCount[to] += 1;

        emit AssetTransferred(id, from, to, msg.sender);
    }

    function deactivateAsset(uint256 id, string calldata reason)
        external
        onlyRole(REGISTRAR_ROLE)
        assetExists(id)
        assetActive(id)
    {
        Asset storage a = _assets[id];
        a.active = false;
        a.updatedAt = uint64(block.timestamp);
        emit AssetDeactivated(id, msg.sender, reason);
    }

    function reactivateAsset(uint256 id) external onlyRole(REGISTRAR_ROLE) assetExists(id) {
        Asset storage a = _assets[id];
        if (a.active) revert AssetAlreadyActive(id);
        a.active = true;
        a.updatedAt = uint64(block.timestamp);
        emit AssetReactivated(id, msg.sender);
    }

    function setTransferPolicy(address policy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address previous = address(transferPolicy);
        transferPolicy = ITransferPolicy(policy);
        emit TransferPolicyUpdated(previous, policy);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ----------------------------------------------------------------- views

    function getAsset(uint256 id) external view assetExists(id) returns (Asset memory) {
        return _assets[id];
    }

    /// @notice Number of assets ever registered (ids are 1..totalAssets()).
    function totalAssets() external view returns (uint256) {
        return _nextId - 1;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _ownedCount[owner];
    }

    function exists(uint256 id) external view returns (bool) {
        return _assets[id].owner != address(0);
    }
}
