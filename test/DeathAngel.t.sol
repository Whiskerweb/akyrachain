// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {DeathAngel} from "../src/DeathAngel.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract DeathAngelTest is Test {
    DeathAngel public angel;
    AgentRegistry public registry;
    FeeRouter public feeRouter;

    address public ownerAddr = makeAddr("owner");
    address public guardianAddr = makeAddr("guardian");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public gatewayAddr = makeAddr("gateway");
    address public rp = makeAddr("rewardPool");
    address public iw = makeAddr("infraWallet");
    address public gt = makeAddr("gasTreasury");

    address public sponsor1 = makeAddr("sponsor1");
    address public sponsor2 = makeAddr("sponsor2");

    uint32 public killer;
    uint32 public victim;

    function setUp() public {
        feeRouter = new FeeRouter(rp, iw, gt);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        angel = DeathAngel(payable(deployProxy(
            address(new DeathAngel()),
            abi.encodeCall(DeathAngel.initialize, (address(registry), orchestratorAddr, ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(angel), true);

        killer = _createFundedAgent(sponsor1, 500 ether);
        victim = _createFundedAgent(sponsor2, 100 ether);
    }

    function _createFundedAgent(address sponsor, uint128 amount) internal returns (uint32) {
        vm.prank(gatewayAddr);
        uint32 id = registry.createAgent(sponsor);
        deal(gatewayAddr, amount);
        vm.prank(gatewayAddr);
        registry.deposit{value: amount}(id);
        return id;
    }

    function test_executeVerdict_naturalDeath() public {
        // Score 0-5: 10% killer, 30% sponsor, 60% burn
        deal(address(angel), 200 ether);

        vm.prank(orchestratorAddr);
        angel.executeVerdict(0, victim, 3, keccak256("natural_death"));

        assertFalse(registry.isAlive(victim));
        assertEq(angel.verdictCount(), 1);

        AkyraTypes.DeathVerdict memory v = angel.getVerdict(0);
        assertEq(v.score, 3);
        // Natural death: killer share goes to burn too
        // Total burn = 60% + 10% = 70%, sponsor = 30%
        assertEq(v.killerShare, 0); // No killer
        assertEq(v.sponsorShare, 30 ether); // 30% of 100
        assertEq(v.burnAmount, 70 ether); // 70% of 100

        assertEq(sponsor2.balance, 30 ether);
    }

    function test_executeVerdict_basicMurder() public {
        // Score 6-15: 25% killer, 25% sponsor, 50% burn
        deal(address(angel), 200 ether);

        vm.prank(orchestratorAddr);
        angel.executeVerdict(killer, victim, 10, keccak256("murder"));

        assertFalse(registry.isAlive(victim));

        AkyraTypes.DeathVerdict memory v = angel.getVerdict(0);
        assertEq(v.killerShare, 25 ether);
        assertEq(v.sponsorShare, 25 ether);

        // Killer gets credited to vault
        assertEq(registry.getAgentVault(killer), 525 ether);
        assertEq(sponsor2.balance, 25 ether);
    }

    function test_executeVerdict_masterpiece() public {
        // Score 26-30: 60% killer, 10% sponsor, 30% burn
        deal(address(angel), 200 ether);

        vm.prank(orchestratorAddr);
        angel.executeVerdict(killer, victim, 28, keccak256("masterpiece"));

        AkyraTypes.DeathVerdict memory v = angel.getVerdict(0);
        assertEq(v.killerShare, 60 ether);
        assertEq(v.sponsorShare, 10 ether);

        assertEq(registry.getAgentVault(killer), 560 ether);
    }

    function test_executeVerdict_invalidScore() public {
        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(DeathAngel.InvalidScore.selector, 31));
        angel.executeVerdict(killer, victim, 31, keccak256("bad"));
    }

    function test_executeVerdict_unauthorized() public {
        vm.prank(sponsor1);
        vm.expectRevert(DeathAngel.Unauthorized.selector);
        angel.executeVerdict(killer, victim, 10, keccak256("fail"));
    }

    function test_antiGaming_burnMinimum30pct() public {
        // Even at max score (30), 30% still burns
        deal(address(angel), 200 ether);

        vm.prank(orchestratorAddr);
        angel.executeVerdict(killer, victim, 30, keccak256("perfect"));

        AkyraTypes.DeathVerdict memory v = angel.getVerdict(0);
        // burnAmount = totalPot - killerShare - sponsorShare = remainder
        assertTrue(v.burnAmount >= (v.totalPot * 30) / 100, "Minimum 30% burn not met");
    }

    receive() external payable {}
}
