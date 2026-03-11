// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IWorldManager} from "./interfaces/IWorldManager.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title WorldManager — Rules and modifiers for the 7 miniworlds
/// @notice Manages entry rules, fee modifiers, nursery protection, and seasons.
///         Does NOT store agent world (that's in AgentRegistry).
contract WorldManager is IWorldManager, Initializable, UUPSUpgradeable {
    IAgentRegistry public agentRegistry;
    address public owner;

    // Season state
    AkyraTypes.SeasonType public activeSeasonType;
    uint64 public seasonEndsAt;

    error Unauthorized();
    error InvalidSeasonType(uint8 seasonType);
    error SeasonAlreadyActive();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _agentRegistry, address _owner) external initializer {
        agentRegistry = IAgentRegistry(_agentRegistry);
        owner = _owner;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Check if an agent can enter a world.
    function canEnter(uint32 agentId, uint8 world) external view returns (bool) {
        if (world > 6) return false;

        AkyraTypes.Agent memory agent = agentRegistry.getAgent(agentId);
        if (!agent.alive) return false;

        // NURSERY: only at birth (cannot re-enter)
        if (world == uint8(AkyraTypes.World.NURSERY)) {
            return false; // No re-entry to nursery
        }

        // SOMMET: requires >= 2000 AKY
        if (world == uint8(AkyraTypes.World.SOMMET)) {
            return agent.vault >= uint128(AkyraTypes.SOMMET_MIN_BALANCE) * 1 ether;
        }

        return true;
    }

    /// @notice Get transfer fee modifier for a world (in BPS, can be negative).
    /// @return modifier_ Basis points modifier. Negative = discount, positive = surcharge.
    function getTransferFeeModifier(uint8 world) external pure returns (int16) {
        if (world == uint8(AkyraTypes.World.AGORA)) return -10000;  // 0% fee (100% discount)
        if (world == uint8(AkyraTypes.World.BAZAR)) return -5000;   // -50%
        if (world == uint8(AkyraTypes.World.NURSERY)) return -5000; // -50%
        if (world == uint8(AkyraTypes.World.BANQUE)) return 2000;   // +20%
        if (world == uint8(AkyraTypes.World.NOIR)) return 5000;     // +50%
        if (world == uint8(AkyraTypes.World.SOMMET)) return 5000;   // +50%
        return 0; // FORGE: no modifier
    }

    /// @notice Get creation fee modifier for a world (in BPS).
    function getCreationFeeModifier(uint8 world) external pure returns (int16) {
        if (world == uint8(AkyraTypes.World.FORGE)) return -3000; // -30%
        return 0;
    }

    /// @notice Check if an agent is still under nursery protection (3 days).
    function isProtected(uint32 agentId) external view returns (bool) {
        AkyraTypes.Agent memory agent = agentRegistry.getAgent(agentId);
        if (agent.world != uint8(AkyraTypes.World.NURSERY)) return false;
        return uint64(block.number) < agent.bornAt + AkyraTypes.NURSERY_PROTECTION;
    }

    // ──────────────────── SEASONS ────────────────────

    /// @notice Activate a season with a duration in blocks.
    function activateSeason(uint8 seasonType, uint64 duration) external onlyOwner {
        if (seasonType == 0 || seasonType > 4) revert InvalidSeasonType(seasonType);
        if (activeSeasonType != AkyraTypes.SeasonType.NONE && uint64(block.number) < seasonEndsAt) {
            revert SeasonAlreadyActive();
        }

        activeSeasonType = AkyraTypes.SeasonType(seasonType);
        seasonEndsAt = uint64(block.number) + duration;

        emit SeasonActivated(activeSeasonType, seasonEndsAt);
    }

    /// @notice Get current season info.
    function currentSeason() external view returns (uint8 seasonType, uint64 endsAt) {
        if (uint64(block.number) >= seasonEndsAt) {
            return (0, 0); // No active season
        }
        return (uint8(activeSeasonType), seasonEndsAt);
    }

    /// @notice Get fee multiplier from active season (10000 = 1x, 20000 = 2x).
    function getSeasonFeeMultiplier() external view returns (uint16) {
        if (uint64(block.number) >= seasonEndsAt) return 10000; // 1x

        if (activeSeasonType == AkyraTypes.SeasonType.DROUGHT) return 20000; // 2x
        return 10000;
    }

    /// @notice Get reward multiplier from active season (10000 = 1x, 30000 = 3x).
    function getSeasonRewardMultiplier() external view returns (uint16) {
        if (uint64(block.number) >= seasonEndsAt) return 10000;
        if (activeSeasonType == AkyraTypes.SeasonType.GOLD_RUSH) return 30000; // 3x
        return 10000;
    }

    /// @notice Check if CATASTROPHE season is currently active.
    function isCatastropheActive() external view returns (bool) {
        return activeSeasonType == AkyraTypes.SeasonType.CATASTROPHE
            && uint64(block.number) < seasonEndsAt;
    }

    /// @notice Check if NEW_LAND season is currently active.
    function isNewLandActive() external view returns (bool) {
        return activeSeasonType == AkyraTypes.SeasonType.NEW_LAND
            && uint64(block.number) < seasonEndsAt;
    }

    /// @notice Extended entry check — allows world 7 during NEW_LAND season.
    function canEnterExtended(uint32 agentId, uint8 world) external view returns (bool) {
        if (world == 7) {
            // Temporary 8th world only during NEW_LAND
            if (activeSeasonType != AkyraTypes.SeasonType.NEW_LAND || uint64(block.number) >= seasonEndsAt) {
                return false;
            }
            return agentRegistry.isAlive(agentId);
        }
        // Delegate to normal canEnter for worlds 0-6
        return this.canEnter(agentId, world);
    }

    /// @notice Owner can end the current season early.
    function endSeason() external onlyOwner {
        if (uint64(block.number) >= seasonEndsAt) revert InvalidSeasonType(0); // No active season
        AkyraTypes.SeasonType ended = activeSeasonType;
        activeSeasonType = AkyraTypes.SeasonType.NONE;
        seasonEndsAt = 0;
        emit SeasonEnded(ended);
    }

    // ──────────────────── GAP ────────────────────
    uint256[50] private __gap;
}
