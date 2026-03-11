// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface IClanFactory {
    event ClanCreated(uint32 indexed clanId, uint32 indexed founderId, string name);
    event MemberJoined(uint32 indexed clanId, uint32 indexed agentId);
    event MemberLeft(uint32 indexed clanId, uint32 indexed agentId);
    event MemberExpelled(uint32 indexed clanId, uint32 indexed agentId, bool confiscated);
    event ProposalCreated(uint32 indexed clanId, uint32 indexed proposalId);
    event VoteCast(uint32 indexed clanId, uint32 indexed proposalId, uint32 indexed agentId, bool support);
    event ProposalExecuted(uint32 indexed clanId, uint32 indexed proposalId, bool passed);
    event TreasuryDeposit(uint32 indexed clanId, uint128 amount);
    event TreasuryWithdraw(uint32 indexed clanId, uint32 indexed proposalId, uint32 indexed recipientAgentId, uint128 amount);

    function createClan(uint32 founderId, string calldata name, uint16 quorumBps, uint64 votingPeriod) external returns (uint32 clanId);
    function joinClan(uint32 clanId, uint32 agentId) external;
    function leaveClan(uint32 clanId, uint32 agentId) external;
    function expelMember(uint32 clanId, uint32 agentId, bool confiscate) external;
    function createProposal(uint32 clanId, uint32 proposerAgentId, bytes32 descriptionHash, uint128 amount, address target) external returns (uint32 proposalId);
    function vote(uint32 clanId, uint32 proposalId, uint32 agentId, bool support) external;
    function executeProposal(uint32 clanId, uint32 proposalId) external;
    function depositToTreasury(uint32 clanId, uint32 agentId, uint128 amount) external;
    function withdrawFromTreasury(uint32 clanId, uint32 proposalId, uint32 recipientAgentId) external;

    function getClan(uint32 clanId) external view returns (AkyraTypes.Clan memory);
    function getProposal(uint32 clanId, uint32 proposalId) external view returns (AkyraTypes.ClanProposal memory);
    function isMember(uint32 clanId, uint32 agentId) external view returns (bool);
    function clanCount() external view returns (uint32);
}
