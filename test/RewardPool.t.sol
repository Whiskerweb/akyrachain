// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {RewardPool} from "../src/RewardPool.sol";
import {AkyraTypes} from "../src/libraries/AkyraTypes.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract RewardPoolTest is Test {
    RewardPool public pool;

    address public orchestrator = makeAddr("orchestrator");
    address public ownerAddr = makeAddr("owner");
    address public gatewayAddr = makeAddr("gateway");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    function setUp() public {
        pool = RewardPool(payable(deployProxy(
            address(new RewardPool()),
            abi.encodeCall(RewardPool.initialize, (orchestrator, ownerAddr))
        )));
        vm.prank(ownerAddr);
        pool.setSponsorGateway(gatewayAddr);
        // Fund the pool
        deal(address(pool), 1000 ether);
    }

    // ──── Helpers ────

    function _buildMerkleTree(address sponsor, uint256 amount)
        internal pure returns (bytes32 root, bytes32[] memory proof)
    {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(sponsor, amount))));
        root = leaf; // Single-leaf tree
        proof = new bytes32[](0);
    }

    function _buildTwoLeafTree(address s1, uint256 a1, address s2, uint256 a2)
        internal pure returns (bytes32 root, bytes32[] memory proof1, bytes32[] memory proof2)
    {
        bytes32 leaf1 = keccak256(bytes.concat(keccak256(abi.encode(s1, a1))));
        bytes32 leaf2 = keccak256(bytes.concat(keccak256(abi.encode(s2, a2))));

        if (uint256(leaf1) < uint256(leaf2)) {
            root = keccak256(abi.encodePacked(leaf1, leaf2));
        } else {
            root = keccak256(abi.encodePacked(leaf2, leaf1));
        }

        proof1 = new bytes32[](1);
        proof1[0] = leaf2;

        proof2 = new bytes32[](1);
        proof2[0] = leaf1;
    }

    // ──── PUBLISH EPOCH ────

    function test_publishEpoch() public {
        (bytes32 root,) = _buildMerkleTree(user1, 10 ether);

        vm.prank(orchestrator);
        pool.publishEpoch(root, 10 ether);

        assertEq(pool.currentEpochId(), 1);
        AkyraTypes.Epoch memory epoch = pool.getEpoch(1);
        assertEq(epoch.merkleRoot, root);
        assertEq(epoch.totalRewards, 10 ether);
    }

    function test_publishEpoch_unauthorized() public {
        vm.prank(user1);
        vm.expectRevert(RewardPool.Unauthorized.selector);
        pool.publishEpoch(bytes32("root"), 10 ether);
    }

    function test_publishEpoch_zeroRoot() public {
        vm.prank(orchestrator);
        vm.expectRevert(RewardPool.ZeroRoot.selector);
        pool.publishEpoch(bytes32(0), 10 ether);
    }

    // ──── CLAIM ────

    function test_claim() public {
        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(user1, 10 ether);

        vm.prank(orchestrator);
        pool.publishEpoch(root, 10 ether);

        vm.prank(user1);
        pool.claim(1, 10 ether, proof);

        assertEq(user1.balance, 10 ether);
        assertTrue(pool.hasClaimed(1, user1));
    }

    function test_claim_doubleClaim() public {
        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(user1, 10 ether);

        vm.prank(orchestrator);
        pool.publishEpoch(root, 10 ether);

        vm.prank(user1);
        pool.claim(1, 10 ether, proof);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(RewardPool.AlreadyClaimed.selector, 1, user1));
        pool.claim(1, 10 ether, proof);
    }

    function test_claim_invalidProof() public {
        (bytes32 root,) = _buildMerkleTree(user1, 10 ether);

        vm.prank(orchestrator);
        pool.publishEpoch(root, 10 ether);

        bytes32[] memory badProof = new bytes32[](1);
        badProof[0] = bytes32("bad");

        vm.prank(user1);
        vm.expectRevert(RewardPool.InvalidProof.selector);
        pool.claim(1, 10 ether, badProof);
    }

    function test_claim_wrongAmount() public {
        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(user1, 10 ether);

        vm.prank(orchestrator);
        pool.publishEpoch(root, 10 ether);

        vm.prank(user1);
        vm.expectRevert(RewardPool.InvalidProof.selector);
        pool.claim(1, 20 ether, proof); // wrong amount
    }

    function test_claim_invalidEpoch() public {
        bytes32[] memory proof = new bytes32[](0);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(RewardPool.EpochNotFound.selector, 999));
        pool.claim(999, 10 ether, proof);
    }

    // ──── CLAIM ON BEHALF ────

    function test_claimOnBehalf() public {
        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(user1, 5 ether);

        vm.prank(orchestrator);
        pool.publishEpoch(root, 5 ether);

        vm.prank(gatewayAddr);
        pool.claimOnBehalf(user1, 1, 5 ether, proof);

        assertEq(user1.balance, 5 ether);
    }

    function test_claimOnBehalf_unauthorized() public {
        (bytes32 root, bytes32[] memory proof) = _buildMerkleTree(user1, 5 ether);

        vm.prank(orchestrator);
        pool.publishEpoch(root, 5 ether);

        vm.prank(user2);
        vm.expectRevert(RewardPool.Unauthorized.selector);
        pool.claimOnBehalf(user1, 1, 5 ether, proof);
    }

    // ──── MULTI-LEAF ────

    function test_claim_twoUsers() public {
        (bytes32 root, bytes32[] memory proof1, bytes32[] memory proof2) =
            _buildTwoLeafTree(user1, 10 ether, user2, 5 ether);

        vm.prank(orchestrator);
        pool.publishEpoch(root, 15 ether);

        vm.prank(user1);
        pool.claim(1, 10 ether, proof1);

        vm.prank(user2);
        pool.claim(1, 5 ether, proof2);

        assertEq(user1.balance, 10 ether);
        assertEq(user2.balance, 5 ether);
    }

    // ──── MULTIPLE EPOCHS ────

    function test_claimMultiple() public {
        (bytes32 root1, bytes32[] memory proof1) = _buildMerkleTree(user1, 10 ether);
        (bytes32 root2, bytes32[] memory proof2) = _buildMerkleTree(user1, 5 ether);

        vm.prank(orchestrator);
        pool.publishEpoch(root1, 10 ether);
        vm.prank(orchestrator);
        pool.publishEpoch(root2, 5 ether);

        uint256[] memory epochIds = new uint256[](2);
        epochIds[0] = 1;
        epochIds[1] = 2;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10 ether;
        amounts[1] = 5 ether;

        bytes32[][] memory proofs = new bytes32[][](2);
        proofs[0] = proof1;
        proofs[1] = proof2;

        vm.prank(user1);
        pool.claimMultiple(epochIds, amounts, proofs);

        assertEq(user1.balance, 15 ether);
    }

    receive() external payable {}
}
