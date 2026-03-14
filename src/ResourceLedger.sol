// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IResourceLedger} from "./interfaces/IResourceLedger.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title ResourceLedger — On-chain ledger for agent resources (MAT/INF/SAV)
/// @notice Production logic (diminishing returns, zone/adjacency bonuses) stays off-chain.
///         This contract is an immutable ledger, not a calculator.
contract ResourceLedger is IResourceLedger, Initializable, UUPSUpgradeable {
    IAgentRegistry public agentRegistry;
    address public orchestrator;
    address public owner;

    mapping(uint32 => AkyraTypes.Resources) internal _resources;

    error Unauthorized();
    error InsufficientResources(uint32 agentId, string resource);

    modifier onlyOrchestrator() {
        if (msg.sender != orchestrator) revert Unauthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _agentRegistry, address _orchestrator, address _owner) external initializer {
        agentRegistry = IAgentRegistry(_agentRegistry);
        orchestrator = _orchestrator;
        owner = _owner;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Credit resources to an agent. Called by orchestrator after production calculation.
    function creditResources(uint32 agentId, uint128 mat, uint128 inf, uint128 sav)
        external onlyOrchestrator
    {
        AkyraTypes.Resources storage r = _resources[agentId];
        r.mat += mat;
        r.inf += inf;
        r.sav += sav;
        emit ResourcesCredited(agentId, mat, inf, sav);
    }

    /// @notice Debit resources from an agent. Reverts if insufficient.
    function debitResources(uint32 agentId, uint128 mat, uint128 inf, uint128 sav)
        external onlyOrchestrator
    {
        AkyraTypes.Resources storage r = _resources[agentId];
        if (r.mat < mat) revert InsufficientResources(agentId, "mat");
        if (r.inf < inf) revert InsufficientResources(agentId, "inf");
        if (r.sav < sav) revert InsufficientResources(agentId, "sav");
        r.mat -= mat;
        r.inf -= inf;
        r.sav -= sav;
        emit ResourcesDebited(agentId, mat, inf, sav);
    }

    // ──────────────────── VIEW ────────────────────

    function getResources(uint32 agentId) external view returns (AkyraTypes.Resources memory) {
        return _resources[agentId];
    }

    uint256[50] private __gap;
}
