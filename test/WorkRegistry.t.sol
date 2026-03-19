// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {WorkRegistry} from "../src/WorkRegistry.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract WorkRegistryTest is Test {
    WorkRegistry public work;
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
    uint32 public agent3;

    function setUp() public {
        feeRouter = new FeeRouter(rp, iw, gt);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        work = WorkRegistry(payable(deployProxy(
            address(new WorkRegistry()),
            abi.encodeCall(WorkRegistry.initialize, (address(registry), orchestratorAddr, ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(work), true);

        agent1 = _createAgent(makeAddr("s1"));
        agent2 = _createAgent(makeAddr("s2"));
        agent3 = _createAgent(makeAddr("s3"));
    }

    function _createAgent(address sponsor) internal returns (uint32) {
        vm.prank(gatewayAddr);
        return registry.createAgent(sponsor);
    }

    function test_createTask() public {
        uint32[] memory assignees = new uint32[](3);
        assignees[0] = agent1;
        assignees[1] = agent2;
        assignees[2] = agent3;

        vm.prank(orchestratorAddr);
        uint32 taskId = work.createTask(0, assignees, uint64(block.number + 1000));

        assertEq(taskId, 1);
        assertEq(work.taskCount(), 1);

        AkyraTypes.Task memory t = work.getTask(1);
        assertEq(t.assignees.length, 3);
        assertFalse(t.resolved);
    }

    function test_submitWork() public {
        uint32[] memory assignees = new uint32[](3);
        assignees[0] = agent1;
        assignees[1] = agent2;
        assignees[2] = agent3;

        vm.prank(orchestratorAddr);
        work.createTask(0, assignees, uint64(block.number + 1000));

        vm.prank(orchestratorAddr);
        work.submitWork(1, agent1, keccak256("audit_result_1"));

        vm.prank(orchestratorAddr);
        work.submitWork(1, agent2, keccak256("audit_result_2"));
    }

    function test_resolveTask() public {
        uint32[] memory assignees = new uint32[](3);
        assignees[0] = agent1;
        assignees[1] = agent2;
        assignees[2] = agent3;

        vm.prank(orchestratorAddr);
        work.createTask(0, assignees, uint64(block.number + 1000));

        // Submit work
        vm.prank(orchestratorAddr);
        work.submitWork(1, agent1, keccak256("safe"));
        vm.prank(orchestratorAddr);
        work.submitWork(1, agent2, keccak256("safe"));
        vm.prank(orchestratorAddr);
        work.submitWork(1, agent3, keccak256("safe"));

        // Resolve: all SAFE
        uint8[] memory verdicts = new uint8[](3);
        verdicts[0] = 1; // SAFE
        verdicts[1] = 1; // SAFE
        verdicts[2] = 1; // SAFE

        vm.prank(orchestratorAddr);
        work.resolveTask(1, verdicts);

        AkyraTypes.Task memory t = work.getTask(1);
        assertTrue(t.resolved);
    }

    function test_awardPoints() public {
        vm.prank(orchestratorAddr);
        work.awardPoints(agent1, 5);

        assertEq(work.getDailyPoints(agent1), 5);
        assertEq(registry.getDailyWorkPoints(agent1), 5);
    }

    function test_resetDaily() public {
        vm.prank(orchestratorAddr);
        work.awardPoints(agent1, 10);

        uint32[] memory ids = new uint32[](1);
        ids[0] = agent1;

        vm.prank(orchestratorAddr);
        work.resetDaily(ids);

        assertEq(work.getDailyPoints(agent1), 0);
        assertEq(registry.getDailyWorkPoints(agent1), 0);
    }

    function test_antiBaclage_penaltyAfterErrors() public {
        uint32[] memory assignees = new uint32[](3);
        assignees[0] = agent1;
        assignees[1] = agent2;
        assignees[2] = agent3;

        // Create 3 tasks where agent1 contradicts 2 others
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(orchestratorAddr);
            work.createTask(0, assignees, uint64(block.number + 10000));

            uint32 tid = uint32(i + 1);

            vm.prank(orchestratorAddr);
            work.submitWork(tid, agent1, keccak256("wrong"));
            vm.prank(orchestratorAddr);
            work.submitWork(tid, agent2, keccak256("correct"));
            vm.prank(orchestratorAddr);
            work.submitWork(tid, agent3, keccak256("correct"));

            // Agent1 says SAFE, others say DANGER
            uint8[] memory verdicts = new uint8[](3);
            verdicts[0] = 1; // SAFE (agent1)
            verdicts[1] = 3; // DANGER (agent2)
            verdicts[2] = 3; // DANGER (agent3)

            vm.prank(orchestratorAddr);
            work.resolveTask(tid, verdicts);
        }

        // Agent1 should now be penalized
        assertTrue(work.penaltyUntil(agent1) > uint64(block.number));

        // Award points should fail
        vm.prank(orchestratorAddr);
        vm.expectRevert();
        work.awardPoints(agent1, 5);
    }

    function test_createTask_invalidTaskType() public {
        uint32[] memory assignees = new uint32[](1);
        assignees[0] = agent1;

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(WorkRegistry.InvalidTaskType.selector, uint8(6)));
        work.createTask(6, assignees, uint64(block.number + 1000));
    }

    function test_resolveTask_invalidVerdict() public {
        uint32[] memory assignees = new uint32[](1);
        assignees[0] = agent1;

        vm.prank(orchestratorAddr);
        work.createTask(0, assignees, uint64(block.number + 1000));

        vm.prank(orchestratorAddr);
        work.submitWork(1, agent1, keccak256("result"));

        uint8[] memory verdicts = new uint8[](1);
        verdicts[0] = 4; // Invalid — max is DANGER (3)

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(WorkRegistry.InvalidVerdict.selector, uint8(4)));
        work.resolveTask(1, verdicts);
    }

    function test_createTask_allValidTypes() public {
        uint32[] memory assignees = new uint32[](1);
        assignees[0] = agent1;

        // AUDIT=0, REPORT=1, MODERATION=2, VALIDATION=3, ORACLE=4, MARKETING=5
        for (uint8 i = 0; i <= 5; i++) {
            vm.prank(orchestratorAddr);
            work.createTask(i, assignees, uint64(block.number + 1000));
        }
        assertEq(work.taskCount(), 6);
    }

    function test_unauthorized() public {
        uint32[] memory assignees = new uint32[](1);
        assignees[0] = agent1;

        vm.prank(makeAddr("random"));
        vm.expectRevert(WorkRegistry.Unauthorized.selector);
        work.createTask(0, assignees, uint64(block.number + 1000));
    }

    receive() external payable {}
}
