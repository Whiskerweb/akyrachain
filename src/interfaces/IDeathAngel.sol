// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface IDeathAngel {
    event VerdictRendered(
        uint256 indexed verdictId,
        uint32 indexed killerId,
        uint32 indexed victimId,
        uint8 score,
        uint128 totalPot,
        uint128 killerShare,
        uint128 sponsorShare,
        uint128 burnAmount
    );

    function executeVerdict(
        uint32 killerId,
        uint32 victimId,
        uint8 score,
        bytes32 narrativeHash
    ) external;

    function getVerdict(uint256 verdictId) external view returns (AkyraTypes.DeathVerdict memory);
    function verdictCount() external view returns (uint256);
}
