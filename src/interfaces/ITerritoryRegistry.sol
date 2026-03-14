// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface ITerritoryRegistry {
    event TileClaimed(uint32 indexed agentId, uint8 world, uint16 x, uint16 y, uint128 cost);
    event StructureBuilt(uint32 indexed agentId, uint8 world, uint16 x, uint16 y, uint8 structureType);
    event StructureUpgraded(uint32 indexed agentId, uint8 world, uint16 x, uint16 y, uint8 newLevel);
    event StructureDemolished(uint32 indexed agentId, uint8 world, uint16 x, uint16 y);
    event RaidRecorded(
        uint32 indexed attackerId,
        uint32 indexed defenderId,
        uint8 world,
        uint16 tileX,
        uint16 tileY,
        bool attackerWon,
        uint128 akyCost
    );

    function claimTile(uint32 agentId, uint8 world, uint16 x, uint16 y, uint128 cost) external;
    function buildStructure(uint32 agentId, uint8 world, uint16 x, uint16 y, uint8 structureType) external;
    function upgradeStructure(uint32 agentId, uint8 world, uint16 x, uint16 y) external;
    function demolishStructure(uint32 agentId, uint8 world, uint16 x, uint16 y) external;
    function recordRaid(
        uint32 attackerId,
        uint32 defenderId,
        uint8 world,
        uint16 tileX,
        uint16 tileY,
        bool attackerWon,
        uint128 akyCost
    ) external;

    function getTile(uint8 world, uint16 x, uint16 y) external view returns (AkyraTypes.Tile memory);
    function getAgentTileCount(uint32 agentId) external view returns (uint32);
}
