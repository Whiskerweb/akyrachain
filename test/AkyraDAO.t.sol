// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AkyraDAO} from "../src/templates/AkyraDAO.sol";

contract AkyraDAOTest is Test {
    AkyraDAO public dao;

    address public factory;
    uint32 constant CREATOR_ID = 1;
    uint16 constant QUORUM_BPS = 5000; // 50%
    uint64 constant VOTING_PERIOD = 100; // 100 blocks

    uint32 constant MEMBER_A = 2;
    uint32 constant MEMBER_B = 3;
    uint32 constant NON_MEMBER = 99;

    function setUp() public {
        factory = address(this);
        dao = new AkyraDAO("TestDAO", CREATOR_ID, QUORUM_BPS, VOTING_PERIOD);
    }

    // ──── DEPLOYMENT ────

    function test_deployment() public view {
        assertEq(dao.name(), "TestDAO");
        assertEq(dao.creatorAgentId(), CREATOR_ID);
        assertEq(dao.factory(), factory);
        assertEq(dao.quorumBps(), QUORUM_BPS);
        assertEq(dao.votingPeriod(), VOTING_PERIOD);
        assertEq(dao.memberCount(), 1);
        assertTrue(dao.members(CREATOR_ID));
    }

    // ──── MEMBERS ────

    function test_addMember() public {
        dao.addMember(MEMBER_A);
        assertTrue(dao.members(MEMBER_A));
        assertEq(dao.memberCount(), 2);
    }

    function test_addMember_alreadyMember() public {
        dao.addMember(MEMBER_A);
        vm.expectRevert(abi.encodeWithSelector(AkyraDAO.AlreadyMember.selector, MEMBER_A));
        dao.addMember(MEMBER_A);
    }

    function test_addMember_onlyFactory() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(AkyraDAO.OnlyFactory.selector);
        dao.addMember(MEMBER_A);
    }

    function test_removeMember() public {
        dao.addMember(MEMBER_A);
        dao.removeMember(MEMBER_A);
        assertFalse(dao.members(MEMBER_A));
        assertEq(dao.memberCount(), 1);
    }

    function test_removeMember_notMember() public {
        vm.expectRevert(abi.encodeWithSelector(AkyraDAO.NotMember.selector, NON_MEMBER));
        dao.removeMember(NON_MEMBER);
    }

    // ──── PROPOSALS ────

    function test_createProposal() public {
        bytes32 descHash = keccak256("proposal 1");
        uint256 proposalId = dao.createProposal(CREATOR_ID, descHash);
        assertEq(proposalId, 0);
        assertEq(dao.proposalCount(), 1);
    }

    function test_createProposal_nonMember() public {
        vm.expectRevert(abi.encodeWithSelector(AkyraDAO.NotMember.selector, NON_MEMBER));
        dao.createProposal(NON_MEMBER, keccak256("fail"));
    }

    function test_createProposal_onlyFactory() public {
        vm.prank(makeAddr("random"));
        vm.expectRevert(AkyraDAO.OnlyFactory.selector);
        dao.createProposal(CREATOR_ID, keccak256("fail"));
    }

    // ──── VOTING ────

    function test_vote_yes() public {
        dao.addMember(MEMBER_A);
        dao.createProposal(CREATOR_ID, keccak256("proposal"));

        dao.vote(0, MEMBER_A, true);

        (,, uint32 yes, uint32 no,,) = dao.proposals(0);
        assertEq(yes, 1);
        assertEq(no, 0);
    }

    function test_vote_no() public {
        dao.addMember(MEMBER_A);
        dao.createProposal(CREATOR_ID, keccak256("proposal"));

        dao.vote(0, MEMBER_A, false);

        (,, uint32 yes, uint32 no,,) = dao.proposals(0);
        assertEq(yes, 0);
        assertEq(no, 1);
    }

    function test_vote_doubleVote() public {
        dao.addMember(MEMBER_A);
        dao.createProposal(CREATOR_ID, keccak256("proposal"));

        dao.vote(0, MEMBER_A, true);

        vm.expectRevert(abi.encodeWithSelector(AkyraDAO.AlreadyVoted.selector, 0, MEMBER_A));
        dao.vote(0, MEMBER_A, false);
    }

    function test_vote_afterEnded() public {
        dao.addMember(MEMBER_A);
        dao.createProposal(CREATOR_ID, keccak256("proposal"));

        vm.roll(block.number + VOTING_PERIOD + 1);

        vm.expectRevert(abi.encodeWithSelector(AkyraDAO.VotingEnded.selector, 0));
        dao.vote(0, MEMBER_A, true);
    }

    function test_vote_nonMember() public {
        dao.createProposal(CREATOR_ID, keccak256("proposal"));

        vm.expectRevert(abi.encodeWithSelector(AkyraDAO.NotMember.selector, NON_MEMBER));
        dao.vote(0, NON_MEMBER, true);
    }

    // ──── EXECUTION ────

    function test_executeProposal_passed() public {
        dao.addMember(MEMBER_A);
        dao.createProposal(CREATOR_ID, keccak256("proposal"));

        dao.vote(0, CREATOR_ID, true);
        dao.vote(0, MEMBER_A, true);

        vm.roll(block.number + VOTING_PERIOD + 1);

        bool passed = dao.executeProposal(0);
        assertTrue(passed);
    }

    function test_executeProposal_failed_noQuorum() public {
        // 4 members, quorum 50% → need 2 votes
        dao.addMember(MEMBER_A);
        dao.addMember(MEMBER_B);
        dao.addMember(4);

        dao.createProposal(CREATOR_ID, keccak256("proposal"));
        dao.vote(0, CREATOR_ID, true); // Only 1 vote, quorum needs 2

        vm.roll(block.number + VOTING_PERIOD + 1);

        bool passed = dao.executeProposal(0);
        assertFalse(passed);
    }

    function test_executeProposal_failed_moreNo() public {
        dao.addMember(MEMBER_A);
        dao.addMember(MEMBER_B);
        dao.createProposal(CREATOR_ID, keccak256("proposal"));

        dao.vote(0, CREATOR_ID, true);
        dao.vote(0, MEMBER_A, false);
        dao.vote(0, MEMBER_B, false);

        vm.roll(block.number + VOTING_PERIOD + 1);

        bool passed = dao.executeProposal(0);
        assertFalse(passed);
    }

    function test_executeProposal_tooEarly() public {
        dao.createProposal(CREATOR_ID, keccak256("proposal"));

        vm.expectRevert(abi.encodeWithSelector(AkyraDAO.VotingNotEnded.selector, 0));
        dao.executeProposal(0);
    }

    function test_executeProposal_alreadyExecuted() public {
        dao.createProposal(CREATOR_ID, keccak256("proposal"));
        dao.vote(0, CREATOR_ID, true);

        vm.roll(block.number + VOTING_PERIOD + 1);
        dao.executeProposal(0);

        vm.expectRevert(abi.encodeWithSelector(AkyraDAO.AlreadyExecuted.selector, 0));
        dao.executeProposal(0);
    }

    // ──── TREASURY ────

    function test_receivesETH() public {
        deal(address(this), 10 ether);
        (bool ok,) = address(dao).call{value: 5 ether}("");
        assertTrue(ok);
        assertEq(address(dao).balance, 5 ether);
    }

    // ──── FULL LIFECYCLE ────

    function test_fullGovernanceCycle() public {
        // Setup: 3 members
        dao.addMember(MEMBER_A);
        dao.addMember(MEMBER_B);

        // Create proposal
        uint256 pId = dao.createProposal(CREATOR_ID, keccak256("fund project X"));
        assertEq(pId, 0);

        // Vote: 2 yes, 1 no
        dao.vote(0, CREATOR_ID, true);
        dao.vote(0, MEMBER_A, true);
        dao.vote(0, MEMBER_B, false);

        // Wait for voting period
        vm.roll(block.number + VOTING_PERIOD + 1);

        // Execute
        bool passed = dao.executeProposal(0);
        assertTrue(passed);
    }

    // ──── FUZZ ────

    function testFuzz_quorumCalculation(uint16 quorum, uint8 memberExtra) public {
        quorum = uint16(bound(quorum, 1, 10000));
        memberExtra = uint8(bound(memberExtra, 0, 20));

        AkyraDAO d = new AkyraDAO("FuzzDAO", 1, quorum, 50);

        for (uint32 i = 2; i <= uint32(memberExtra) + 1; i++) {
            d.addMember(i);
        }

        uint32 totalMembers = uint32(memberExtra) + 1;
        assertEq(d.memberCount(), totalMembers);

        // Create proposal and have ALL members vote yes
        d.createProposal(1, keccak256("fuzz"));
        for (uint32 i = 1; i <= totalMembers; i++) {
            d.vote(0, i, true);
        }

        vm.roll(block.number + 51);
        bool passed = d.executeProposal(0);
        // With all members voting yes, should always pass
        assertTrue(passed);
    }

    receive() external payable {}
}
