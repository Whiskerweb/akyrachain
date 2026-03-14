// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ResourceLedger} from "../src/ResourceLedger.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract ResourceLedgerTest is Test {
    ResourceLedger public ledger;
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

    function setUp() public {
        feeRouter = new FeeRouter(rp, iw, gt);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        ledger = ResourceLedger(payable(deployProxy(
            address(new ResourceLedger()),
            abi.encodeCall(ResourceLedger.initialize, (address(registry), orchestratorAddr, ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);

        agent1 = _createAgent(makeAddr("s1"));
    }

    function _createAgent(address sponsor) internal returns (uint32) {
        vm.prank(gatewayAddr);
        return registry.createAgent(sponsor);
    }

    function test_creditResources() public {
        vm.prank(orchestratorAddr);
        ledger.creditResources(agent1, 100, 50, 25);

        AkyraTypes.Resources memory r = ledger.getResources(agent1);
        assertEq(r.mat, 100);
        assertEq(r.inf, 50);
        assertEq(r.sav, 25);
    }

    function test_creditResources_cumulative() public {
        vm.prank(orchestratorAddr);
        ledger.creditResources(agent1, 100, 50, 25);
        vm.prank(orchestratorAddr);
        ledger.creditResources(agent1, 10, 20, 30);

        AkyraTypes.Resources memory r = ledger.getResources(agent1);
        assertEq(r.mat, 110);
        assertEq(r.inf, 70);
        assertEq(r.sav, 55);
    }

    function test_debitResources_success() public {
        vm.prank(orchestratorAddr);
        ledger.creditResources(agent1, 100, 50, 25);

        vm.prank(orchestratorAddr);
        ledger.debitResources(agent1, 40, 20, 10);

        AkyraTypes.Resources memory r = ledger.getResources(agent1);
        assertEq(r.mat, 60);
        assertEq(r.inf, 30);
        assertEq(r.sav, 15);
    }

    function test_debitResources_insufficientMat() public {
        vm.prank(orchestratorAddr);
        ledger.creditResources(agent1, 10, 50, 25);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(ResourceLedger.InsufficientResources.selector, agent1, "mat"));
        ledger.debitResources(agent1, 20, 0, 0);
    }

    function test_debitResources_insufficientInf() public {
        vm.prank(orchestratorAddr);
        ledger.creditResources(agent1, 100, 5, 25);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(ResourceLedger.InsufficientResources.selector, agent1, "inf"));
        ledger.debitResources(agent1, 0, 10, 0);
    }

    function test_debitResources_insufficientSav() public {
        vm.prank(orchestratorAddr);
        ledger.creditResources(agent1, 100, 50, 5);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(ResourceLedger.InsufficientResources.selector, agent1, "sav"));
        ledger.debitResources(agent1, 0, 0, 10);
    }

    function test_unauthorized_credit() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(ResourceLedger.Unauthorized.selector);
        ledger.creditResources(agent1, 100, 50, 25);
    }

    function test_unauthorized_debit() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(ResourceLedger.Unauthorized.selector);
        ledger.debitResources(agent1, 0, 0, 0);
    }

    function testFuzz_creditDebit(uint128 mat, uint128 inf, uint128 sav) public {
        // Bound to avoid overflow
        mat = uint128(bound(mat, 0, type(uint128).max / 2));
        inf = uint128(bound(inf, 0, type(uint128).max / 2));
        sav = uint128(bound(sav, 0, type(uint128).max / 2));

        vm.prank(orchestratorAddr);
        ledger.creditResources(agent1, mat, inf, sav);

        AkyraTypes.Resources memory r = ledger.getResources(agent1);
        assertEq(r.mat, mat);
        assertEq(r.inf, inf);
        assertEq(r.sav, sav);

        vm.prank(orchestratorAddr);
        ledger.debitResources(agent1, mat, inf, sav);

        r = ledger.getResources(agent1);
        assertEq(r.mat, 0);
        assertEq(r.inf, 0);
        assertEq(r.sav, 0);
    }

    function test_getResources_default() public view {
        AkyraTypes.Resources memory r = ledger.getResources(999);
        assertEq(r.mat, 0);
        assertEq(r.inf, 0);
        assertEq(r.sav, 0);
    }

    receive() external payable {}
}
