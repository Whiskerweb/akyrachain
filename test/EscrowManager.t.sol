// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {EscrowManager} from "../src/EscrowManager.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract EscrowManagerTest is Test {
    EscrowManager public escrow;
    AgentRegistry public registry;
    FeeRouter public feeRouter;

    address public ownerAddr = makeAddr("owner");
    address public guardianAddr = makeAddr("guardian");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public gatewayAddr = makeAddr("gateway");
    address public sponsor1 = makeAddr("sponsor1");
    address public sponsor2 = makeAddr("sponsor2");
    address public sponsor3 = makeAddr("sponsor3");
    address public rp = makeAddr("rewardPool");
    address public iw = makeAddr("infraWallet");
    address public gt = makeAddr("gasTreasury");

    uint32 public agent1;
    uint32 public agent2;
    uint32 public agent3;

    function setUp() public {
        feeRouter = new FeeRouter(rp, iw, gt);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        escrow = EscrowManager(payable(deployProxy(
            address(new EscrowManager()),
            abi.encodeCall(EscrowManager.initialize, (address(registry), address(feeRouter), orchestratorAddr, ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(escrow), true);

        agent1 = _createFundedAgent(sponsor1, 1000 ether);
        agent2 = _createFundedAgent(sponsor2, 500 ether);
        agent3 = _createFundedAgent(sponsor3, 100 ether);
    }

    function _createFundedAgent(address sponsor, uint128 amount) internal returns (uint32) {
        vm.prank(gatewayAddr);
        uint32 id = registry.createAgent(sponsor);
        deal(gatewayAddr, amount);
        vm.prank(gatewayAddr);
        registry.deposit{value: amount}(id);
        return id;
    }

    // ──── FULL LIFECYCLE ────

    function test_fullLifecycle_complete() public {
        // Create job
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 100 ether, keccak256("spec"), uint64(block.number + 10000));
        assertEq(jobId, 1);

        // Fund job
        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        assertEq(registry.getAgentVault(agent1), 900 ether); // 1000 - 100
        assertEq(escrow.escrowBalance(jobId), 100 ether);

        // Submit deliverable
        vm.prank(orchestratorAddr);
        escrow.submitDeliverable(jobId, keccak256("deliverable"));

        // Complete (need ETH in escrow for fee routing)
        deal(address(escrow), 100 ether);
        vm.prank(orchestratorAddr);
        escrow.completeJob(jobId);

        // Provider receives: 100 - 0.5% fee = 99.5
        assertEq(registry.getAgentVault(agent2), 599.5 ether);

        // Both agents honored
        AkyraTypes.Agent memory a1 = registry.getAgent(agent1);
        AkyraTypes.Agent memory a2 = registry.getAgent(agent2);
        assertEq(a1.contractsHonored, 1);
        assertEq(a2.contractsHonored, 1);
    }

    function test_fullLifecycle_reject() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 10000));

        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        vm.prank(orchestratorAddr);
        escrow.submitDeliverable(jobId, keccak256("bad_work"));

        vm.prank(orchestratorAddr);
        escrow.rejectJob(jobId);

        // Client refunded
        assertEq(registry.getAgentVault(agent1), 1000 ether);
        // Provider broken
        assertEq(registry.getAgent(agent2).contractsBroken, 1);
    }

    function test_fullLifecycle_expire() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 100));

        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        // Wait for deadline
        vm.roll(block.number + 101);

        // Anyone can expire
        escrow.expireJob(jobId);

        assertEq(registry.getAgentVault(agent1), 1000 ether); // Refunded
    }

    function test_expire_beforeDeadline() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 1000));

        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        vm.expectRevert();
        escrow.expireJob(jobId);
    }

    // ──── STATE MACHINE ────

    function test_invalidTransition_fundTwice() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 10000));

        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        vm.prank(orchestratorAddr);
        vm.expectRevert();
        escrow.fundJob(jobId);
    }

    function test_breakContract() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 10000));

        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        vm.prank(orchestratorAddr);
        escrow.breakContract(jobId);

        assertEq(registry.getAgentVault(agent1), 1000 ether); // Refunded
        assertEq(registry.getAgent(agent2).contractsBroken, 1);
    }

    // ──── ACCESS CONTROL ────

    function test_unauthorized() public {
        vm.prank(sponsor1);
        vm.expectRevert(EscrowManager.Unauthorized.selector);
        escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 10000));
    }

    // ──── VALIDATION: SAME AGENT ────

    function test_createJob_sameClientProvider() public {
        vm.prank(orchestratorAddr);
        vm.expectRevert(EscrowManager.SameAgent.selector);
        escrow.createJob(agent1, agent1, agent3, 50 ether, keccak256("spec"), uint64(block.number + 1000));
    }

    function test_createJob_evaluatorIsClient() public {
        vm.prank(orchestratorAddr);
        vm.expectRevert(EscrowManager.SameAgent.selector);
        escrow.createJob(agent1, agent2, agent1, 50 ether, keccak256("spec"), uint64(block.number + 1000));
    }

    function test_createJob_evaluatorIsProvider() public {
        vm.prank(orchestratorAddr);
        vm.expectRevert(EscrowManager.SameAgent.selector);
        escrow.createJob(agent1, agent2, agent2, 50 ether, keccak256("spec"), uint64(block.number + 1000));
    }

    // ──── VALIDATION: ZERO AMOUNT ────

    function test_createJob_zeroAmount() public {
        vm.prank(orchestratorAddr);
        vm.expectRevert(EscrowManager.ZeroAmount.selector);
        escrow.createJob(agent1, agent2, agent3, 0, keccak256("spec"), uint64(block.number + 1000));
    }

    // ──── VALIDATION: DEAD AGENT ────

    function test_createJob_deadClient() public {
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(this), true);
        registry.debitVault(agent1, 1000 ether); // auto-kills when vault=0

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(EscrowManager.AgentNotAlive.selector, agent1));
        escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 1000));
    }

    function test_createJob_deadProvider() public {
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(this), true);
        registry.debitVault(agent2, 500 ether); // auto-kills when vault=0

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(EscrowManager.AgentNotAlive.selector, agent2));
        escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 1000));
    }

    // ──── STATE TRANSITIONS ────

    function test_submitDeliverable_wrongState() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 10000));

        // Try to submit before funding
        vm.prank(orchestratorAddr);
        vm.expectRevert();
        escrow.submitDeliverable(jobId, keccak256("deliverable"));
    }

    function test_completeJob_wrongState() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 10000));

        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        // Try to complete before submitting
        vm.prank(orchestratorAddr);
        vm.expectRevert();
        escrow.completeJob(jobId);
    }

    function test_rejectJob_wrongState() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 10000));

        // Try to reject OPEN job
        vm.prank(orchestratorAddr);
        vm.expectRevert();
        escrow.rejectJob(jobId);
    }

    // ──── BREAK CONTRACT FROM SUBMITTED STATE ────

    function test_breakContract_fromSubmitted() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 10000));

        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        vm.prank(orchestratorAddr);
        escrow.submitDeliverable(jobId, keccak256("deliverable"));

        vm.prank(orchestratorAddr);
        escrow.breakContract(jobId);

        assertEq(registry.getAgentVault(agent1), 1000 ether); // Refunded
        assertEq(registry.getAgent(agent2).contractsBroken, 1);
    }

    function test_breakContract_wrongState() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 10000));

        // Try to break OPEN job
        vm.prank(orchestratorAddr);
        vm.expectRevert();
        escrow.breakContract(jobId);
    }

    // ──── EXPIRE FROM SUBMITTED STATE ────

    function test_expire_fromSubmitted() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, agent3, 50 ether, keccak256("spec"), uint64(block.number + 100));

        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        vm.prank(orchestratorAddr);
        escrow.submitDeliverable(jobId, keccak256("deliverable"));

        vm.roll(block.number + 101);

        escrow.expireJob(jobId);
        assertEq(registry.getAgentVault(agent1), 1000 ether); // Refunded
    }

    // ──── EVALUATOR ID 0 (NO EVALUATOR) ────

    function test_createJob_noEvaluator() public {
        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(agent1, agent2, 0, 50 ether, keccak256("spec"), uint64(block.number + 10000));

        AkyraTypes.Job memory job = escrow.getJob(jobId);
        assertEq(job.evaluatorAgentId, 0);
    }

    // ──── FEE INVARIANT FUZZ ────

    function testFuzz_completeJob_feeInvariant(uint128 amount) public {
        amount = uint128(bound(amount, 1 ether, 500 ether));

        // Create agents with enough funds
        address s4 = makeAddr("sponsor4");
        address s5 = makeAddr("sponsor5");
        address s6 = makeAddr("sponsor6");
        uint32 c = _createFundedAgent(s4, amount + 10 ether);
        uint32 p = _createFundedAgent(s5, 10 ether);
        uint32 e = _createFundedAgent(s6, 10 ether);

        vm.prank(orchestratorAddr);
        uint256 jobId = escrow.createJob(c, p, e, amount, keccak256("fuzz"), uint64(block.number + 10000));

        vm.prank(orchestratorAddr);
        escrow.fundJob(jobId);

        vm.prank(orchestratorAddr);
        escrow.submitDeliverable(jobId, keccak256("done"));

        uint128 providerBefore = registry.getAgentVault(p);
        deal(address(escrow), uint256(amount));

        vm.prank(orchestratorAddr);
        escrow.completeJob(jobId);

        uint128 providerAfter = registry.getAgentVault(p);
        uint128 payout = providerAfter - providerBefore;
        uint128 fee = amount - payout;

        // Fee should be exactly 0.5%
        assertEq(fee, (amount * 50) / 10000, "Fee is not 0.5%");
    }

    // ──── JOB COUNT ────

    function test_jobCount_increments() public {
        vm.startPrank(orchestratorAddr);
        escrow.createJob(agent1, agent2, agent3, 10 ether, keccak256("a"), uint64(block.number + 1000));
        escrow.createJob(agent1, agent2, agent3, 20 ether, keccak256("b"), uint64(block.number + 1000));
        escrow.createJob(agent1, agent2, agent3, 30 ether, keccak256("c"), uint64(block.number + 1000));
        vm.stopPrank();

        assertEq(escrow.jobCount(), 3);
    }

    receive() external payable {}
}
