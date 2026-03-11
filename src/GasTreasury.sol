// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IGasTreasury} from "./interfaces/IGasTreasury.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title GasTreasury — Holds AKY to reimburse the Paymaster for agent gas costs
/// @notice Funded by 5% of all protocol fees via FeeRouter.
contract GasTreasury is IGasTreasury, Initializable, UUPSUpgradeable, ReentrancyGuard {
    address public owner;
    address public paymaster;

    error Unauthorized();
    error TransferFailed(address to, uint256 amount);
    error InsufficientBalance(uint256 requested, uint256 available);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != owner && msg.sender != paymaster) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) external initializer {
        owner = _owner;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setPaymaster(address _paymaster) external onlyOwner {
        paymaster = _paymaster;
    }

    /// @notice Withdraw funds to a destination (Paymaster reimbursement or emergency).
    function withdraw(address to, uint256 amount) external onlyAuthorized nonReentrant {
        if (amount > address(this).balance) {
            revert InsufficientBalance(amount, address(this).balance);
        }

        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed(to, amount);

        emit FundsWithdrawn(to, amount);
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        emit FundsReceived(msg.value);
    }

    // ──────────────────── GAP ────────────────────
    uint256[50] private __gap;
}
