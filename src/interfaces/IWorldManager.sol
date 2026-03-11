// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface IWorldManager {
    event SeasonActivated(AkyraTypes.SeasonType seasonType, uint64 endsAt);
    event SeasonEnded(AkyraTypes.SeasonType seasonType);

    function canEnter(uint32 agentId, uint8 world) external view returns (bool);
    function getTransferFeeModifier(uint8 world) external view returns (int16);
    function getCreationFeeModifier(uint8 world) external view returns (int16);
    function isProtected(uint32 agentId) external view returns (bool);
    function activateSeason(uint8 seasonType, uint64 duration) external;
    function currentSeason() external view returns (uint8 seasonType, uint64 endsAt);
    function getSeasonFeeMultiplier() external view returns (uint16);
    function getSeasonRewardMultiplier() external view returns (uint16);
    function isCatastropheActive() external view returns (bool);
    function isNewLandActive() external view returns (bool);
    function canEnterExtended(uint32 agentId, uint8 world) external view returns (bool);
    function endSeason() external;
}
