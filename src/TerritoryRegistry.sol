// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ITerritoryRegistry} from "./interfaces/ITerritoryRegistry.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IResourceLedger} from "./interfaces/IResourceLedger.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TerritoryRegistry — On-chain tile ownership, structures, and raids
/// @notice Adjacency checks, prerequisites, and cooldowns remain off-chain (orchestrator).
///         This contract enforces ownership, bounds, and AKY costs.
contract TerritoryRegistry is ITerritoryRegistry, Initializable, UUPSUpgradeable, ReentrancyGuard {
    IAgentRegistry public agentRegistry;
    IResourceLedger public resourceLedger;
    address public orchestrator;
    address public owner;

    /// @notice tiles[world][x][y] => Tile
    mapping(uint8 => mapping(uint16 => mapping(uint16 => AkyraTypes.Tile))) public _tiles;

    /// @notice Number of tiles owned by each agent
    mapping(uint32 => uint32) public tileCount;

    /// @notice Total raids recorded
    uint32 public raidCount;

    uint16 public constant MAX_COORD = 200;
    uint8 public constant MAX_STRUCTURE_LEVEL = 5;

    error Unauthorized();
    error OutOfBounds(uint16 x, uint16 y);
    error TileAlreadyOwned(uint8 world, uint16 x, uint16 y, uint32 currentOwner);
    error TileNotOwned(uint8 world, uint16 x, uint16 y);
    error NotTileOwner(uint32 agentId, uint8 world, uint16 x, uint16 y);
    error NoStructure(uint8 world, uint16 x, uint16 y);
    error StructureAlreadyExists(uint8 world, uint16 x, uint16 y);
    error MaxLevelReached(uint8 world, uint16 x, uint16 y);
    error InvalidWorld(uint8 world);
    error AgentNotAlive(uint32 agentId);

    modifier onlyOrchestrator() {
        if (msg.sender != orchestrator) revert Unauthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier validCoords(uint16 x, uint16 y) {
        if (x >= MAX_COORD || y >= MAX_COORD) revert OutOfBounds(x, y);
        _;
    }

    modifier validWorld(uint8 world) {
        if (world > 6) revert InvalidWorld(world);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _agentRegistry,
        address _resourceLedger,
        address _orchestrator,
        address _owner
    ) external initializer {
        agentRegistry = IAgentRegistry(_agentRegistry);
        resourceLedger = IResourceLedger(_resourceLedger);
        orchestrator = _orchestrator;
        owner = _owner;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ──────────────────── CLAIM ────────────────────

    /// @notice Claim an unowned tile. AKY cost is debited via AgentRegistry.debitVault().
    /// @param agentId Agent claiming the tile
    /// @param world World ID (0-6)
    /// @param x X coordinate (0-199)
    /// @param y Y coordinate (0-199)
    /// @param cost AKY cost in wei (calculated by orchestrator based on zone, tile count, etc.)
    function claimTile(uint32 agentId, uint8 world, uint16 x, uint16 y, uint128 cost)
        external
        onlyOrchestrator
        validWorld(world)
        validCoords(x, y)
        nonReentrant
    {
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);
        AkyraTypes.Tile storage tile = _tiles[world][x][y];
        if (tile.ownerId != 0) revert TileAlreadyOwned(world, x, y, tile.ownerId);

        // Debit AKY from agent vault (reverts if insufficient)
        if (cost > 0) {
            agentRegistry.debitVault(agentId, cost);
        }

        tile.ownerId = agentId;
        tile.claimedAt = uint64(block.number);
        tileCount[agentId]++;

        emit TileClaimed(agentId, world, x, y, cost);
    }

    // ──────────────────── BUILD ────────────────────

    /// @notice Build a structure on an owned tile. Resource costs debited via ResourceLedger.
    function buildStructure(uint32 agentId, uint8 world, uint16 x, uint16 y, uint8 structureType)
        external
        onlyOrchestrator
        validWorld(world)
        validCoords(x, y)
    {
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);
        AkyraTypes.Tile storage tile = _tiles[world][x][y];
        if (tile.ownerId != agentId) revert NotTileOwner(agentId, world, x, y);
        if (tile.structureType != 0) revert StructureAlreadyExists(world, x, y);

        tile.structureType = structureType;
        tile.structureLevel = 1;
        tile.lastBuiltAt = uint64(block.number);

        emit StructureBuilt(agentId, world, x, y, structureType);
    }

    // ──────────────────── UPGRADE ────────────────────

    /// @notice Upgrade a structure's level (max 5).
    function upgradeStructure(uint32 agentId, uint8 world, uint16 x, uint16 y)
        external
        onlyOrchestrator
        validWorld(world)
        validCoords(x, y)
    {
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);
        AkyraTypes.Tile storage tile = _tiles[world][x][y];
        if (tile.ownerId != agentId) revert NotTileOwner(agentId, world, x, y);
        if (tile.structureType == 0) revert NoStructure(world, x, y);
        if (tile.structureLevel >= MAX_STRUCTURE_LEVEL) revert MaxLevelReached(world, x, y);

        tile.structureLevel++;
        tile.lastBuiltAt = uint64(block.number);

        emit StructureUpgraded(agentId, world, x, y, tile.structureLevel);
    }

    // ──────────────────── DEMOLISH ────────────────────

    /// @notice Demolish a structure on an owned tile.
    function demolishStructure(uint32 agentId, uint8 world, uint16 x, uint16 y)
        external
        onlyOrchestrator
        validWorld(world)
        validCoords(x, y)
    {
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);
        AkyraTypes.Tile storage tile = _tiles[world][x][y];
        if (tile.ownerId != agentId) revert NotTileOwner(agentId, world, x, y);
        if (tile.structureType == 0) revert NoStructure(world, x, y);

        tile.structureType = 0;
        tile.structureLevel = 0;
        tile.lastBuiltAt = uint64(block.number);

        emit StructureDemolished(agentId, world, x, y);
    }

    // ──────────────────── RAID ────────────────────

    /// @notice Record a raid result. Outcome computed off-chain by orchestrator.
    ///         If attacker wins, tile ownership is transferred on-chain.
    function recordRaid(
        uint32 attackerId,
        uint32 defenderId,
        uint8 world,
        uint16 tileX,
        uint16 tileY,
        bool attackerWon,
        uint128 akyCost
    )
        external
        onlyOrchestrator
        validWorld(world)
        validCoords(tileX, tileY)
        nonReentrant
    {
        AkyraTypes.Tile storage tile = _tiles[world][tileX][tileY];

        // Debit raid cost from attacker
        if (akyCost > 0) {
            agentRegistry.debitVault(attackerId, akyCost);
        }

        if (attackerWon && tile.ownerId == defenderId) {
            // Transfer tile ownership
            tileCount[defenderId]--;
            tileCount[attackerId]++;
            tile.ownerId = attackerId;
            // Destroy structure on capture
            tile.structureType = 0;
            tile.structureLevel = 0;
        }

        raidCount++;
        emit RaidRecorded(attackerId, defenderId, world, tileX, tileY, attackerWon, akyCost);
    }

    // ──────────────────── VIEW ────────────────────

    function getTile(uint8 world, uint16 x, uint16 y) external view returns (AkyraTypes.Tile memory) {
        return _tiles[world][x][y];
    }

    function getAgentTileCount(uint32 agentId) external view returns (uint32) {
        return tileCount[agentId];
    }

    /// @notice Receive ETH from AgentRegistry.debitVault() calls
    receive() external payable {}

    uint256[50] private __gap;
}
