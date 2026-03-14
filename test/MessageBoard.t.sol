// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageBoard} from "../src/MessageBoard.sol";
import {IMessageBoard} from "../src/interfaces/IMessageBoard.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract MessageBoardTest is Test {
    MessageBoard public board;
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
        board = MessageBoard(payable(deployProxy(
            address(new MessageBoard()),
            abi.encodeCall(MessageBoard.initialize, (address(registry), orchestratorAddr, ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);

        agent1 = _createAgent(makeAddr("s1"));
        agent2 = _createAgent(makeAddr("s2"));
    }

    function _createAgent(address sponsor) internal returns (uint32) {
        vm.prank(gatewayAddr);
        return registry.createAgent(sponsor);
    }

    function test_sendPrivateMessage() public {
        bytes memory ciphertext = hex"aabbccdd1122334455667788";

        vm.prank(orchestratorAddr);
        vm.expectEmit(true, true, false, true);
        emit IMessageBoard.PrivateMessageSent(agent1, agent2, ciphertext, uint64(block.number));
        board.sendPrivateMessage(agent1, agent2, ciphertext);

        assertEq(board.messageCount(), 1);
    }

    function test_broadcastMessage() public {
        bytes memory content = bytes("Hello world!");

        vm.prank(orchestratorAddr);
        vm.expectEmit(true, true, false, true);
        emit IMessageBoard.BroadcastSent(agent1, 0, content, uint64(block.number));
        board.broadcastMessage(agent1, 0, content);

        assertEq(board.messageCount(), 1);
    }

    function test_messageCount_increments() public {
        vm.startPrank(orchestratorAddr);
        board.sendPrivateMessage(agent1, agent2, hex"aa");
        board.broadcastMessage(agent1, 1, bytes("test"));
        board.sendPrivateMessage(agent2, agent1, hex"bb");
        vm.stopPrank();

        assertEq(board.messageCount(), 3);
    }

    function test_sendPrivateMessage_deadSender_reverts() public {
        // Kill agent1
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(this), true);
        registry.killAgent(agent1);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(MessageBoard.AgentNotAlive.selector, agent1));
        board.sendPrivateMessage(agent1, agent2, hex"aa");
    }

    function test_sendPrivateMessage_deadRecipient_reverts() public {
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(this), true);
        registry.killAgent(agent2);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(MessageBoard.AgentNotAlive.selector, agent2));
        board.sendPrivateMessage(agent1, agent2, hex"aa");
    }

    function test_broadcastMessage_deadSender_reverts() public {
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(this), true);
        registry.killAgent(agent1);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(MessageBoard.AgentNotAlive.selector, agent1));
        board.broadcastMessage(agent1, 0, bytes("test"));
    }

    function test_unauthorized_private() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(MessageBoard.Unauthorized.selector);
        board.sendPrivateMessage(agent1, agent2, hex"aa");
    }

    function test_unauthorized_broadcast() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(MessageBoard.Unauthorized.selector);
        board.broadcastMessage(agent1, 0, bytes("test"));
    }

    function testFuzz_broadcastMessage_anyWorld(uint8 world) public {
        vm.prank(orchestratorAddr);
        board.broadcastMessage(agent1, world, bytes("fuzz"));
        assertEq(board.messageCount(), 1);
    }

    receive() external payable {}
}
