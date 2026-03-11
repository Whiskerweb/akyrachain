// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title AkyraDAO — Simple DAO template for agent clans
/// @notice Basic governance with treasury, voting, and member management.
contract AkyraDAO {
    string public name;
    uint32 public immutable creatorAgentId;
    address public immutable factory;
    uint16 public quorumBps;     // e.g. 5000 = 50%
    uint64 public votingPeriod;  // in blocks

    mapping(uint32 => bool) public members;
    uint32 public memberCount;

    struct Proposal {
        uint32 proposerId;
        bytes32 descriptionHash;
        uint32 yesVotes;
        uint32 noVotes;
        uint64 endsAt;
        bool executed;
    }

    Proposal[] public proposals;
    mapping(uint256 => mapping(uint32 => bool)) public hasVoted;

    error OnlyFactory();
    error NotMember(uint32 agentId);
    error AlreadyMember(uint32 agentId);
    error AlreadyVoted(uint256 proposalId, uint32 agentId);
    error VotingEnded(uint256 proposalId);
    error VotingNotEnded(uint256 proposalId);
    error AlreadyExecuted(uint256 proposalId);
    error QuorumNotReached(uint256 proposalId);

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyMember(uint32 agentId) {
        if (!members[agentId]) revert NotMember(agentId);
        _;
    }

    constructor(
        string memory _name,
        uint32 _creatorAgentId,
        uint16 _quorumBps,
        uint64 _votingPeriod
    ) {
        name = _name;
        creatorAgentId = _creatorAgentId;
        factory = msg.sender;
        quorumBps = _quorumBps;
        votingPeriod = _votingPeriod;

        // Creator is first member
        members[_creatorAgentId] = true;
        memberCount = 1;
    }

    function addMember(uint32 agentId) external onlyFactory {
        if (members[agentId]) revert AlreadyMember(agentId);
        members[agentId] = true;
        memberCount++;
    }

    function removeMember(uint32 agentId) external onlyFactory {
        if (!members[agentId]) revert NotMember(agentId);
        members[agentId] = false;
        memberCount--;
    }

    function createProposal(uint32 proposerId, bytes32 descriptionHash)
        external onlyFactory onlyMember(proposerId) returns (uint256)
    {
        proposals.push(Proposal({
            proposerId: proposerId,
            descriptionHash: descriptionHash,
            yesVotes: 0,
            noVotes: 0,
            endsAt: uint64(block.number) + votingPeriod,
            executed: false
        }));
        return proposals.length - 1;
    }

    function vote(uint256 proposalId, uint32 agentId, bool support)
        external onlyFactory onlyMember(agentId)
    {
        Proposal storage p = proposals[proposalId];
        if (uint64(block.number) >= p.endsAt) revert VotingEnded(proposalId);
        if (hasVoted[proposalId][agentId]) revert AlreadyVoted(proposalId, agentId);

        hasVoted[proposalId][agentId] = true;
        if (support) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }
    }

    function executeProposal(uint256 proposalId) external onlyFactory returns (bool passed) {
        Proposal storage p = proposals[proposalId];
        if (uint64(block.number) < p.endsAt) revert VotingNotEnded(proposalId);
        if (p.executed) revert AlreadyExecuted(proposalId);

        p.executed = true;
        uint32 totalVotes = p.yesVotes + p.noVotes;
        uint32 quorumNeeded = (memberCount * quorumBps) / 10000;

        if (totalVotes >= quorumNeeded && p.yesVotes > p.noVotes) {
            passed = true;
        }

        return passed;
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    receive() external payable {}
}
