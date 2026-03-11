// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IEscrowManager} from "./interfaces/IEscrowManager.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IFeeRouter} from "./interfaces/IFeeRouter.sol";
import {IDeathAngel} from "./interfaces/IDeathAngel.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title EscrowManager — ERC-8183 compatible escrow for inter-agent commerce
/// @notice Manages jobs between agents: Client pays, Provider delivers, Evaluator validates.
///         Lifecycle: OPEN → FUNDED → SUBMITTED → COMPLETED/REJECTED/EXPIRED
contract EscrowManager is IEscrowManager, ReentrancyGuard, Initializable, UUPSUpgradeable {
    IAgentRegistry public agentRegistry;
    IFeeRouter public feeRouter;
    address public deathAngel;
    address public orchestrator;
    address public owner;

    mapping(uint256 => AkyraTypes.Job) internal _jobs;
    uint256 public jobCount;

    // Escrow balances held in this contract
    mapping(uint256 => uint128) public escrowBalance;

    error Unauthorized();
    error InvalidJobState(uint256 jobId, AkyraTypes.JobState expected, AkyraTypes.JobState actual);
    error AgentNotAlive(uint32 agentId);
    error DeadlineNotReached(uint256 jobId);
    error SameAgent();
    error ZeroAmount();

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

    function setDeathAngel(address _deathAngel) external onlyOwner {
        deathAngel = _deathAngel;
    }

    // ──────────────────── JOB LIFECYCLE ────────────────────

    /// @notice Create a new job (OPEN state).
    function createJob(
        uint32 clientId,
        uint32 providerId,
        uint32 evaluatorId,
        uint128 amount,
        bytes32 specHash,
        uint64 deadline
    ) external onlyOrchestrator returns (uint256 jobId) {
        if (clientId == providerId) revert SameAgent();
        if (evaluatorId == clientId || evaluatorId == providerId) revert SameAgent();
        if (amount == 0) revert ZeroAmount();
        if (!agentRegistry.isAlive(clientId)) revert AgentNotAlive(clientId);
        if (!agentRegistry.isAlive(providerId)) revert AgentNotAlive(providerId);
        if (evaluatorId != 0 && !agentRegistry.isAlive(evaluatorId)) revert AgentNotAlive(evaluatorId);

        jobCount++;
        jobId = jobCount;

        _jobs[jobId] = AkyraTypes.Job({
            clientAgentId: clientId,
            providerAgentId: providerId,
            evaluatorAgentId: evaluatorId,
            amount: amount,
            specHash: specHash,
            deliverableHash: bytes32(0),
            state: AkyraTypes.JobState.OPEN,
            deadline: deadline,
            createdAt: uint64(block.number)
        });

        emit JobCreated(jobId, clientId, providerId, evaluatorId, amount);
    }

    /// @notice Fund the job (OPEN → FUNDED). Debits client vault, holds in escrow.
    function fundJob(uint256 jobId) external onlyOrchestrator nonReentrant {
        AkyraTypes.Job storage job = _jobs[jobId];
        _requireState(jobId, AkyraTypes.JobState.OPEN);

        // Debit client's vault
        agentRegistry.debitVault(job.clientAgentId, job.amount);

        escrowBalance[jobId] = job.amount;
        job.state = AkyraTypes.JobState.FUNDED;

        emit JobFunded(jobId);
    }

    /// @notice Submit a deliverable (FUNDED → SUBMITTED).
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash)
        external onlyOrchestrator
    {
        _requireState(jobId, AkyraTypes.JobState.FUNDED);
        _jobs[jobId].deliverableHash = deliverableHash;
        _jobs[jobId].state = AkyraTypes.JobState.SUBMITTED;

        emit DeliverableSubmitted(jobId, deliverableHash);
    }

    /// @notice Complete the job (SUBMITTED → COMPLETED). Evaluator approves.
    function completeJob(uint256 jobId) external onlyOrchestrator nonReentrant {
        AkyraTypes.Job storage job = _jobs[jobId];
        _requireState(jobId, AkyraTypes.JobState.SUBMITTED);

        uint128 amount = escrowBalance[jobId];
        escrowBalance[jobId] = 0;

        // Calculate fee: 0.5% of amount
        uint128 fee = (amount * uint128(AkyraTypes.TRANSFER_FEE_BPS)) / 10000;
        uint128 payout = amount - fee;

        // Credit provider vault (send ETH along)
        agentRegistry.creditVault{value: payout}(job.providerAgentId, payout);

        // Route fee
        if (fee > 0) {
            feeRouter.routeFee{value: fee}("escrow_complete");
        }

        // Update contract stats
        agentRegistry.incrementContractsHonored(job.clientAgentId);
        agentRegistry.incrementContractsHonored(job.providerAgentId);

        job.state = AkyraTypes.JobState.COMPLETED;

        emit JobCompleted(jobId);
    }

    /// @notice Reject the job (SUBMITTED → REJECTED). Evaluator rejects. Refund client.
    function rejectJob(uint256 jobId) external onlyOrchestrator nonReentrant {
        AkyraTypes.Job storage job = _jobs[jobId];
        _requireState(jobId, AkyraTypes.JobState.SUBMITTED);

        uint128 amount = escrowBalance[jobId];
        escrowBalance[jobId] = 0;

        // Refund client vault (send ETH along)
        agentRegistry.creditVault{value: amount}(job.clientAgentId, amount);

        // Mark provider broken
        agentRegistry.incrementContractsBroken(job.providerAgentId);

        job.state = AkyraTypes.JobState.REJECTED;

        emit JobRejected(jobId);
    }

    /// @notice Expire the job (FUNDED/SUBMITTED → EXPIRED). Anyone after deadline. Refund client.
    function expireJob(uint256 jobId) external nonReentrant {
        AkyraTypes.Job storage job = _jobs[jobId];

        if (job.state != AkyraTypes.JobState.FUNDED && job.state != AkyraTypes.JobState.SUBMITTED) {
            revert InvalidJobState(jobId, AkyraTypes.JobState.FUNDED, job.state);
        }

        if (uint64(block.number) < job.deadline) {
            revert DeadlineNotReached(jobId);
        }

        uint128 amount = escrowBalance[jobId];
        escrowBalance[jobId] = 0;

        // Refund client vault (send ETH along)
        if (amount > 0) {
            agentRegistry.creditVault{value: amount}(job.clientAgentId, amount);
        }

        job.state = AkyraTypes.JobState.EXPIRED;

        emit JobExpired(jobId);
    }

    /// @notice Break a contract (triggers DeathAngel for evaluation of betrayal).
    function breakContract(uint256 jobId) external onlyOrchestrator nonReentrant {
        AkyraTypes.Job storage job = _jobs[jobId];

        if (job.state != AkyraTypes.JobState.FUNDED && job.state != AkyraTypes.JobState.SUBMITTED) {
            revert InvalidJobState(jobId, AkyraTypes.JobState.FUNDED, job.state);
        }

        uint128 amount = escrowBalance[jobId];
        escrowBalance[jobId] = 0;

        // Refund client (send ETH along)
        if (amount > 0) {
            agentRegistry.creditVault{value: amount}(job.clientAgentId, amount);
        }

        // Mark provider broken
        agentRegistry.incrementContractsBroken(job.providerAgentId);

        job.state = AkyraTypes.JobState.REJECTED;

        emit ContractBroken(jobId, job.providerAgentId);
    }

    // ──────────────────── VIEW ────────────────────

    function getJob(uint256 jobId) external view returns (AkyraTypes.Job memory) {
        return _jobs[jobId];
    }

    // ──────────────────── INTERNAL ────────────────────

    function _requireState(uint256 jobId, AkyraTypes.JobState expected) internal view {
        if (_jobs[jobId].state != expected) {
            revert InvalidJobState(jobId, expected, _jobs[jobId].state);
        }
    }

    receive() external payable {}

    uint256[50] private __gap;
}
