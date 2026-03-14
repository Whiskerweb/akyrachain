// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForgeFactory} from "../src/ForgeFactory.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {AkyraERC20} from "../src/templates/AkyraERC20.sol";
import {AkyraERC721} from "../src/templates/AkyraERC721.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract ForgeFactoryTest is Test {
    ForgeFactory public forge;
    AgentRegistry public registry;
    FeeRouter public feeRouter;

    address public ownerAddr = makeAddr("owner");
    address public guardianAddr = makeAddr("guardian");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public gatewayAddr = makeAddr("gateway");
    address public sponsor1 = makeAddr("sponsor1");
    address public rp = makeAddr("rewardPool");
    address public iw = makeAddr("infraWallet");
    address public gt = makeAddr("gasTreasury");

    function setUp() public {
        feeRouter = new FeeRouter(rp, iw, gt);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        forge = ForgeFactory(payable(deployProxy(
            address(new ForgeFactory()),
            abi.encodeCall(ForgeFactory.initialize, (address(registry), address(feeRouter), orchestratorAddr, ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(forge), true);
    }

    function _createFundedAgent(address sponsor, uint128 amount) internal returns (uint32) {
        vm.prank(gatewayAddr);
        uint32 id = registry.createAgent(sponsor);
        deal(gatewayAddr, amount);
        vm.prank(gatewayAddr);
        registry.deposit{value: amount}(id);
        return id;
    }

    // ──── CREATE TOKEN ────

    function test_createToken() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);

        // ForgeFactory needs ETH to forward fees to FeeRouter
        // When debitVault is called, it reduces vault in registry but ForgeFactory needs actual ETH
        // The ETH is in the registry. ForgeFactory calls debitVault which reduces vault,
        // but ForgeFactory then needs to send fee to FeeRouter.
        // We need to fund ForgeFactory with ETH equal to the fee
        deal(address(forge), 100 ether);

        vm.prank(orchestratorAddr);
        address token = forge.createToken(id, "AgentCoin", "AGC", 1_000_000 ether);

        assertTrue(token != address(0));
        assertTrue(forge.isForgeCreation(token));
        assertEq(forge.creatorOf(token), id);
        assertEq(forge.allCreationsLength(), 1);

        // Check fee charged: 50 AKY
        assertEq(registry.getAgentVault(id), 50 ether);

        // Check token supply minted to ForgeFactory
        assertEq(AkyraERC20(token).balanceOf(address(forge)), 1_000_000 ether);
    }

    function test_createToken_insufficientBalance() public {
        uint32 id = _createFundedAgent(sponsor1, 10 ether); // Less than 50 AKY

        vm.prank(orchestratorAddr);
        vm.expectRevert();
        forge.createToken(id, "Fail", "FAIL", 1000 ether);
    }

    // ──── CREATE NFT ────

    function test_createNFT() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);
        deal(address(forge), 100 ether);

        vm.prank(orchestratorAddr);
        address nft = forge.createNFT(id, "AgentArt", "ART", 100, "ipfs://Qm/");

        assertTrue(nft != address(0));
        assertTrue(forge.isForgeCreation(nft));
        // Fee: 10 AKY
        assertEq(registry.getAgentVault(id), 90 ether);
    }

    // ──── CREATE DAO ────

    function test_createDAO() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);
        deal(address(forge), 100 ether);

        vm.prank(orchestratorAddr);
        address dao = forge.createDAO(id, "AlphaDAO", 5000, 43200);

        assertTrue(dao != address(0));
        assertTrue(forge.isForgeCreation(dao));
        // Fee: 75 AKY
        assertEq(registry.getAgentVault(id), 25 ether);
    }

    // ──── UNAUTHORIZED ────

    function test_createToken_unauthorized() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);

        vm.prank(sponsor1);
        vm.expectRevert(ForgeFactory.Unauthorized.selector);
        forge.createToken(id, "Fail", "F", 1000 ether);
    }

    // ──── DEAD AGENT ────

    function test_createToken_deadAgent() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);

        // Kill agent by draining vault (debitVault auto-kills when vault=0)
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(this), true);
        registry.debitVault(id, 100 ether);

        assertFalse(registry.isAlive(id));

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(ForgeFactory.AgentNotAlive.selector, id));
        forge.createToken(id, "Dead", "DEAD", 1000 ether);
    }

    function test_createNFT_deadAgent() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);

        vm.prank(ownerAddr);
        registry.setProtocolContract(address(this), true);
        registry.debitVault(id, 100 ether);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(ForgeFactory.AgentNotAlive.selector, id));
        forge.createNFT(id, "Dead", "DEAD", 10, "ipfs://dead/");
    }

    function test_createDAO_deadAgent() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);

        vm.prank(ownerAddr);
        registry.setProtocolContract(address(this), true);
        registry.debitVault(id, 100 ether);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(ForgeFactory.AgentNotAlive.selector, id));
        forge.createDAO(id, "DeadDAO", 5000, 43200);
    }

    // ──── INSUFFICIENT BALANCE ────

    function test_createNFT_insufficientBalance() public {
        uint32 id = _createFundedAgent(sponsor1, 5 ether); // Less than 10 AKY

        vm.prank(orchestratorAddr);
        vm.expectRevert();
        forge.createNFT(id, "Fail", "FAIL", 100, "ipfs://fail/");
    }

    function test_createDAO_insufficientBalance() public {
        uint32 id = _createFundedAgent(sponsor1, 50 ether); // Less than 75 AKY

        vm.prank(orchestratorAddr);
        vm.expectRevert();
        forge.createDAO(id, "FailDAO", 5000, 43200);
    }

    // ──── UNAUTHORIZED ────

    function test_createNFT_unauthorized() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);

        vm.prank(sponsor1);
        vm.expectRevert(ForgeFactory.Unauthorized.selector);
        forge.createNFT(id, "Fail", "F", 100, "ipfs://");
    }

    function test_createDAO_unauthorized() public {
        uint32 id = _createFundedAgent(sponsor1, 100 ether);

        vm.prank(sponsor1);
        vm.expectRevert(ForgeFactory.Unauthorized.selector);
        forge.createDAO(id, "Fail", 5000, 43200);
    }

    // ──── MULTIPLE CREATIONS ────

    function test_multipleCreations_trackedCorrectly() public {
        uint32 id = _createFundedAgent(sponsor1, 500 ether);
        deal(address(forge), 500 ether);

        vm.startPrank(orchestratorAddr);
        address t1 = forge.createToken(id, "Token1", "T1", 1000 ether);
        address t2 = forge.createToken(id, "Token2", "T2", 2000 ether);
        address n1 = forge.createNFT(id, "NFT1", "N1", 50, "ipfs://n1/");
        vm.stopPrank();

        assertEq(forge.allCreationsLength(), 3);
        assertTrue(forge.isForgeCreation(t1));
        assertTrue(forge.isForgeCreation(t2));
        assertTrue(forge.isForgeCreation(n1));
        assertEq(forge.creatorOf(t1), id);
        assertEq(forge.creatorOf(t2), id);
        assertEq(forge.creatorOf(n1), id);

        // Fees: 50 + 50 + 10 = 110 AKY
        assertEq(registry.getAgentVault(id), 390 ether);
    }

    // ──── VIEW FUNCTIONS ────

    function test_isForgeCreation_falseForRandom() public view {
        assertFalse(forge.isForgeCreation(address(0x1234)));
    }

    receive() external payable {}
}
