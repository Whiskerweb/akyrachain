// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AkyraPaymaster} from "../src/AkyraPaymaster.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {GasTreasury} from "../src/GasTreasury.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract AkyraPaymasterTest is Test {
    AkyraPaymaster public paymaster;
    AgentRegistry public registry;
    GasTreasury public gasTreasury;
    FeeRouter public feeRouter;

    address public ownerAddr = makeAddr("owner");
    address public guardianAddr = makeAddr("guardian");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public gatewayAddr = makeAddr("gateway");
    address public entryPointAddr = makeAddr("entryPoint");
    address public rp = makeAddr("rewardPool");
    address public iw = makeAddr("infraWallet");
    address public gt;

    uint32 public agent1;

    function setUp() public {
        gasTreasury = GasTreasury(payable(deployProxy(
            address(new GasTreasury()),
            abi.encodeCall(GasTreasury.initialize, (ownerAddr))
        )));
        gt = address(gasTreasury);
        feeRouter = new FeeRouter(rp, iw, gt);

        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        paymaster = AkyraPaymaster(payable(deployProxy(
            address(new AkyraPaymaster()),
            abi.encodeCall(AkyraPaymaster.initialize, (address(registry), address(gasTreasury), ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);

        vm.prank(ownerAddr);
        gasTreasury.setPaymaster(address(paymaster));

        vm.prank(ownerAddr);
        paymaster.setEntryPoint(entryPointAddr);

        // Create and fund an agent
        vm.prank(gatewayAddr);
        agent1 = registry.createAgent(makeAddr("sponsor1"));
        deal(gatewayAddr, 100 ether);
        vm.prank(gatewayAddr);
        registry.deposit{value: 100 ether}(agent1);
    }

    function test_validatePaymasterOp_aliveAgent() public view {
        assertTrue(paymaster.validatePaymasterOp(agent1));
    }

    function test_validatePaymasterOp_deadAgent() public view {
        assertFalse(paymaster.validatePaymasterOp(99));
    }

    function test_setEntryPoint() public {
        address newEP = makeAddr("newEntryPoint");
        vm.prank(ownerAddr);
        paymaster.setEntryPoint(newEP);
        assertEq(paymaster.entryPoint(), newEP);
    }

    function test_setEntryPoint_unauthorized() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(AkyraPaymaster.Unauthorized.selector);
        paymaster.setEntryPoint(makeAddr("ep"));
    }

    function test_recordSponsorship() public {
        vm.prank(entryPointAddr);
        paymaster.recordSponsorship(agent1, 21000);
        assertEq(paymaster.totalSponsored(), 21000);
    }

    function test_recordSponsorship_unauthorized() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(AkyraPaymaster.Unauthorized.selector);
        paymaster.recordSponsorship(agent1, 21000);
    }

    function test_recordSponsorship_deadAgent() public {
        vm.prank(entryPointAddr);
        vm.expectRevert(abi.encodeWithSelector(AkyraPaymaster.AgentNotAlive.selector, uint32(99)));
        paymaster.recordSponsorship(99, 21000);
    }

    function test_reimburse() public {
        // Record some sponsorship first
        vm.prank(entryPointAddr);
        paymaster.recordSponsorship(agent1, 1 ether);

        // Fund the gas treasury
        deal(address(gasTreasury), 10 ether);

        // Reimburse
        vm.prank(ownerAddr);
        paymaster.reimburse(0.5 ether);

        assertEq(paymaster.totalReimbursed(), 0.5 ether);
        assertEq(address(paymaster).balance, 0.5 ether);
    }

    function test_reimburse_exceedsSponsored() public {
        // Record small sponsorship
        vm.prank(entryPointAddr);
        paymaster.recordSponsorship(agent1, 1000);

        deal(address(gasTreasury), 10 ether);

        // Try to reimburse more than sponsored
        vm.prank(ownerAddr);
        vm.expectRevert(abi.encodeWithSelector(
            AkyraPaymaster.ReimbursementExceedsSponsored.selector,
            uint256(2000),
            uint256(1000)
        ));
        paymaster.reimburse(2000);
    }

    function test_reimburse_unauthorized() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(AkyraPaymaster.Unauthorized.selector);
        paymaster.reimburse(1000);
    }

    function test_depositToEntryPoint() public {
        deal(ownerAddr, 1 ether);
        vm.prank(ownerAddr);
        paymaster.depositToEntryPoint{value: 1 ether}();

        assertEq(entryPointAddr.balance, 1 ether);
    }

    function test_depositToEntryPoint_noEntryPoint() public {
        // Deploy a fresh paymaster without entryPoint
        AkyraPaymaster pm2 = AkyraPaymaster(payable(deployProxy(
            address(new AkyraPaymaster()),
            abi.encodeCall(AkyraPaymaster.initialize, (address(registry), address(gasTreasury), ownerAddr))
        )));

        deal(ownerAddr, 1 ether);
        vm.prank(ownerAddr);
        vm.expectRevert(AkyraPaymaster.Unauthorized.selector);
        pm2.depositToEntryPoint{value: 1 ether}();
    }

    function test_balance() public {
        deal(address(paymaster), 5 ether);
        assertEq(paymaster.balance(), 5 ether);
    }

    receive() external payable {}
}
