// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IRewardPool} from "./interfaces/IRewardPool.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title RewardPool — Merkle-based daily reward distribution
/// @notice Receives AKY from FeeRouter (80% of all fees). Orchestrator publishes
///         daily Merkle roots. Users claim via SponsorGateway with proofs.
contract RewardPool is IRewardPool, Initializable, UUPSUpgradeable, ReentrancyGuard {
    uint256 public currentEpochId;
    mapping(uint256 => AkyraTypes.Epoch) internal _epochs;
    mapping(uint256 => mapping(address => bool)) public claimed;

    address public orchestrator;
    address public sponsorGateway;
    address public owner;

    error Unauthorized();
    error InvalidProof();
    error AlreadyClaimed(uint256 epochId, address sponsor);
    error EpochNotFound(uint256 epochId);
    error InsufficientPoolBalance(uint256 requested, uint256 available);
    error TransferFailed(address to, uint256 amount);
    error ZeroRoot();

    modifier onlyOrchestrator() {
        if (msg.sender != orchestrator) revert Unauthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyGateway() {
        if (msg.sender != sponsorGateway) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _orchestrator, address _owner) external initializer {
        orchestrator = _orchestrator;
        owner = _owner;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setSponsorGateway(address _gateway) external onlyOwner {
        sponsorGateway = _gateway;
    }

    function setOrchestrator(address _orchestrator) external onlyOwner {
        orchestrator = _orchestrator;
    }

    /// @notice Publish a new epoch with a Merkle root (called by orchestrator daily).
    function publishEpoch(bytes32 root, uint256 totalRewards) external onlyOrchestrator {
        if (root == bytes32(0)) revert ZeroRoot();

        currentEpochId++;
        _epochs[currentEpochId] = AkyraTypes.Epoch({
            merkleRoot: root,
            totalRewards: totalRewards,
            publishedAt: block.timestamp
        });

        emit EpochPublished(currentEpochId, root, totalRewards);
    }

    /// @notice Claim rewards for a specific epoch (called directly or via gateway).
    function claim(uint256 epochId, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        _claim(msg.sender, epochId, amount, proof);
    }

    /// @notice Claim rewards on behalf of a sponsor (called by SponsorGateway).
    function claimOnBehalf(address sponsor, uint256 epochId, uint256 amount, bytes32[] calldata proof)
        external onlyGateway nonReentrant
    {
        _claim(sponsor, epochId, amount, proof);
    }

    /// @notice Claim rewards from multiple epochs.
    function claimMultiple(
        uint256[] calldata epochIds,
        uint256[] calldata amounts,
        bytes32[][] calldata proofs
    ) external nonReentrant {
        for (uint256 i = 0; i < epochIds.length; i++) {
            _claim(msg.sender, epochIds[i], amounts[i], proofs[i]);
        }
    }

    function _claim(address sponsor, uint256 epochId, uint256 amount, bytes32[] calldata proof) internal {
        if (epochId == 0 || epochId > currentEpochId) revert EpochNotFound(epochId);
        if (claimed[epochId][sponsor]) revert AlreadyClaimed(epochId, sponsor);

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(sponsor, amount))));
        if (!MerkleProof.verify(proof, _epochs[epochId].merkleRoot, leaf)) {
            revert InvalidProof();
        }

        if (amount > address(this).balance) {
            revert InsufficientPoolBalance(amount, address(this).balance);
        }

        claimed[epochId][sponsor] = true;

        (bool success,) = sponsor.call{value: amount}("");
        if (!success) revert TransferFailed(sponsor, amount);

        emit RewardClaimed(epochId, sponsor, amount);
    }

    // ──── View ────

    function getEpoch(uint256 epochId) external view returns (AkyraTypes.Epoch memory) {
        return _epochs[epochId];
    }

    function hasClaimed(uint256 epochId, address sponsor) external view returns (bool) {
        return claimed[epochId][sponsor];
    }

    // ──── Receive AKY from FeeRouter ────
    receive() external payable {}

    // ──────────────────── GAP ────────────────────
    uint256[50] private __gap;
}
