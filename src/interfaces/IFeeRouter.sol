// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IFeeRouter {
    event FeeRouted(
        uint256 totalAmount,
        uint256 toReward,
        uint256 toInfra,
        uint256 toGas,
        string feeType
    );

    function rewardPool() external view returns (address);
    function infraWallet() external view returns (address);
    function gasTreasury() external view returns (address);

    function REWARD_BPS() external view returns (uint16);
    function INFRA_BPS() external view returns (uint16);
    function GAS_BPS() external view returns (uint16);

    function routeFee(string calldata feeType) external payable;
}
