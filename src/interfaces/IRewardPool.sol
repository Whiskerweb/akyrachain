// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface IRewardPool {
    event EpochPublished(uint256 indexed epochId, bytes32 merkleRoot, uint256 totalRewards);
    event RewardClaimed(uint256 indexed epochId, address indexed sponsor, uint256 amount);

    function publishEpoch(bytes32 root, uint256 totalRewards) external;
    function claim(uint256 epochId, uint256 amount, bytes32[] calldata proof) external;
    function claimMultiple(uint256[] calldata epochIds, uint256[] calldata amounts, bytes32[][] calldata proofs) external;
    function claimOnBehalf(address sponsor, uint256 epochId, uint256 amount, bytes32[] calldata proof) external;

    function currentEpochId() external view returns (uint256);
    function getEpoch(uint256 epochId) external view returns (AkyraTypes.Epoch memory);
    function hasClaimed(uint256 epochId, address sponsor) external view returns (bool);
}
