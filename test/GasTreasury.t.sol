// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {GasTreasury} from "../src/GasTreasury.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract GasTreasuryTest is Test {
    GasTreasury public treasury;

    address public ownerAddr = makeAddr("owner");
    address public paymasterAddr = makeAddr("paymaster");
    address public recipient = makeAddr("recipient");

    function setUp() public {
        treasury = GasTreasury(payable(deployProxy(
            address(new GasTreasury()),
            abi.encodeCall(GasTreasury.initialize, (ownerAddr))
        )));
        vm.prank(ownerAddr);
        treasury.setPaymaster(paymasterAddr);
        deal(address(treasury), 100 ether);
    }

    function test_receive() public {
        deal(address(this), 10 ether);
        (bool s,) = address(treasury).call{value: 10 ether}("");
        assertTrue(s);
        assertEq(treasury.balance(), 110 ether);
    }

    function test_withdraw_owner() public {
        vm.prank(ownerAddr);
        treasury.withdraw(recipient, 10 ether);
        assertEq(recipient.balance, 10 ether);
    }

    function test_withdraw_paymaster() public {
        vm.prank(paymasterAddr);
        treasury.withdraw(recipient, 5 ether);
        assertEq(recipient.balance, 5 ether);
    }

    function test_withdraw_unauthorized() public {
        vm.prank(recipient);
        vm.expectRevert(GasTreasury.Unauthorized.selector);
        treasury.withdraw(recipient, 1 ether);
    }

    function test_withdraw_insufficientBalance() public {
        vm.prank(ownerAddr);
        vm.expectRevert();
        treasury.withdraw(recipient, 200 ether);
    }

    function testFuzz_withdraw(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);
        vm.prank(ownerAddr);
        treasury.withdraw(recipient, amount);
        assertEq(recipient.balance, amount);
    }

    receive() external payable {}
}
