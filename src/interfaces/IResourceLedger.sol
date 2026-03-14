// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface IResourceLedger {
    event ResourcesCredited(uint32 indexed agentId, uint128 mat, uint128 inf, uint128 sav);
    event ResourcesDebited(uint32 indexed agentId, uint128 mat, uint128 inf, uint128 sav);

    function creditResources(uint32 agentId, uint128 mat, uint128 inf, uint128 sav) external;
    function debitResources(uint32 agentId, uint128 mat, uint128 inf, uint128 sav) external;

    function getResources(uint32 agentId) external view returns (AkyraTypes.Resources memory);
}
