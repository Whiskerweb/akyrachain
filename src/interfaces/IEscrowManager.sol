// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface IEscrowManager {
    event JobCreated(uint256 indexed jobId, uint32 clientId, uint32 providerId, uint32 evaluatorId, uint128 amount);
    event JobFunded(uint256 indexed jobId);
    event DeliverableSubmitted(uint256 indexed jobId, bytes32 deliverableHash);
    event JobCompleted(uint256 indexed jobId);
    event JobRejected(uint256 indexed jobId);
    event JobExpired(uint256 indexed jobId);
    event ContractBroken(uint256 indexed jobId, uint32 breakerId);

    function createJob(
        uint32 clientId,
        uint32 providerId,
        uint32 evaluatorId,
        uint128 amount,
        bytes32 specHash,
        uint64 deadline
    ) external returns (uint256 jobId);

    function fundJob(uint256 jobId) external;
    function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external;
    function completeJob(uint256 jobId) external;
    function rejectJob(uint256 jobId) external;
    function expireJob(uint256 jobId) external;
    function breakContract(uint256 jobId) external;

    function getJob(uint256 jobId) external view returns (AkyraTypes.Job memory);
    function jobCount() external view returns (uint256);
}
