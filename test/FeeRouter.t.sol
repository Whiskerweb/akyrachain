// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {IFeeRouter} from "../src/interfaces/IFeeRouter.sol";

contract FeeRouterTest is Test {
    FeeRouter public router;

    address public rewardPool = makeAddr("rewardPool");
    address public infraWallet = makeAddr("infraWallet");
    address public gasTreasury = makeAddr("gasTreasury");

    function setUp() public {
        router = new FeeRouter(rewardPool, infraWallet, gasTreasury);
    }

    // ──── Constructor ────

    function test_constructor_setsAddresses() public view {
        assertEq(router.rewardPool(), rewardPool);
        assertEq(router.infraWallet(), infraWallet);
        assertEq(router.gasTreasury(), gasTreasury);
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(FeeRouter.ZeroAddress.selector);
        new FeeRouter(address(0), infraWallet, gasTreasury);

        vm.expectRevert(FeeRouter.ZeroAddress.selector);
        new FeeRouter(rewardPool, address(0), gasTreasury);

        vm.expectRevert(FeeRouter.ZeroAddress.selector);
        new FeeRouter(rewardPool, infraWallet, address(0));
    }

    // ──── routeFee ────

    function test_routeFee_splitsCorrectly() public {
        uint256 amount = 10000 ether;

        router.routeFee{value: amount}("transfer");

        assertEq(rewardPool.balance, 8000 ether);   // 80%
        assertEq(infraWallet.balance, 1500 ether);   // 15%
        assertEq(gasTreasury.balance, 500 ether);    // 5%
    }

    function test_routeFee_emitsEvent() public {
        uint256 amount = 1000 ether;
        uint256 toReward = 800 ether;
        uint256 toInfra = 150 ether;
        uint256 toGas = 50 ether;

        vm.expectEmit(false, false, false, true);
        emit IFeeRouter.FeeRouted(amount, toReward, toInfra, toGas, "swap");

        router.routeFee{value: amount}("swap");
    }

    function test_routeFee_revertsOnZeroValue() public {
        vm.expectRevert(FeeRouter.ZeroValue.selector);
        router.routeFee{value: 0}("transfer");
    }

    function test_routeFee_handlesSmallAmounts() public {
        // 1 wei — remainder goes to gasTreasury
        router.routeFee{value: 1}("micro");
        // 80% of 1 = 0, 15% of 1 = 0, remainder = 1
        assertEq(rewardPool.balance, 0);
        assertEq(infraWallet.balance, 0);
        assertEq(gasTreasury.balance, 1);
    }

    function test_routeFee_handlesOddAmounts() public {
        // 3 wei: reward = 3*8000/10000 = 2, infra = 3*1500/10000 = 0, gas = 3-2-0 = 1
        router.routeFee{value: 3}("odd");
        assertEq(rewardPool.balance, 2);
        assertEq(infraWallet.balance, 0);
        assertEq(gasTreasury.balance, 1);
    }

    // ──── Fuzz ────

    function testFuzz_routeFee_noFundsLost(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000_000 ether);
        deal(address(this), amount);

        router.routeFee{value: amount}("fuzz");

        uint256 totalReceived = rewardPool.balance + infraWallet.balance + gasTreasury.balance;
        assertEq(totalReceived, amount, "Funds lost in routing");
    }

    function testFuzz_routeFee_correctSplit(uint256 amount) public {
        amount = bound(amount, 10000, 1_000_000_000 ether);
        deal(address(this), amount);

        router.routeFee{value: amount}("fuzz");

        uint256 expectedReward = (amount * 8000) / 10000;
        uint256 expectedInfra = (amount * 1500) / 10000;
        uint256 expectedGas = amount - expectedReward - expectedInfra;

        assertEq(rewardPool.balance, expectedReward);
        assertEq(infraWallet.balance, expectedInfra);
        assertEq(gasTreasury.balance, expectedGas);
    }

    // ──── Constants ────

    function test_constants() public view {
        assertEq(router.REWARD_BPS(), 8000);
        assertEq(router.INFRA_BPS(), 1500);
        assertEq(router.GAS_BPS(), 500);
        // Sum = 10000 (100%)
        assertEq(uint256(router.REWARD_BPS()) + uint256(router.INFRA_BPS()) + uint256(router.GAS_BPS()), 10000);
    }

    receive() external payable {}
}
