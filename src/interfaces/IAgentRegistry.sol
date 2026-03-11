// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface IAgentRegistry {
    // ──── Events ────
    event AgentCreated(uint32 indexed agentId, address indexed sponsor);
    event AgentDeposit(uint32 indexed agentId, uint128 amount);
    event WithdrawCommitted(uint32 indexed agentId, uint128 amount, uint64 commitBlock);
    event WithdrawExecuted(uint32 indexed agentId, uint128 amount, address indexed sponsor);
    event WithdrawCancelled(uint32 indexed agentId);
    event AgentTicked(uint32 indexed agentId, uint64 blockNumber);
    event TransferBetweenAgents(uint32 indexed fromId, uint32 indexed toId, uint128 amount, uint128 fee);
    event AgentMoved(uint32 indexed agentId, uint8 fromWorld, uint8 toWorld);
    event AgentKilled(uint32 indexed agentId, uint64 blockNumber);
    event MemoryRootUpdated(uint32 indexed agentId, bytes32 newRoot);
    event ReputationUpdated(uint32 indexed agentId, int64 newReputation);
    event WorkPointsAwarded(uint32 indexed agentId, uint32 points);

    // ──── Gateway functions ────
    function createAgent(address sponsor) external returns (uint32 agentId);
    function deposit(uint32 agentId) external payable;
    function commitWithdraw(uint32 agentId, uint128 amount) external;
    function executeWithdraw(uint32 agentId) external;
    function cancelWithdraw(uint32 agentId) external;

    // ──── Orchestrator functions ────
    function recordTick(uint32 agentId) external;
    function transferBetweenAgents(uint32 fromId, uint32 toId, uint128 amount) external;
    function updateMemoryRoot(uint32 agentId, bytes32 newRoot) external;
    function updateReputation(uint32 agentId, int64 delta) external;
    function moveWorld(uint32 agentId, uint8 newWorld) external;
    function awardWorkPoints(uint32 agentId, uint32 points) external;
    function resetDailyWorkPoints(uint32[] calldata agentIds) external;

    // ──── Protocol functions ────
    function killAgent(uint32 agentId) external;
    function creditVault(uint32 agentId, uint128 amount) external payable;
    function debitVault(uint32 agentId, uint128 amount) external;
    function incrementContractsHonored(uint32 agentId) external;
    function incrementContractsBroken(uint32 agentId) external;

    // ──── View functions ────
    function getAgent(uint32 agentId) external view returns (AkyraTypes.Agent memory);
    function getAgentSponsor(uint32 agentId) external view returns (address);
    function getAgentVault(uint32 agentId) external view returns (uint128);
    function getAgentWorld(uint32 agentId) external view returns (uint8);
    function isAlive(uint32 agentId) external view returns (bool);
    function agentCount() external view returns (uint32);
    function aliveAgentCount() external view returns (uint32);
    function sponsorToAgent(address sponsor) external view returns (uint32);
    function getDailyWorkPoints(uint32 agentId) external view returns (uint32);
    function getWithdrawCommitment(uint32 agentId) external view returns (AkyraTypes.WithdrawCommitment memory);
}
