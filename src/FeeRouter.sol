// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IFeeRouter} from "./interfaces/IFeeRouter.sol";

/// @title FeeRouter — Immutable fee splitter for the AKYRA protocol
/// @notice Splits all incoming AKY fees: 80% RewardPool, 15% InfraWallet, 5% GasTreasury
/// @dev This contract is IMMUTABLE (no proxy, no upgrades). If destinations need to change,
///      deploy a new FeeRouter and reconfigure upstream contracts.
contract FeeRouter is IFeeRouter {
    address public immutable rewardPool;
    address public immutable infraWallet;
    address public immutable gasTreasury;

    uint16 public constant REWARD_BPS = 8000;   // 80%
    uint16 public constant INFRA_BPS = 1500;    // 15%
    uint16 public constant GAS_BPS = 500;       // 5%

    error ZeroAddress();
    error ZeroValue();
    error TransferFailed(address to, uint256 amount);

    constructor(address _rewardPool, address _infraWallet, address _gasTreasury) {
        if (_rewardPool == address(0) || _infraWallet == address(0) || _gasTreasury == address(0)) {
            revert ZeroAddress();
        }
        rewardPool = _rewardPool;
        infraWallet = _infraWallet;
        gasTreasury = _gasTreasury;
    }

    /// @notice Route an incoming AKY fee to the three destinations
    /// @param feeType A label for the type of fee (for event indexing)
    function routeFee(string calldata feeType) external payable {
        if (msg.value == 0) revert ZeroValue();

        uint256 toReward = (msg.value * REWARD_BPS) / 10000;
        uint256 toInfra = (msg.value * INFRA_BPS) / 10000;
        uint256 toGas = msg.value - toReward - toInfra; // remainder avoids rounding dust

        _safeTransfer(rewardPool, toReward);
        _safeTransfer(infraWallet, toInfra);
        _safeTransfer(gasTreasury, toGas);

        emit FeeRouted(msg.value, toReward, toInfra, toGas, feeType);
    }

    function _safeTransfer(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);
    }
}
