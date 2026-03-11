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

    receive() external payable {}
}
