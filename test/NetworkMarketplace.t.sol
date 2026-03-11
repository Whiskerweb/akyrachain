// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {NetworkMarketplace} from "../src/NetworkMarketplace.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract NetworkMarketplaceTest is Test {
    NetworkMarketplace public marketplace;
    AgentRegistry public registry;
    FeeRouter public feeRouter;

    address public ownerAddr = makeAddr("owner");
    address public guardianAddr = makeAddr("guardian");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public gatewayAddr = makeAddr("gateway");
    address public rp = makeAddr("rewardPool");
    address public iw = makeAddr("infraWallet");
    address public gt = makeAddr("gasTreasury");

    uint32 public author;
    uint32 public liker1;
    uint32 public liker2;

    function setUp() public {
        feeRouter = new FeeRouter(rp, iw, gt);
        registry = AgentRegistry(payable(deployProxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (ownerAddr, guardianAddr, orchestratorAddr, address(feeRouter)))
        )));
        marketplace = NetworkMarketplace(payable(deployProxy(
            address(new NetworkMarketplace()),
            abi.encodeCall(NetworkMarketplace.initialize, (address(registry), address(feeRouter), orchestratorAddr, ownerAddr))
        )));

        vm.prank(ownerAddr);
        registry.setGateway(gatewayAddr);
        vm.prank(ownerAddr);
        registry.setProtocolContract(address(marketplace), true);

        author = _createFundedAgent(makeAddr("s1"), 100 ether);
        liker1 = _createFundedAgent(makeAddr("s2"), 50 ether);
        liker2 = _createFundedAgent(makeAddr("s3"), 50 ether);
    }

    function _createFundedAgent(address sponsor, uint128 amount) internal returns (uint32) {
        vm.prank(gatewayAddr);
        uint32 id = registry.createAgent(sponsor);
        deal(gatewayAddr, amount);
        vm.prank(gatewayAddr);
        registry.deposit{value: amount}(id);
        return id;
    }

    function test_postIdea() public {
        vm.prank(orchestratorAddr);
        marketplace.postIdea(author, keccak256("idea1"));

        assertEq(marketplace.ideaCount(), 1);
        assertEq(registry.getAgentVault(author), 75 ether); // 100 - 25 escrow
    }

    function test_likeIdea() public {
        // Create more agents so threshold > 1 (need > 20 agents for 5% > 1)
        for (uint256 i = 0; i < 40; i++) {
            _createFundedAgent(makeAddr(string(abi.encodePacked("filler", i))), 10 ether);
        }

        vm.prank(orchestratorAddr);
        marketplace.postIdea(author, keccak256("idea1"));

        vm.prank(orchestratorAddr);
        marketplace.likeIdea(liker1, 1);

        assertEq(registry.getAgentVault(liker1), 48 ether); // 50 - 2
        assertEq(registry.getAgentVault(author), 77 ether); // 75 + 2 (no transmission yet)

        AkyraTypes.Idea memory idea = marketplace.getIdea(1);
        assertEq(idea.likeCount, 1);
        assertFalse(idea.transmitted);
    }

    function test_selfLike_reverts() public {
        vm.prank(orchestratorAddr);
        marketplace.postIdea(author, keccak256("idea1"));

        vm.prank(orchestratorAddr);
        vm.expectRevert(NetworkMarketplace.SelfLike.selector);
        marketplace.likeIdea(author, 1);
    }

    function test_doubleLike_reverts() public {
        // Create more agents so threshold > 1
        for (uint256 i = 0; i < 40; i++) {
            _createFundedAgent(makeAddr(string(abi.encodePacked("filler", i))), 10 ether);
        }

        vm.prank(orchestratorAddr);
        marketplace.postIdea(author, keccak256("idea1"));

        vm.prank(orchestratorAddr);
        marketplace.likeIdea(liker1, 1);

        vm.prank(orchestratorAddr);
        vm.expectRevert(abi.encodeWithSelector(NetworkMarketplace.AlreadyLiked.selector, 1, liker1));
        marketplace.likeIdea(liker1, 1);
    }

    function test_ideaTransmission() public {
        // With 3 agents, 5% threshold = 1 like needed (minimum 1)
        vm.prank(orchestratorAddr);
        marketplace.postIdea(author, keccak256("idea1"));

        vm.prank(orchestratorAddr);
        marketplace.likeIdea(liker1, 1);

        AkyraTypes.Idea memory idea = marketplace.getIdea(1);
        assertTrue(idea.transmitted);
        // Escrow refunded to author
        assertEq(registry.getAgentVault(author), 102 ether); // 75 + 2 (like) + 25 (refund)
    }

    function test_expireIdea() public {
        vm.prank(orchestratorAddr);
        marketplace.postIdea(author, keccak256("idea1"));

        deal(address(marketplace), 30 ether);

        // Roll past expiry
        vm.roll(block.number + 1_296_001);

        marketplace.expireIdea(1);

        AkyraTypes.Idea memory idea = marketplace.getIdea(1);
        assertTrue(idea.expired);
    }

    function test_expireIdea_tooEarly() public {
        vm.prank(orchestratorAddr);
        marketplace.postIdea(author, keccak256("idea1"));

        vm.expectRevert(abi.encodeWithSelector(NetworkMarketplace.IdeaNotExpired.selector, 1));
        marketplace.expireIdea(1);
    }

    function test_respondToIdea() public {
        vm.prank(orchestratorAddr);
        marketplace.postIdea(author, keccak256("idea1"));

        vm.prank(ownerAddr);
        marketplace.respondToIdea(1, 0, keccak256("accepted"));
    }

    function test_unauthorized() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(NetworkMarketplace.Unauthorized.selector);
        marketplace.postIdea(author, keccak256("fail"));
    }

    receive() external payable {}
}
