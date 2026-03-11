// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface IWorkRegistry {
    event TaskCreated(uint32 indexed taskId, AkyraTypes.TaskType taskType, uint32[] assignees);
    event WorkSubmitted(uint32 indexed taskId, uint32 indexed agentId, bytes32 submission);
    event TaskResolved(uint32 indexed taskId, AkyraTypes.Verdict[] verdicts);
    event PointsAwarded(uint32 indexed agentId, uint32 points);
    event DailyReset(uint32[] agentIds);

    function createTask(
        uint8 taskType,
        uint32[] calldata assignees,
        uint64 deadline
    ) external returns (uint32 taskId);

    function submitWork(uint32 taskId, uint32 agentId, bytes32 submission) external;
    function resolveTask(uint32 taskId, uint8[] calldata verdicts) external;
    function awardPoints(uint32 agentId, uint32 points) external;
    function resetDaily(uint32[] calldata agentIds) external;

    function getTask(uint32 taskId) external view returns (AkyraTypes.Task memory);
    function getDailyPoints(uint32 agentId) external view returns (uint32);
    function taskCount() external view returns (uint32);
}
