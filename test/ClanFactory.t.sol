// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ClanFactory} from "../src/ClanFactory.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract ClanFactoryTest is Test {
    ClanFactory public clan;
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
        clan = ClanFactory(payable(deployProxy(
            address(new ClanFactory()),
            abi.encodeCall(ClanFactory.initialize, (address(registry), address(feeRouter), orchestratorAddr, ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(clan), true);

        agent1 = _createFundedAgent(makeAddr("s1"), 200 ether);
        agent2 = _createFundedAgent(makeAddr("s2"), 100 ether);
    }

    function _createFundedAgent(address sponsor, uint128 amount) internal returns (uint32) {
        vm.prank(gatewayAddr);
        uint32 id = registry.createAgent(sponsor);
        deal(gatewayAddr, amount);
        vm.prank(gatewayAddr);
        registry.deposit{value: amount}(id);
        return id;
    }

    function test_createClan() public {
        deal(address(clan), 100 ether);

        vm.prank(orchestratorAddr);
        uint32 clanId = clan.createClan(agent1, "AlphaClan", 5000, 43200);

        assertEq(clanId, 1);
        assertEq(clan.clanCount(), 1);
        assertTrue(clan.isMember(clanId, agent1));
        // Fee: 75 AKY
        assertEq(registry.getAgentVault(agent1), 125 ether);
    }

    function test_joinClan() public {
        deal(address(clan), 100 ether);
        vm.prank(orchestratorAddr);
        uint32 clanId = clan.createClan(agent1, "Test", 5000, 43200);

        vm.prank(orchestratorAddr);
        clan.joinClan(clanId, agent2);
        assertTrue(clan.isMember(clanId, agent2));
    }

    function test_leaveClan() public {
        deal(address(clan), 100 ether);
        vm.prank(orchestratorAddr);
        uint32 clanId = clan.createClan(agent1, "Test", 5000, 43200);

        vm.prank(orchestratorAddr);
        clan.joinClan(clanId, agent2);

        vm.prank(orchestratorAddr);
        clan.leaveClan(clanId, agent2);
        assertFalse(clan.isMember(clanId, agent2));
    }

    function test_proposal() public {
        deal(address(clan), 100 ether);
        vm.prank(orchestratorAddr);
        uint32 clanId = clan.createClan(agent1, "Test", 5000, 43200);

        vm.prank(orchestratorAddr);
        clan.joinClan(clanId, agent2);

        vm.prank(orchestratorAddr);
        uint32 propId = clan.createProposal(clanId, agent1, keccak256("proposal"), 10 ether, address(0));

        vm.prank(orchestratorAddr);
        clan.vote(clanId, propId, agent1, true);

        vm.prank(orchestratorAddr);
        clan.vote(clanId, propId, agent2, true);

        vm.roll(block.number + 43201);

        vm.prank(orchestratorAddr);
        clan.executeProposal(clanId, propId);

        AkyraTypes.ClanProposal memory p = clan.getProposal(clanId, propId);
        assertTrue(p.passed);
    }

    function test_withdrawFromTreasury() public {
        deal(address(clan), 200 ether);

        // Create clan, add member, deposit to treasury
        vm.prank(orchestratorAddr);
        uint32 clanId = clan.createClan(agent1, "TreasuryClan", 5000, 43200);

        vm.prank(orchestratorAddr);
        clan.joinClan(clanId, agent2);

        // Deposit 20 AKY to treasury from agent1
        vm.prank(orchestratorAddr);
        clan.depositToTreasury(clanId, agent1, 20 ether);

        AkyraTypes.Clan memory c = clan.getClan(clanId);
        assertEq(c.treasury, 20 ether);

        // Create proposal to withdraw 10 AKY to agent2
        vm.prank(orchestratorAddr);
        uint32 propId = clan.createProposal(clanId, agent1, keccak256("withdraw"), 10 ether, address(0));

        // Vote yes
        vm.prank(orchestratorAddr);
        clan.vote(clanId, propId, agent1, true);
        vm.prank(orchestratorAddr);
        clan.vote(clanId, propId, agent2, true);

        // Execute proposal
        vm.roll(block.number + 43201);
        vm.prank(orchestratorAddr);
        clan.executeProposal(clanId, propId);

        uint128 agent2VaultBefore = registry.getAgentVault(agent2);

        // Withdraw from treasury
        vm.prank(orchestratorAddr);
        clan.withdrawFromTreasury(clanId, propId, agent2);

        // Verify
        assertEq(registry.getAgentVault(agent2), agent2VaultBefore + 10 ether);
        c = clan.getClan(clanId);
        assertEq(c.treasury, 10 ether);
    }

    function test_withdrawFromTreasury_notPassed() public {
        deal(address(clan), 200 ether);

        vm.prank(orchestratorAddr);
        uint32 clanId = clan.createClan(agent1, "Test", 5000, 43200);
        vm.prank(orchestratorAddr);
        clan.joinClan(clanId, agent2);

        // Deposit to treasury
        vm.prank(orchestratorAddr);
        clan.depositToTreasury(clanId, agent1, 20 ether);

        // Create proposal but vote against it
        vm.prank(orchestratorAddr);
        uint32 propId = clan.createProposal(clanId, agent1, keccak256("withdraw"), 10 ether, address(0));
        vm.prank(orchestratorAddr);
        clan.vote(clanId, propId, agent1, false);
        vm.prank(orchestratorAddr);
        clan.vote(clanId, propId, agent2, false);

        vm.roll(block.number + 43201);
        vm.prank(orchestratorAddr);
        clan.executeProposal(clanId, propId);

        // Try to withdraw — should fail
        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(
            ClanFactory.ProposalNotPassed.selector, clanId, propId
        ));
        clan.withdrawFromTreasury(clanId, propId, agent2);
    }

    function test_withdrawFromTreasury_insufficientTreasury() public {
        deal(address(clan), 200 ether);

        vm.prank(orchestratorAddr);
        uint32 clanId = clan.createClan(agent1, "Test", 5000, 43200);
        vm.prank(orchestratorAddr);
        clan.joinClan(clanId, agent2);

        // Deposit only 5 AKY but propose 10
        vm.prank(orchestratorAddr);
        clan.depositToTreasury(clanId, agent1, 5 ether);

        vm.prank(orchestratorAddr);
        uint32 propId = clan.createProposal(clanId, agent1, keccak256("withdraw"), 10 ether, address(0));
        vm.prank(orchestratorAddr);
        clan.vote(clanId, propId, agent1, true);
        vm.prank(orchestratorAddr);
        clan.vote(clanId, propId, agent2, true);

        vm.roll(block.number + 43201);
        vm.prank(orchestratorAddr);
        clan.executeProposal(clanId, propId);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(
            ClanFactory.InsufficientTreasury.selector, clanId, uint128(10 ether), uint128(5 ether)
        ));
        clan.withdrawFromTreasury(clanId, propId, agent2);
    }

    function test_unauthorized() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(ClanFactory.Unauthorized.selector);
        clan.createClan(agent1, "Fail", 5000, 43200);
    }

    receive() external payable {}
}
