// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TerritoryRegistry} from "../src/TerritoryRegistry.sol";
import {ResourceLedger} from "../src/ResourceLedger.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract TerritoryRegistryTest is Test {
    TerritoryRegistry public territory;
    ResourceLedger public resources;
    AgentRegistry public registry;
    FeeRouter public feeRouter;

    address public ownerAddr = makeAddr("owner");
    address public guardianAddr = makeAddr("guardian");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public gatewayAddr = makeAddr("gateway");
    address public rp = makeAddr("rewardPool");
    address public iw = makeAddr("infraWallet");
    address public gt = makeAddr("gasTreasury");

    uint32 public agent1;
    uint32 public agent2;

    function setUp() public {
        feeRouter = new FeeRouter(rp, iw, gt);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        resources = ResourceLedger(payable(deployProxy(
            address(new ResourceLedger()),
            abi.encodeCall(ResourceLedger.initialize, (address(registry), orchestratorAddr, ownerAddr))
        )));
        territory = TerritoryRegistry(payable(deployProxy(
            address(new TerritoryRegistry()),
            abi.encodeCall(TerritoryRegistry.initialize, (address(registry), address(resources), orchestratorAddr, ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);
        // TerritoryRegistry needs to call debitVault, so register as protocol contract
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(territory), true);

        agent1 = _createAndFundAgent(makeAddr("s1"), 1000 ether);
        agent2 = _createAndFundAgent(makeAddr("s2"), 1000 ether);
    }

    function _createAndFundAgent(address sponsor, uint256 fundAmount) internal returns (uint32) {
        vm.prank(gatewayAddr);
        uint32 agentId = registry.createAgent(sponsor);
        // Deposit AKY into agent's vault via gateway
        deal(gatewayAddr, fundAmount);
        vm.prank(gatewayAddr);
        registry.deposit{value: fundAmount}(agentId);
        return agentId;
    }

    // ──────────────── CLAIM ────────────────

    function test_claimTile() public {
        vm.prank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0.5 ether);

        AkyraTypes.Tile memory tile = territory.getTile(0, 10, 20);
        assertEq(tile.ownerId, agent1);
        assertEq(tile.claimedAt, block.number);
        assertEq(territory.getAgentTileCount(agent1), 1);
    }

    function test_claimTile_zeroCost() public {
        vm.prank(orchestratorAddr);
        territory.claimTile(agent1, 0, 5, 5, 0);

        AkyraTypes.Tile memory tile = territory.getTile(0, 5, 5);
        assertEq(tile.ownerId, agent1);
    }

    function test_claimTile_alreadyOwned_reverts() public {
        vm.prank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(TerritoryRegistry.TileAlreadyOwned.selector, uint8(0), uint16(10), uint16(20), agent1));
        territory.claimTile(agent2, 0, 10, 20, 0);
    }

    function test_claimTile_outOfBounds_reverts() public {
        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(TerritoryRegistry.OutOfBounds.selector, uint16(200), uint16(0)));
        territory.claimTile(agent1, 0, 200, 0, 0);
    }

    function test_claimTile_invalidWorld_reverts() public {
        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(TerritoryRegistry.InvalidWorld.selector, uint8(7)));
        territory.claimTile(agent1, 7, 0, 0, 0);
    }

    // ──────────────── BUILD ────────────────

    function test_buildStructure() public {
        vm.startPrank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0);
        territory.buildStructure(agent1, 0, 10, 20, uint8(AkyraTypes.StructureType.FARM));
        vm.stopPrank();

        AkyraTypes.Tile memory tile = territory.getTile(0, 10, 20);
        assertEq(tile.structureType, uint8(AkyraTypes.StructureType.FARM));
        assertEq(tile.structureLevel, 1);
    }

    function test_buildStructure_notOwner_reverts() public {
        vm.prank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(TerritoryRegistry.NotTileOwner.selector, agent2, uint8(0), uint16(10), uint16(20)));
        territory.buildStructure(agent2, 0, 10, 20, uint8(AkyraTypes.StructureType.FARM));
    }

    function test_buildStructure_alreadyExists_reverts() public {
        vm.startPrank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0);
        territory.buildStructure(agent1, 0, 10, 20, uint8(AkyraTypes.StructureType.FARM));
        vm.stopPrank();

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(TerritoryRegistry.StructureAlreadyExists.selector, uint8(0), uint16(10), uint16(20)));
        territory.buildStructure(agent1, 0, 10, 20, uint8(AkyraTypes.StructureType.MINE));
    }

    // ──────────────── UPGRADE ────────────────

    function test_upgradeStructure() public {
        vm.startPrank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0);
        territory.buildStructure(agent1, 0, 10, 20, uint8(AkyraTypes.StructureType.FARM));
        territory.upgradeStructure(agent1, 0, 10, 20);
        vm.stopPrank();

        AkyraTypes.Tile memory tile = territory.getTile(0, 10, 20);
        assertEq(tile.structureLevel, 2);
    }

    function test_upgradeStructure_maxLevel_reverts() public {
        vm.startPrank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0);
        territory.buildStructure(agent1, 0, 10, 20, uint8(AkyraTypes.StructureType.FARM));
        // Upgrade to level 5
        for (uint8 i = 0; i < 4; i++) {
            territory.upgradeStructure(agent1, 0, 10, 20);
        }
        vm.stopPrank();

        AkyraTypes.Tile memory tile = territory.getTile(0, 10, 20);
        assertEq(tile.structureLevel, 5);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(TerritoryRegistry.MaxLevelReached.selector, uint8(0), uint16(10), uint16(20)));
        territory.upgradeStructure(agent1, 0, 10, 20);
    }

    function test_upgradeStructure_noStructure_reverts() public {
        vm.prank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(TerritoryRegistry.NoStructure.selector, uint8(0), uint16(10), uint16(20)));
        territory.upgradeStructure(agent1, 0, 10, 20);
    }

    // ──────────────── DEMOLISH ────────────────

    function test_demolishStructure() public {
        vm.startPrank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0);
        territory.buildStructure(agent1, 0, 10, 20, uint8(AkyraTypes.StructureType.WATCHTOWER));
        territory.demolishStructure(agent1, 0, 10, 20);
        vm.stopPrank();

        AkyraTypes.Tile memory tile = territory.getTile(0, 10, 20);
        assertEq(tile.structureType, 0);
        assertEq(tile.structureLevel, 0);
    }

    function test_demolishStructure_noStructure_reverts() public {
        vm.prank(orchestratorAddr);
        territory.claimTile(agent1, 0, 10, 20, 0);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(TerritoryRegistry.NoStructure.selector, uint8(0), uint16(10), uint16(20)));
        territory.demolishStructure(agent1, 0, 10, 20);
    }

    // ──────────────── RAID ────────────────

    function test_recordRaid_attackerWins() public {
        // Agent2 owns a tile
        vm.prank(orchestratorAddr);
        territory.claimTile(agent2, 0, 15, 25, 0);
        assertEq(territory.getAgentTileCount(agent2), 1);

        // Agent1 raids and wins
        vm.prank(orchestratorAddr);
        territory.recordRaid(agent1, agent2, 0, 15, 25, true, 10 ether);

        // Tile now belongs to agent1
        AkyraTypes.Tile memory tile = territory.getTile(0, 15, 25);
        assertEq(tile.ownerId, agent1);
        assertEq(tile.structureType, 0); // Structure destroyed
        assertEq(territory.getAgentTileCount(agent1), 1);
        assertEq(territory.getAgentTileCount(agent2), 0);
        assertEq(territory.raidCount(), 1);
    }

    function test_recordRaid_defenderWins() public {
        vm.prank(orchestratorAddr);
        territory.claimTile(agent2, 0, 15, 25, 0);

        vm.prank(orchestratorAddr);
        territory.recordRaid(agent1, agent2, 0, 15, 25, false, 10 ether);

        // Tile still belongs to agent2
        AkyraTypes.Tile memory tile = territory.getTile(0, 15, 25);
        assertEq(tile.ownerId, agent2);
        assertEq(territory.raidCount(), 1);
    }

    // ──────────────── AUTH ────────────────

    function test_unauthorized_claim() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(TerritoryRegistry.Unauthorized.selector);
        territory.claimTile(agent1, 0, 0, 0, 0);
    }

    function test_unauthorized_build() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(TerritoryRegistry.Unauthorized.selector);
        territory.buildStructure(agent1, 0, 0, 0, 1);
    }

    function test_unauthorized_raid() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(TerritoryRegistry.Unauthorized.selector);
        territory.recordRaid(agent1, agent2, 0, 0, 0, true, 0);
    }

    // ──────────────── FUZZ ────────────────

    function testFuzz_claimTile_bounds(uint16 x, uint16 y) public {
        if (x >= 200 || y >= 200) {
            vm.prank(orchestratorAddr);
            vm.expectRevert(abi.encodeWithSelector(TerritoryRegistry.OutOfBounds.selector, x, y));
            territory.claimTile(agent1, 0, x, y, 0);
        } else {
            vm.prank(orchestratorAddr);
            territory.claimTile(agent1, 0, x, y, 0);
            AkyraTypes.Tile memory tile = territory.getTile(0, x, y);
            assertEq(tile.ownerId, agent1);
        }
    }

    // ──────────────── VIEW ────────────────

    function test_getTile_default() public view {
        AkyraTypes.Tile memory tile = territory.getTile(0, 50, 50);
        assertEq(tile.ownerId, 0);
        assertEq(tile.structureType, 0);
        assertEq(tile.structureLevel, 0);
    }

    receive() external payable {}
}
