// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IClanFactory} from "./interfaces/IClanFactory.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IFeeRouter} from "./interfaces/IFeeRouter.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title ClanFactory — DAO/clan creation and management for agents
/// @notice Agents can create clans, join, vote, and manage shared treasuries.
contract ClanFactory is IClanFactory, ReentrancyGuard, Initializable, UUPSUpgradeable {
    IAgentRegistry public agentRegistry;
    IFeeRouter public feeRouter;
    address public orchestrator;
    address public owner;

    mapping(uint32 => AkyraTypes.Clan) internal _clans;
    mapping(uint32 => mapping(uint32 => AkyraTypes.ClanProposal)) internal _proposals;
    mapping(uint32 => uint32) public proposalCounts;
    mapping(uint32 => mapping(uint32 => bool)) internal _isMember;
    /// @dev clanId => proposalId => agentId => hasVoted
    mapping(uint32 => mapping(uint32 => mapping(uint32 => bool))) internal _hasVoted;

    uint32 public clanCount;

    error Unauthorized();
    error AgentNotAlive(uint32 agentId);
    error AlreadyMember(uint32 clanId, uint32 agentId);
    error NotMember(uint32 clanId, uint32 agentId);
    error ClanNotFound(uint32 clanId);
    error InsufficientBalance(uint32 agentId);
    error AlreadyVoted(uint32 clanId, uint32 proposalId, uint32 agentId);
    error VotingNotEnded(uint32 clanId, uint32 proposalId);
    error AlreadyExecuted(uint32 clanId, uint32 proposalId);
    error InvalidQuorum(uint16 quorumBps);
    error InvalidVotingPeriod(uint64 votingPeriod);
    error ProposalNotPassed(uint32 clanId, uint32 proposalId);
    error InsufficientTreasury(uint32 clanId, uint128 required, uint128 available);

    modifier onlyOrchestrator() {
        if (msg.sender != orchestrator) revert Unauthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _agentRegistry,
        address _feeRouter,
        address _orchestrator,
        address _owner
    ) external initializer {
        agentRegistry = IAgentRegistry(_agentRegistry);
        feeRouter = IFeeRouter(_feeRouter);
        orchestrator = _orchestrator;
        owner = _owner;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Create a new clan. Fee: 75 AKY.
    function createClan(
        uint32 founderId,
        string calldata name,
        uint16 quorumBps,
        uint64 votingPeriod
    ) external onlyOrchestrator nonReentrant returns (uint32 clanId) {
        if (!agentRegistry.isAlive(founderId)) revert AgentNotAlive(founderId);
        if (quorumBps == 0 || quorumBps > 10000) revert InvalidQuorum(quorumBps);
        if (votingPeriod == 0) revert InvalidVotingPeriod(votingPeriod);

        uint128 fee = AkyraTypes.CREATION_CLAN_FEE;
        uint128 vault = agentRegistry.getAgentVault(founderId);
        if (vault < fee) revert InsufficientBalance(founderId);

        agentRegistry.debitVault(founderId, fee);
        feeRouter.routeFee{value: fee}("clan_create");

        clanCount++;
        clanId = clanCount;

        uint32[] memory members = new uint32[](1);
        members[0] = founderId;

        _clans[clanId] = AkyraTypes.Clan({
            clanId: clanId,
            name: name,
            founderId: founderId,
            members: members,
            treasury: 0,
            quorumBps: quorumBps,
            votingPeriod: votingPeriod,
            createdAt: uint64(block.number)
        });

        _isMember[clanId][founderId] = true;

        emit ClanCreated(clanId, founderId, name);
    }

    function joinClan(uint32 clanId, uint32 agentId) external onlyOrchestrator {
        if (clanId == 0 || clanId > clanCount) revert ClanNotFound(clanId);
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);
        if (_isMember[clanId][agentId]) revert AlreadyMember(clanId, agentId);

        _isMember[clanId][agentId] = true;
        _clans[clanId].members.push(agentId);

        emit MemberJoined(clanId, agentId);
    }

    function leaveClan(uint32 clanId, uint32 agentId) external onlyOrchestrator {
        if (!_isMember[clanId][agentId]) revert NotMember(clanId, agentId);

        _isMember[clanId][agentId] = false;
        _removeMemberFromArray(clanId, agentId);

        emit MemberLeft(clanId, agentId);
    }

    function expelMember(uint32 clanId, uint32 agentId, bool confiscate) external onlyOrchestrator {
        if (!_isMember[clanId][agentId]) revert NotMember(clanId, agentId);

        _isMember[clanId][agentId] = false;
        _removeMemberFromArray(clanId, agentId);

        emit MemberExpelled(clanId, agentId, confiscate);
    }

    function createProposal(
        uint32 clanId,
        uint32 proposerAgentId,
        bytes32 descriptionHash,
        uint128 amount,
        address target
    ) external onlyOrchestrator returns (uint32 proposalId) {
        if (!_isMember[clanId][proposerAgentId]) revert NotMember(clanId, proposerAgentId);

        proposalCounts[clanId]++;
        proposalId = proposalCounts[clanId];

        _proposals[clanId][proposalId] = AkyraTypes.ClanProposal({
            proposalId: proposalId,
            clanId: clanId,
            proposerAgentId: proposerAgentId,
            descriptionHash: descriptionHash,
            amount: amount,
            target: target,
            yesVotes: 0,
            noVotes: 0,
            createdAt: uint64(block.number),
            endsAt: uint64(block.number) + _clans[clanId].votingPeriod,
            executed: false,
            passed: false
        });

        emit ProposalCreated(clanId, proposalId);
    }

    function vote(uint32 clanId, uint32 proposalId, uint32 agentId, bool support)
        external onlyOrchestrator
    {
        if (!_isMember[clanId][agentId]) revert NotMember(clanId, agentId);
        if (_hasVoted[clanId][proposalId][agentId]) revert AlreadyVoted(clanId, proposalId, agentId);

        AkyraTypes.ClanProposal storage p = _proposals[clanId][proposalId];
        if (p.executed) revert AlreadyExecuted(clanId, proposalId);

        _hasVoted[clanId][proposalId][agentId] = true;

        if (support) {
            p.yesVotes++;
        } else {
            p.noVotes++;
        }

        emit VoteCast(clanId, proposalId, agentId, support);
    }

    function executeProposal(uint32 clanId, uint32 proposalId) external onlyOrchestrator {
        AkyraTypes.ClanProposal storage p = _proposals[clanId][proposalId];
        if (p.executed) revert AlreadyExecuted(clanId, proposalId);
        if (uint64(block.number) < p.endsAt) revert VotingNotEnded(clanId, proposalId);

        p.executed = true;

        uint32 memberCount = uint32(_clans[clanId].members.length);
        uint32 quorumNeeded = (memberCount * _clans[clanId].quorumBps) / 10000;
        uint32 totalVotes = p.yesVotes + p.noVotes;

        if (totalVotes >= quorumNeeded && p.yesVotes > p.noVotes) {
            p.passed = true;
        }

        emit ProposalExecuted(clanId, proposalId, p.passed);
    }

    function depositToTreasury(uint32 clanId, uint32 agentId, uint128 amount)
        external onlyOrchestrator nonReentrant
    {
        if (!_isMember[clanId][agentId]) revert NotMember(clanId, agentId);
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);

        agentRegistry.debitVault(agentId, amount);
        _clans[clanId].treasury += amount;

        emit TreasuryDeposit(clanId, amount);
    }

    /// @notice Withdraw from clan treasury to a member's vault. Requires a passed proposal.
    function withdrawFromTreasury(uint32 clanId, uint32 proposalId, uint32 recipientAgentId)
        external onlyOrchestrator nonReentrant
    {
        AkyraTypes.ClanProposal storage p = _proposals[clanId][proposalId];
        if (!p.passed) revert ProposalNotPassed(clanId, proposalId);
        if (!_isMember[clanId][recipientAgentId]) revert NotMember(clanId, recipientAgentId);
        if (!agentRegistry.isAlive(recipientAgentId)) revert AgentNotAlive(recipientAgentId);

        uint128 amount = p.amount;
        uint128 treasury = _clans[clanId].treasury;
        if (amount > treasury) revert InsufficientTreasury(clanId, amount, treasury);

        _clans[clanId].treasury -= amount;

        // Credit the recipient agent's vault
        agentRegistry.creditVault{value: amount}(recipientAgentId, amount);

        emit TreasuryWithdraw(clanId, proposalId, recipientAgentId, amount);
    }

    // ──────────────────── VIEW ────────────────────

    function getClan(uint32 clanId) external view returns (AkyraTypes.Clan memory) {
        return _clans[clanId];
    }

    function getProposal(uint32 clanId, uint32 proposalId)
        external view returns (AkyraTypes.ClanProposal memory)
    {
        return _proposals[clanId][proposalId];
    }

    function isMember(uint32 clanId, uint32 agentId) external view returns (bool) {
        return _isMember[clanId][agentId];
    }

    // ──────────────────── INTERNAL ────────────────────

    function _removeMemberFromArray(uint32 clanId, uint32 agentId) internal {
        uint32[] storage members = _clans[clanId].members;
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == agentId) {
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
    }

    receive() external payable {}

    uint256[50] private __gap;
}
