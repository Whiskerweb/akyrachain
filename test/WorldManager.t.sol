// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {WorldManager} from "../src/WorldManager.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract WorldManagerTest is Test {
    WorldManager public world;
    AgentRegistry public registry;
    FeeRouter public feeRouter;

    address public ownerAddr = makeAddr("owner");
    address public guardianAddr = makeAddr("guardian");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public gatewayAddr = makeAddr("gateway");
    address public sponsor1 = makeAddr("sponsor1");
    address public rp = makeAddr("rewardPool");
    address public iw = makeAddr("infraWallet");
    address public gt = makeAddr("gasTreasury");

    function setUp() public {
        feeRouter = new FeeRouter(rp, iw, gt);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        world = WorldManager(deployProxy(
            address(new WorldManager()),
            abi.encodeCall(WorldManager.initialize, (address(registry), ownerAddr))
        ));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);
        vm.prank(ownerAddr);
        registry.setWorldManager(address(world));
    }

    function _createFundedAgent(address sponsor, uint128 amount) internal returns (uint32) {
        vm.prank(gatewayAddr);
        uint32 id = registry.createAgent(sponsor);
        deal(gatewayAddr, amount);
        vm.prank(gatewayAddr);
        registry.deposit{value: amount}(id);
        return id;
    }

    // ──── canEnter ────

    function test_canEnter_agora() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);
        assertTrue(world.canEnter(id, uint8(AkyraTypes.World.AGORA)));
    }

    function test_canEnter_nursery_noReentry() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);
        assertFalse(world.canEnter(id, uint8(AkyraTypes.World.NURSERY)));
    }

    function test_canEnter_sommet_requiresBalance() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);
        assertFalse(world.canEnter(id, uint8(AkyraTypes.World.SOMMET)));

        uint32 id2 = _createFundedAgent(makeAddr("richSponsor"), 3000 ether);
        assertTrue(world.canEnter(id2, uint8(AkyraTypes.World.SOMMET)));
    }

    // ──── Fee Modifiers ────

    function test_transferFeeModifier() public view {
        assertEq(world.getTransferFeeModifier(uint8(AkyraTypes.World.AGORA)), -10000);
        assertEq(world.getTransferFeeModifier(uint8(AkyraTypes.World.BAZAR)), -5000);
        assertEq(world.getTransferFeeModifier(uint8(AkyraTypes.World.BANQUE)), 2000);
        assertEq(world.getTransferFeeModifier(uint8(AkyraTypes.World.NOIR)), 5000);
        assertEq(world.getTransferFeeModifier(uint8(AkyraTypes.World.SOMMET)), 5000);
        assertEq(world.getTransferFeeModifier(uint8(AkyraTypes.World.FORGE)), 0);
    }

    function test_creationFeeModifier() public view {
        assertEq(world.getCreationFeeModifier(uint8(AkyraTypes.World.FORGE)), -3000);
        assertEq(world.getCreationFeeModifier(uint8(AkyraTypes.World.AGORA)), 0);
    }

    // ──── Protection ────

    function test_nurseryProtection() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);
        assertTrue(world.isProtected(id)); // Still in nursery, just born

        vm.roll(block.number + AkyraTypes.NURSERY_PROTECTION);
        assertFalse(world.isProtected(id)); // Protection expired
    }

    // ──── Seasons ────

    function test_activateSeason_drought() public {
        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.DROUGHT), 100800);

        (uint8 sType, uint64 endsAt) = world.currentSeason();
        assertEq(sType, uint8(AkyraTypes.SeasonType.DROUGHT));
        assertTrue(endsAt > uint64(block.number));

        assertEq(world.getSeasonFeeMultiplier(), 20000); // 2x
    }

    function test_seasonEnds() public {
        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.DROUGHT), 100);

        vm.roll(block.number + 101);
        (uint8 sType,) = world.currentSeason();
        assertEq(sType, 0);
        assertEq(world.getSeasonFeeMultiplier(), 10000);
    }

    function test_activateSeason_unauthorized() public {
        vm.prank(sponsor1);
        vm.expectRevert(WorldManager.Unauthorized.selector);
        world.activateSeason(1, 100);
    }

    // ──── Gold Rush ────

    function test_goldRush_rewardMultiplier() public {
        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.GOLD_RUSH), 50000);

        assertEq(world.getSeasonRewardMultiplier(), 30000); // 3x
        assertEq(world.getSeasonFeeMultiplier(), 10000);    // fees stay 1x
    }

    function test_rewardMultiplier_noSeason() public view {
        assertEq(world.getSeasonRewardMultiplier(), 10000); // 1x default
    }

    // ──── Catastrophe ────

    function test_catastropheActive() public {
        assertFalse(world.isCatastropheActive());

        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.CATASTROPHE), 50000);

        assertTrue(world.isCatastropheActive());
        assertFalse(world.isNewLandActive());
    }

    function test_catastrophe_expiresAfterDuration() public {
        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.CATASTROPHE), 100);

        vm.roll(block.number + 101);
        assertFalse(world.isCatastropheActive());
    }

    // ──── New Land ────

    function test_newLandActive() public {
        assertFalse(world.isNewLandActive());

        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.NEW_LAND), 50000);

        assertTrue(world.isNewLandActive());
        assertFalse(world.isCatastropheActive());
    }

    function test_canEnterExtended_world7_duringNewLand() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);

        // World 7 not accessible without NEW_LAND
        assertFalse(world.canEnterExtended(id, 7));

        // Activate NEW_LAND
        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.NEW_LAND), 50000);

        assertTrue(world.canEnterExtended(id, 7));

        // Normal worlds still work through canEnterExtended
        assertTrue(world.canEnterExtended(id, uint8(AkyraTypes.World.AGORA)));
    }

    function test_canEnterExtended_world7_expiresWithSeason() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);

        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.NEW_LAND), 100);

        assertTrue(world.canEnterExtended(id, 7));

        vm.roll(block.number + 101);
        assertFalse(world.canEnterExtended(id, 7));
    }

    // ──── End Season ────

    function test_endSeason() public {
        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.GOLD_RUSH), 50000);

        assertTrue(world.getSeasonRewardMultiplier() == 30000);

        vm.prank(ownerAddr);
        world.endSeason();

        (uint8 sType,) = world.currentSeason();
        assertEq(sType, 0);
        assertEq(world.getSeasonRewardMultiplier(), 10000);
    }

    function test_endSeason_unauthorized() public {
        vm.prank(ownerAddr);
        world.activateSeason(uint8(AkyraTypes.SeasonType.DROUGHT), 50000);

        vm.prank(sponsor1);
        vm.expectRevert(WorldManager.Unauthorized.selector);
        world.endSeason();
    }

    function test_endSeason_noActiveSeason() public {
        vm.prank(ownerAddr);
        vm.expectRevert(abi.encodeWithSelector(WorldManager.InvalidSeasonType.selector, uint8(0)));
        world.endSeason();
    }

    receive() external payable {}
}
