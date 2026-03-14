// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AkyraERC20} from "../src/templates/AkyraERC20.sol";

contract AkyraERC20Test is Test {
    AkyraERC20 public token;

    address public factory = makeAddr("factory");
    address public mintTo = makeAddr("mintTo");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    uint32 constant CREATOR_ID = 42;
    uint256 constant TOTAL_SUPPLY = 1_000_000 ether;

    function setUp() public {
        vm.prank(factory);
        token = new AkyraERC20("AgentCoin", "AGC", TOTAL_SUPPLY, CREATOR_ID, mintTo);
    }

    // ──── DEPLOYMENT ────

    function test_deployment_name() public view {
        assertEq(token.name(), "AgentCoin");
    }

    function test_deployment_symbol() public view {
        assertEq(token.symbol(), "AGC");
    }

    function test_deployment_totalSupply() public view {
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }

    function test_deployment_mintedToRecipient() public view {
        assertEq(token.balanceOf(mintTo), TOTAL_SUPPLY);
    }

    function test_deployment_immutables() public view {
        assertEq(token.creatorAgentId(), CREATOR_ID);
        assertEq(token.factory(), factory);
    }

    function test_deployment_decimals() public view {
        assertEq(token.decimals(), 18);
    }

    // ──── TRANSFERS ────

    function test_transfer() public {
        vm.prank(mintTo);
        token.transfer(user1, 1000 ether);

        assertEq(token.balanceOf(user1), 1000 ether);
        assertEq(token.balanceOf(mintTo), TOTAL_SUPPLY - 1000 ether);
    }

    function test_transfer_emitsEvent() public {
        vm.prank(mintTo);
        vm.expectEmit(true, true, false, true);
        emit Transfer(mintTo, user1, 500 ether);
        token.transfer(user1, 500 ether);
    }

    function test_transfer_insufficientBalance() public {
        vm.prank(user1);
        vm.expectRevert();
        token.transfer(user2, 1);
    }

    // ──── APPROVAL & TRANSFERFROM ────

    function test_approve_and_transferFrom() public {
        vm.prank(mintTo);
        token.approve(user1, 200 ether);
        assertEq(token.allowance(mintTo, user1), 200 ether);

        vm.prank(user1);
        token.transferFrom(mintTo, user2, 100 ether);

        assertEq(token.balanceOf(user2), 100 ether);
        assertEq(token.allowance(mintTo, user1), 100 ether);
    }

    function test_transferFrom_exceedsAllowance() public {
        vm.prank(mintTo);
        token.approve(user1, 50 ether);

        vm.prank(user1);
        vm.expectRevert();
        token.transferFrom(mintTo, user2, 100 ether);
    }

    // ──── FUZZ ────

    function testFuzz_transfer(uint256 amount) public {
        amount = bound(amount, 0, TOTAL_SUPPLY);

        vm.prank(mintTo);
        token.transfer(user1, amount);

        assertEq(token.balanceOf(user1), amount);
        assertEq(token.balanceOf(mintTo), TOTAL_SUPPLY - amount);
        assertEq(token.totalSupply(), TOTAL_SUPPLY);
    }

    function testFuzz_deployment_anySupply(uint256 supply) public {
        supply = bound(supply, 0, type(uint128).max);

        vm.prank(factory);
        AkyraERC20 t = new AkyraERC20("Fuzz", "FZ", supply, 1, user1);

        assertEq(t.totalSupply(), supply);
        assertEq(t.balanceOf(user1), supply);
    }

    // Re-declare the event for expectEmit
    event Transfer(address indexed from, address indexed to, uint256 value);
}
