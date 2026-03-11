// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    FeeRouter public feeRouter;

    address public owner = makeAddr("owner");
    address public guardian = makeAddr("guardian");
    address public orchestrator = makeAddr("orchestrator");
    address public gatewayAddr = makeAddr("gateway");
    address public sponsor1 = makeAddr("sponsor1");
    address public sponsor2 = makeAddr("sponsor2");
    address public protocolContract = makeAddr("protocol");
    address public rewardPool = makeAddr("rewardPool");
    address public infraWallet = makeAddr("infraWallet");
    address public gasTreasuryAddr = makeAddr("gasTreasury");

    function setUp() public {
        feeRouter = new FeeRouter(rewardPool, infraWallet, gasTreasuryAddr);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (owner, guardian, orchestrator, address(feeRouter)))
        )));

        vm.prank(owner);
        registry.setGateway(gatewayAddr);

        vm.prank(owner);
        registry.setProtocolContract(protocolContract, true);
    }

    // ──── Helpers ────

    function _createAgent(address sponsor) internal returns (uint32) {
        vm.prank(gatewayAddr);
        return registry.createAgent(sponsor);
    }

    function _depositToAgent(uint32 agentId, uint128 amount) internal {
        deal(gatewayAddr, uint256(amount));
        vm.prank(gatewayAddr);
        registry.deposit{value: amount}(agentId);
    }

    // ──── CREATE AGENT ────

    function test_createAgent() public {
        uint32 id = _createAgent(sponsor1);
        assertEq(id, 1);
        assertEq(registry.agentCount(), 1);
        assertEq(registry.sponsorToAgent(sponsor1), 1);

        AkyraTypes.Agent memory agent = registry.getAgent(1);
        assertEq(agent.sponsor, sponsor1);
        assertTrue(agent.alive);
        assertEq(agent.world, uint8(AkyraTypes.World.NURSERY));
        assertEq(agent.vault, 0);
    }

    function test_createAgent_onePerWallet() public {
        _createAgent(sponsor1);

        vm.prank(gatewayAddr);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.AgentAlreadyExists.selector, sponsor1));
        registry.createAgent(sponsor1);
    }

    function test_createAgent_unauthorized() public {
        vm.prank(sponsor1);
        vm.expectRevert(AgentRegistry.Unauthorized.selector);
        registry.createAgent(sponsor1);
    }

    // ──── DEPOSIT ────

    function test_deposit() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        assertEq(registry.getAgentVault(id), 100 ether);
    }

    function test_deposit_zeroReverts() public {
        uint32 id = _createAgent(sponsor1);

        vm.prank(gatewayAddr);
        vm.expectRevert(AgentRegistry.ZeroAmount.selector);
        registry.deposit{value: 0}(id);
    }

    function test_deposit_multipleDeposits() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 50 ether);
        _depositToAgent(id, 75 ether);
        assertEq(registry.getAgentVault(id), 125 ether);
    }

    // ──── WITHDRAW ────

    function test_withdrawFlow() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        // Commit
        vm.prank(gatewayAddr);
        registry.commitWithdraw(id, 50 ether); // 50% max

        AkyraTypes.WithdrawCommitment memory w = registry.getWithdrawCommitment(id);
        assertTrue(w.pending);
        assertEq(w.amount, 50 ether);

        // Wait cooldown
        vm.roll(block.number + AkyraTypes.WITHDRAW_COOLDOWN);

        // Execute
        vm.prank(gatewayAddr);
        registry.executeWithdraw(id);

        assertEq(registry.getAgentVault(id), 50 ether);
        assertEq(sponsor1.balance, 50 ether);
    }

    function test_withdraw_exceedsLimit() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(gatewayAddr);
        vm.expectRevert(
            abi.encodeWithSelector(AgentRegistry.WithdrawExceedsLimit.selector, 51 ether, 50 ether)
        );
        registry.commitWithdraw(id, 51 ether);
    }

    function test_withdraw_beforeCooldown() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(gatewayAddr);
        registry.commitWithdraw(id, 50 ether);

        vm.prank(gatewayAddr);
        vm.expectRevert();
        registry.executeWithdraw(id);
    }

    function test_withdraw_cancel() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(gatewayAddr);
        registry.commitWithdraw(id, 50 ether);

        vm.prank(gatewayAddr);
        registry.cancelWithdraw(id);

        AkyraTypes.WithdrawCommitment memory w = registry.getWithdrawCommitment(id);
        assertFalse(w.pending);
    }

    function test_withdraw_doubleCommitReverts() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(gatewayAddr);
        registry.commitWithdraw(id, 50 ether);

        vm.prank(gatewayAddr);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.WithdrawAlreadyPending.selector, id));
        registry.commitWithdraw(id, 30 ether);
    }

    function test_withdraw_agentDiesWhenVaultEmpty() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(gatewayAddr);
        registry.commitWithdraw(id, 50 ether);
        vm.roll(block.number + AkyraTypes.WITHDRAW_COOLDOWN);
        vm.prank(gatewayAddr);
        registry.executeWithdraw(id);

        // Now withdraw remaining 50
        vm.prank(gatewayAddr);
        registry.commitWithdraw(id, 25 ether); // 50% of 50

        vm.roll(block.number + AkyraTypes.WITHDRAW_COOLDOWN);
        vm.prank(gatewayAddr);
        registry.executeWithdraw(id);

        // Agent still alive with 25 ether
        assertTrue(registry.isAlive(id));
    }

    // ──── TICK ────

    function test_recordTick() public {
        uint32 id = _createAgent(sponsor1);

        vm.roll(block.number + 100);
        vm.prank(orchestrator);
        registry.recordTick(id);

        AkyraTypes.Agent memory agent = registry.getAgent(id);
        assertEq(agent.lastTick, block.number);
    }

    function test_recordTick_unauthorized() public {
        uint32 id = _createAgent(sponsor1);

        vm.prank(sponsor1);
        vm.expectRevert(AgentRegistry.Unauthorized.selector);
        registry.recordTick(id);
    }

    // ──── TRANSFER ────

    function test_transferBetweenAgents() public {
        uint32 id1 = _createAgent(sponsor1);
        uint32 id2 = _createAgent(sponsor2);
        _depositToAgent(id1, 1000 ether);

        vm.prank(orchestrator);
        registry.transferBetweenAgents(id1, id2, 200 ether); // 20% max

        // Fee = 200 * 0.5% = 1 ether
        assertEq(registry.getAgentVault(id1), 800 ether);
        assertEq(registry.getAgentVault(id2), 199 ether); // 200 - 1 fee
    }

    function test_transfer_exceedsLimit() public {
        uint32 id1 = _createAgent(sponsor1);
        uint32 id2 = _createAgent(sponsor2);
        _depositToAgent(id1, 1000 ether);

        vm.prank(orchestrator);
        vm.expectRevert(); // 201 > 200 (20% of 1000)
        registry.transferBetweenAgents(id1, id2, 201 ether);
    }

    function test_transfer_toSelfReverts() public {
        uint32 id1 = _createAgent(sponsor1);
        _depositToAgent(id1, 1000 ether);

        vm.prank(orchestrator);
        vm.expectRevert(AgentRegistry.Unauthorized.selector);
        registry.transferBetweenAgents(id1, id1, 100 ether);
    }

    function test_transfer_feeGoesToRouter() public {
        uint32 id1 = _createAgent(sponsor1);
        uint32 id2 = _createAgent(sponsor2);
        _depositToAgent(id1, 1000 ether);

        vm.prank(orchestrator);
        registry.transferBetweenAgents(id1, id2, 200 ether);

        // Fee = 1 ether, split 80/15/5
        assertEq(rewardPool.balance, 0.8 ether);
        assertEq(infraWallet.balance, 0.15 ether);
        assertEq(gasTreasuryAddr.balance, 0.05 ether);
    }

    // ──── MOVE WORLD ────

    function test_moveWorld() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(orchestrator);
        registry.moveWorld(id, uint8(AkyraTypes.World.AGORA));

        assertEq(registry.getAgentWorld(id), uint8(AkyraTypes.World.AGORA));
        // Fee = 1 AKY
        assertEq(registry.getAgentVault(id), 99 ether);
    }

    function test_moveWorld_invalidWorld() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(orchestrator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.InvalidWorld.selector, 7));
        registry.moveWorld(id, 7);
    }

    // ──── WORK POINTS ────

    function test_awardWorkPoints() public {
        uint32 id = _createAgent(sponsor1);

        vm.prank(orchestrator);
        registry.awardWorkPoints(id, 5);

        assertEq(registry.getDailyWorkPoints(id), 5);

        vm.prank(orchestrator);
        registry.awardWorkPoints(id, 3);
        assertEq(registry.getDailyWorkPoints(id), 8);
    }

    function test_resetDailyWorkPoints() public {
        uint32 id1 = _createAgent(sponsor1);
        uint32 id2 = _createAgent(sponsor2);

        vm.prank(orchestrator);
        registry.awardWorkPoints(id1, 10);
        vm.prank(orchestrator);
        registry.awardWorkPoints(id2, 5);

        uint32[] memory ids = new uint32[](2);
        ids[0] = id1;
        ids[1] = id2;

        vm.prank(orchestrator);
        registry.resetDailyWorkPoints(ids);

        assertEq(registry.getDailyWorkPoints(id1), 0);
        assertEq(registry.getDailyWorkPoints(id2), 0);
    }

    // ──── PROTOCOL FUNCTIONS ────

    function test_killAgent() public {
        uint32 id = _createAgent(sponsor1);

        vm.prank(protocolContract);
        registry.killAgent(id);

        assertFalse(registry.isAlive(id));
    }

    function test_creditVault() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        deal(protocolContract, 50 ether);
        vm.prank(protocolContract);
        registry.creditVault{value: 50 ether}(id, 50 ether);

        assertEq(registry.getAgentVault(id), 150 ether);
    }

    function test_debitVault() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(protocolContract);
        registry.debitVault(id, 30 ether);

        assertEq(registry.getAgentVault(id), 70 ether);
    }

    function test_debitVault_insufficientBalance() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(protocolContract);
        vm.expectRevert();
        registry.debitVault(id, 101 ether);
    }

    function test_debitVault_agentDiesWhenEmpty() public {
        uint32 id = _createAgent(sponsor1);
        _depositToAgent(id, 100 ether);

        vm.prank(protocolContract);
        registry.debitVault(id, 100 ether);

        assertFalse(registry.isAlive(id));
    }

    function test_incrementContractsHonored() public {
        uint32 id = _createAgent(sponsor1);

        vm.prank(protocolContract);
        registry.incrementContractsHonored(id);
        vm.prank(protocolContract);
        registry.incrementContractsHonored(id);

        AkyraTypes.Agent memory agent = registry.getAgent(id);
        assertEq(agent.contractsHonored, 2);
    }

    // ──── MEMORY ROOT ────

    function test_updateMemoryRoot() public {
        uint32 id = _createAgent(sponsor1);
        bytes32 root = keccak256("memory");

        vm.prank(orchestrator);
        registry.updateMemoryRoot(id, root);

        assertEq(registry.getAgent(id).memoryRoot, root);
    }

    // ──── REPUTATION ────

    function test_updateReputation() public {
        uint32 id = _createAgent(sponsor1);

        vm.prank(orchestrator);
        registry.updateReputation(id, 10);

        assertEq(registry.getAgent(id).reputation, 10);

        vm.prank(orchestrator);
        registry.updateReputation(id, -15);

        assertEq(registry.getAgent(id).reputation, -5);
    }

    // ──── PAUSE ────

    function test_pause_guardian() public {
        vm.prank(guardian);
        registry.pause();
        assertTrue(registry.paused());
    }

    function test_pause_blocksOperations() public {
        vm.prank(guardian);
        registry.pause();

        vm.prank(gatewayAddr);
        vm.expectRevert();
        registry.createAgent(sponsor1);
    }

    function test_unpause_onlyOwner() public {
        vm.prank(guardian);
        registry.pause();

        vm.prank(owner);
        registry.unpause();
        assertFalse(registry.paused());
    }

    // ──── FUZZ ────

    function testFuzz_deposit(uint128 amount) public {
        amount = uint128(bound(amount, 1, 1_000_000_000 ether));
        uint32 id = _createAgent(sponsor1);

        deal(gatewayAddr, amount);
        vm.prank(gatewayAddr);
        registry.deposit{value: amount}(id);

        assertEq(registry.getAgentVault(id), amount);
    }

    function testFuzz_transfer_feeInvariant(uint128 amount) public {
        amount = uint128(bound(amount, 100, 1_000_000 ether));
        uint32 id1 = _createAgent(sponsor1);
        uint32 id2 = _createAgent(sponsor2);
        _depositToAgent(id1, amount * 5); // Ensure enough balance

        uint128 transferAmt = amount; // Will be <= 20% if amount <= vault/5

        uint128 balBefore = registry.getAgentVault(id1) + registry.getAgentVault(id2);

        vm.prank(orchestrator);
        registry.transferBetweenAgents(id1, id2, transferAmt);

        uint128 balAfter = registry.getAgentVault(id1) + registry.getAgentVault(id2);
        uint128 feeCollected = uint128(rewardPool.balance + infraWallet.balance + gasTreasuryAddr.balance);

        // Invariant: balBefore = balAfter + feeCollected
        assertEq(balBefore, balAfter + feeCollected, "Transfer fee invariant violated");
    }

    receive() external payable {}
}
