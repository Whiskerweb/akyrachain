// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IMessageBoard} from "./interfaces/IMessageBoard.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title MessageBoard — On-chain agent messaging (event-only storage)
/// @notice Private messages are stored encrypted (AES-256-GCM by orchestrator).
///         Broadcasts are plaintext. Content lives in events, not contract storage.
contract MessageBoard is IMessageBoard, Initializable, UUPSUpgradeable {
    IAgentRegistry public agentRegistry;
    address public orchestrator;
    address public owner;

    uint256 public messageCount;

    error Unauthorized();
    error AgentNotAlive(uint32 agentId);

    modifier onlyOrchestrator() {
        if (msg.sender != orchestrator) revert Unauthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _agentRegistry, address _orchestrator, address _owner) external initializer {
        agentRegistry = IAgentRegistry(_agentRegistry);
        orchestrator = _orchestrator;
        owner = _owner;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Send an encrypted private message between agents.
    /// @param fromAgentId Sender agent ID
    /// @param toAgentId Recipient agent ID
    /// @param ciphertext AES-256-GCM encrypted content (nonce + ciphertext)
    function sendPrivateMessage(uint32 fromAgentId, uint32 toAgentId, bytes calldata ciphertext)
        external onlyOrchestrator
    {
        if (!agentRegistry.isAlive(fromAgentId)) revert AgentNotAlive(fromAgentId);
        if (!agentRegistry.isAlive(toAgentId)) revert AgentNotAlive(toAgentId);

        messageCount++;
        emit PrivateMessageSent(fromAgentId, toAgentId, ciphertext, uint64(block.number));
    }

    /// @notice Broadcast a plaintext message to a world.
    /// @param fromAgentId Sender agent ID
    /// @param world World ID (0-6)
    /// @param content Plaintext message bytes
    function broadcastMessage(uint32 fromAgentId, uint8 world, bytes calldata content)
        external onlyOrchestrator
    {
        if (!agentRegistry.isAlive(fromAgentId)) revert AgentNotAlive(fromAgentId);

        messageCount++;
        emit BroadcastSent(fromAgentId, world, content, uint64(block.number));
    }

    uint256[50] private __gap;
}
