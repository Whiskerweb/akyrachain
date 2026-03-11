// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SponsorGateway} from "../src/SponsorGateway.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract SponsorGatewayTest is Test {
    SponsorGateway public gateway;
    AgentRegistry public registry;
    FeeRouter public feeRouter;

    address public ownerAddr = makeAddr("owner");
    address public guardianAddr = makeAddr("guardian");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public rewardPoolAddr = makeAddr("rewardPool");
    address public infraWalletAddr = makeAddr("infraWallet");
    address public gasTreasuryAddr = makeAddr("gasTreasury");

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    function setUp() public {
        feeRouter = new FeeRouter(rewardPoolAddr, infraWalletAddr, gasTreasuryAddr);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        gateway = SponsorGateway(payable(deployProxy(
            address(new SponsorGateway()),
            abi.encodeCall(SponsorGateway.initialize, (address(registry), ownerAddr, guardianAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(address(gateway));
    }

    // ──── CREATE ────

    function test_createAgent() public {
        vm.prank(user1);
        uint32 id = gateway.createAgent();

        assertEq(id, 1);
        assertEq(registry.sponsorToAgent(user1), 1);
        assertTrue(registry.isAlive(1));
    }

    function test_createAgent_duplicateReverts() public {
        vm.prank(user1);
        gateway.createAgent();

        vm.prank(user1);
        vm.expectRevert();
        gateway.createAgent();
    }

    // ──── DEPOSIT ────

    function test_deposit() public {
        vm.prank(user1);
        gateway.createAgent();

        deal(user1, 100 ether);
        vm.prank(user1);
        gateway.deposit{value: 100 ether}();

        assertEq(registry.getAgentVault(1), 100 ether);
    }

    function test_deposit_noAgentReverts() public {
        deal(user2, 10 ether);
        vm.prank(user2);
        vm.expectRevert(SponsorGateway.NoAgentForSponsor.selector);
        gateway.deposit{value: 10 ether}();
    }

    function test_deposit_zeroReverts() public {
        vm.prank(user1);
        gateway.createAgent();

        vm.prank(user1);
        vm.expectRevert(SponsorGateway.ZeroAmount.selector);
        gateway.deposit{value: 0}();
    }

    // ──── WITHDRAW FLOW ────

    function test_withdrawFullFlow() public {
        vm.prank(user1);
        gateway.createAgent();

        deal(user1, 100 ether);
        vm.prank(user1);
        gateway.deposit{value: 100 ether}();

        // Commit
        vm.prank(user1);
        gateway.commitWithdraw(50 ether);

        // Wait cooldown
        vm.roll(block.number + AkyraTypes.WITHDRAW_COOLDOWN);

        // Execute
        vm.prank(user1);
        gateway.executeWithdraw();

        assertEq(registry.getAgentVault(1), 50 ether);
        assertEq(user1.balance, 50 ether);
    }

    function test_cancelWithdraw() public {
        vm.prank(user1);
        gateway.createAgent();

        deal(user1, 100 ether);
        vm.prank(user1);
        gateway.deposit{value: 100 ether}();

        vm.prank(user1);
        gateway.commitWithdraw(50 ether);

        vm.prank(user1);
        gateway.cancelWithdraw();

        AkyraTypes.WithdrawCommitment memory w = registry.getWithdrawCommitment(1);
        assertFalse(w.pending);
    }

    // ──── PAUSE ────

    function test_pause() public {
        vm.prank(guardianAddr);
        gateway.pause();

        vm.prank(user1);
        vm.expectRevert();
        gateway.createAgent();
    }

    function test_unpause() public {
        vm.prank(guardianAddr);
        gateway.pause();

        vm.prank(ownerAddr);
        gateway.unpause();

        vm.prank(user1);
        gateway.createAgent();
    }

    // ──── ACCESS CONTROL ────

    function test_onlyOwner_setRewardPool() public {
        vm.prank(user1);
        vm.expectRevert(SponsorGateway.Unauthorized.selector);
        gateway.setRewardPool(address(0x123));

        vm.prank(ownerAddr);
        gateway.setRewardPool(address(0x123));
    }

    // ──── FUZZ ────

    function testFuzz_deposit(uint128 amount) public {
        amount = uint128(bound(amount, 1, 1_000_000_000 ether));
        vm.prank(user1);
        gateway.createAgent();

        deal(user1, amount);
        vm.prank(user1);
        gateway.deposit{value: amount}();

        assertEq(registry.getAgentVault(1), amount);
    }

    receive() external payable {}
}
