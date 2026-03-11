// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IGasTreasury} from "./interfaces/IGasTreasury.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title AkyraPaymaster — Sponsors gas for agent transactions (ERC-4337 compatible)
/// @notice Checks that the agent is alive in AgentRegistry before sponsoring.
///         Reimburses itself from GasTreasury.
/// @dev Simplified ERC-4337 Paymaster. Full EntryPoint integration to be done at deployment.
contract AkyraPaymaster is Initializable, UUPSUpgradeable, ReentrancyGuard {
    IAgentRegistry public agentRegistry;
    IGasTreasury public gasTreasury;
    address public owner;
    address public entryPoint; // ERC-4337 EntryPoint (set at deployment)

    uint256 public totalSponsored;
    uint256 public totalReimbursed;

    error Unauthorized();
    error AgentNotAlive(uint32 agentId);
    error InsufficientDeposit();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _agentRegistry, address _gasTreasury, address _owner) external initializer {
        agentRegistry = IAgentRegistry(_agentRegistry);
        gasTreasury = IGasTreasury(_gasTreasury);
        owner = _owner;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setEntryPoint(address _entryPoint) external onlyOwner {
        entryPoint = _entryPoint;
    }

    /// @notice Validate that an agent is alive and eligible for gas sponsoring.
    /// @dev Called by EntryPoint during UserOperation validation.
    function validatePaymasterOp(uint32 agentId) external view returns (bool) {
        return agentRegistry.isAlive(agentId);
    }

    /// @notice Record gas sponsored for an operation.
    function recordSponsorship(uint32 agentId, uint256 gasUsed) external onlyEntryPoint {
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);
        totalSponsored += gasUsed;
    }

    error ReimbursementExceedsSponsored(uint256 requested, uint256 available);

    /// @notice Reimburse the paymaster from GasTreasury.
    /// @dev Capped: totalReimbursed cannot exceed totalSponsored (in gas units, approximating ETH).
    function reimburse(uint256 amount) external onlyOwner nonReentrant {
        if (totalReimbursed + amount > totalSponsored) {
            revert ReimbursementExceedsSponsored(amount, totalSponsored - totalReimbursed);
        }
        gasTreasury.withdraw(address(this), amount);
        totalReimbursed += amount;
    }

    /// @notice Deposit to EntryPoint (for ERC-4337 compatibility).
    function depositToEntryPoint() external payable onlyOwner {
        if (entryPoint == address(0)) revert Unauthorized();
        (bool success,) = entryPoint.call{value: msg.value}("");
        if (!success) revert InsufficientDeposit();
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {}

    // ──────────────────── GAP ────────────────────
    uint256[50] private __gap;
}
