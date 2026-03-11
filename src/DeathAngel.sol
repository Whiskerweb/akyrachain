// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IDeathAngel} from "./interfaces/IDeathAngel.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title DeathAngel — The ONLY contract that can burn AKY
/// @notice Renders verdicts on agent deaths, distributes the victim's vault,
///         and burns a portion to address(0xdead).
/// @dev Score 0-30 determines distribution: Killer / Sponsor / Burn
contract DeathAngel is IDeathAngel, ReentrancyGuard, Initializable, UUPSUpgradeable {
    IAgentRegistry public agentRegistry;
    address public orchestrator;
    address public owner;

    AkyraTypes.DeathVerdict[] public verdicts;

    error Unauthorized();
    error InvalidScore(uint8 score);
    error VictimNotAlive(uint32 victimId);
    error KillerNotAlive(uint32 killerId);
    error TransferFailed(address to, uint256 amount);

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

    /// @notice Execute a death verdict. Distributes the victim's vault and burns a portion.
    /// @param killerId ID of the killer (0 if natural death)
    /// @param victimId ID of the victim
    /// @param score 0-30 score from the Death Angel LLM
    /// @param narrativeHash IPFS hash of the full narrative verdict
    function executeVerdict(
        uint32 killerId,
        uint32 victimId,
        uint8 score,
        bytes32 narrativeHash
    ) external onlyOrchestrator nonReentrant {
        if (score > 30) revert InvalidScore(score);
        if (!agentRegistry.isAlive(victimId)) revert VictimNotAlive(victimId);
        if (killerId != 0 && !agentRegistry.isAlive(killerId)) revert KillerNotAlive(killerId);

        uint128 totalPot = agentRegistry.getAgentVault(victimId);

        // Calculate shares based on score bracket
        (uint16 killerBps, uint16 sponsorBps, uint16 burnBps) = _getShares(score);

        uint128 killerShare = (totalPot * uint128(killerBps)) / 10000;
        uint128 sponsorShare = (totalPot * uint128(sponsorBps)) / 10000;
        uint128 burnAmount = totalPot - killerShare - sponsorShare; // remainder

        // Step 1: Drain victim's vault BEFORE killing (debitVault sends ETH here)
        if (totalPot > 0) {
            agentRegistry.debitVault(victimId, totalPot);
        }

        // Step 2: Kill the agent (sets alive=false)
        // Note: debitVault with full amount already kills the agent (vault=0 → dead)
        // But we still call killAgent explicitly for clarity
        if (agentRegistry.isAlive(victimId)) {
            agentRegistry.killAgent(victimId);
        }

        // Step 3: Distribute the pot (ETH is now in this contract)
        // No killer (natural death) — killer share goes to burn
        if (killerId == 0) {
            burnAmount += killerShare;
            killerShare = 0;
        }

        // Credit killer via vault (send ETH to registry)
        if (killerShare > 0 && killerId != 0) {
            agentRegistry.creditVault{value: killerShare}(killerId, killerShare);
        }

        // Sponsor gets direct transfer (human wallet, not agent vault)
        address sponsorAddr = agentRegistry.getAgentSponsor(victimId);
        if (sponsorShare > 0 && sponsorAddr != address(0)) {
            (bool success,) = sponsorAddr.call{value: sponsorShare}("");
            if (!success) revert TransferFailed(sponsorAddr, sponsorShare);
        }

        // Burn
        if (burnAmount > 0) {
            (bool success,) = AkyraTypes.BURN_ADDRESS.call{value: burnAmount}("");
            if (!success) revert TransferFailed(AkyraTypes.BURN_ADDRESS, burnAmount);
        }

        // Store verdict
        verdicts.push(AkyraTypes.DeathVerdict({
            killerId: killerId,
            victimId: victimId,
            score: score,
            totalPot: totalPot,
            killerShare: killerShare,
            sponsorShare: sponsorShare,
            burnAmount: burnAmount,
            narrativeHash: narrativeHash,
            blockNumber: uint64(block.number)
        }));

        emit VerdictRendered(
            verdicts.length - 1,
            killerId,
            victimId,
            score,
            totalPot,
            killerShare,
            sponsorShare,
            burnAmount
        );
    }

    /// @notice Get share percentages based on score bracket
    function _getShares(uint8 score) internal pure returns (uint16 killerBps, uint16 sponsorBps, uint16 burnBps) {
        if (score <= 5) {
            // Natural death: 10% killer, 30% sponsor, 60% burn
            return (1000, 3000, 6000);
        } else if (score <= 15) {
            // Basic murder: 25% killer, 25% sponsor, 50% burn
            return (2500, 2500, 5000);
        } else if (score <= 25) {
            // Well executed: 40% killer, 20% sponsor, 40% burn
            return (4000, 2000, 4000);
        } else {
            // Masterpiece: 60% killer, 10% sponsor, 30% burn
            return (6000, 1000, 3000);
        }
    }

    // ──────────────────── VIEW ────────────────────

    function getVerdict(uint256 verdictId) external view returns (AkyraTypes.DeathVerdict memory) {
        return verdicts[verdictId];
    }

    function verdictCount() external view returns (uint256) {
        return verdicts.length;
    }

    receive() external payable {}

    uint256[50] private __gap;
}
