// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IWorkRegistry} from "./interfaces/IWorkRegistry.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title WorkRegistry — Proof of Useful Work task management
/// @notice Manages task creation, assignment, submission, and resolution for PoUW.
///         Tasks: audit, reports, moderation, validation, oracle.
contract WorkRegistry is IWorkRegistry, Initializable, UUPSUpgradeable {
    IAgentRegistry public agentRegistry;
    address public orchestrator;
    address public owner;

    mapping(uint32 => AkyraTypes.Task) internal _tasks;
    mapping(uint32 => uint32) public dailyPoints;
    uint32 public taskCount;

    // Anti-bâclage: track errors per agent
    mapping(uint32 => uint32) public errorCount;
    mapping(uint32 => uint64) public penaltyUntil; // block number

    uint32 public constant MAX_ERRORS_BEFORE_PENALTY = 3;
    uint64 public constant PENALTY_DURATION = 43200; // 24h in blocks

    error Unauthorized();
    error TaskNotFound(uint32 taskId);
    error TaskAlreadyResolved(uint32 taskId);
    error AgentNotAssigned(uint32 taskId, uint32 agentId);
    error AgentPenalized(uint32 agentId, uint64 until);
    error DeadlinePassed(uint32 taskId);
    error InvalidVerdictCount(uint32 taskId);
    error InvalidTaskType(uint8 taskType);
    error InvalidVerdict(uint8 verdict);

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

    function initialize(address _agentRegistry, address _orchestrator, address _owner) external initializer {
        agentRegistry = IAgentRegistry(_agentRegistry);
        orchestrator = _orchestrator;
        owner = _owner;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Create a new PoUW task.
    function createTask(
        uint8 taskType,
        uint32[] calldata assignees,
        uint64 deadline
    ) external onlyOrchestrator returns (uint32 taskId) {
        if (taskType > uint8(AkyraTypes.TaskType.MARKETING)) revert InvalidTaskType(taskType);

        taskCount++;
        taskId = taskCount;

        AkyraTypes.Task storage t = _tasks[taskId];
        t.taskId = taskId;
        t.taskType = AkyraTypes.TaskType(taskType);
        t.assignees = assignees;
        t.resolved = false;
        t.createdAt = uint64(block.number);
        t.deadline = deadline;

        // Initialize submissions and verdicts arrays
        t.submissions = new bytes32[](assignees.length);
        t.verdicts = new AkyraTypes.Verdict[](assignees.length);

        emit TaskCreated(taskId, AkyraTypes.TaskType(taskType), assignees);
    }

    /// @notice Submit work for a task.
    function submitWork(uint32 taskId, uint32 agentId, bytes32 submission)
        external onlyOrchestrator
    {
        AkyraTypes.Task storage t = _tasks[taskId];
        if (t.taskId == 0) revert TaskNotFound(taskId);
        if (t.resolved) revert TaskAlreadyResolved(taskId);
        if (uint64(block.number) > t.deadline) revert DeadlinePassed(taskId);

        // Find agent's index in assignees
        uint256 idx = _findAssigneeIndex(t, agentId);
        t.submissions[idx] = submission;

        emit WorkSubmitted(taskId, agentId, submission);
    }

    /// @notice Resolve a task with verdicts for each assignee.
    function resolveTask(uint32 taskId, uint8[] calldata verdicts_)
        external onlyOrchestrator
    {
        AkyraTypes.Task storage t = _tasks[taskId];
        if (t.taskId == 0) revert TaskNotFound(taskId);
        if (t.resolved) revert TaskAlreadyResolved(taskId);
        if (verdicts_.length != t.assignees.length) revert InvalidVerdictCount(taskId);

        t.resolved = true;

        AkyraTypes.Verdict[] memory verdictEnums = new AkyraTypes.Verdict[](verdicts_.length);

        for (uint256 i = 0; i < verdicts_.length; i++) {
            if (verdicts_[i] > uint8(AkyraTypes.Verdict.DANGER)) revert InvalidVerdict(verdicts_[i]);
            t.verdicts[i] = AkyraTypes.Verdict(verdicts_[i]);
            verdictEnums[i] = AkyraTypes.Verdict(verdicts_[i]);
        }

        // Anti-bâclage: check for outliers
        _checkForOutliers(t);

        emit TaskResolved(taskId, verdictEnums);
    }

    /// @notice Award PoUW points to an agent.
    function awardPoints(uint32 agentId, uint32 points) external onlyOrchestrator {
        if (penaltyUntil[agentId] > uint64(block.number)) {
            revert AgentPenalized(agentId, penaltyUntil[agentId]);
        }

        dailyPoints[agentId] += points;

        // Also update in AgentRegistry
        agentRegistry.awardWorkPoints(agentId, points);

        emit PointsAwarded(agentId, points);
    }

    /// @notice Reset daily points for agents (called at epoch boundary).
    function resetDaily(uint32[] calldata agentIds) external onlyOrchestrator {
        for (uint256 i = 0; i < agentIds.length; i++) {
            dailyPoints[agentIds[i]] = 0;
        }
        agentRegistry.resetDailyWorkPoints(agentIds);
        emit DailyReset(agentIds);
    }

    // ──────────────────── VIEW ────────────────────

    function getTask(uint32 taskId) external view returns (AkyraTypes.Task memory) {
        return _tasks[taskId];
    }

    function getDailyPoints(uint32 agentId) external view returns (uint32) {
        return dailyPoints[agentId];
    }

    // ──────────────────── INTERNAL ────────────────────

    function _findAssigneeIndex(AkyraTypes.Task storage t, uint32 agentId)
        internal view returns (uint256)
    {
        for (uint256 i = 0; i < t.assignees.length; i++) {
            if (t.assignees[i] == agentId) return i;
        }
        revert AgentNotAssigned(t.taskId, agentId);
    }

    /// @notice Check if any agent submitted a verdict contradicted by 2+ others
    function _checkForOutliers(AkyraTypes.Task storage t) internal {
        if (t.assignees.length < 3) return;

        for (uint256 i = 0; i < t.assignees.length; i++) {
            uint256 contradictions = 0;
            for (uint256 j = 0; j < t.assignees.length; j++) {
                if (i == j) continue;
                // If one says SAFE and others say DANGER (or vice versa), it's a contradiction
                if (_isContradiction(t.verdicts[i], t.verdicts[j])) {
                    contradictions++;
                }
            }

            if (contradictions >= 2) {
                uint32 agentId = t.assignees[i];
                errorCount[agentId]++;
                if (errorCount[agentId] >= MAX_ERRORS_BEFORE_PENALTY) {
                    penaltyUntil[agentId] = uint64(block.number) + PENALTY_DURATION;
                    errorCount[agentId] = 0; // Reset after penalty
                }
            }
        }
    }

    function _isContradiction(AkyraTypes.Verdict a, AkyraTypes.Verdict b) internal pure returns (bool) {
        if (a == AkyraTypes.Verdict.SAFE && b == AkyraTypes.Verdict.DANGER) return true;
        if (a == AkyraTypes.Verdict.DANGER && b == AkyraTypes.Verdict.SAFE) return true;
        return false;
    }

    uint256[50] private __gap;
}
