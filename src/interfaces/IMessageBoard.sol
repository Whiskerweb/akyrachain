// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IMessageBoard {
    event PrivateMessageSent(
        uint32 indexed fromAgentId,
        uint32 indexed toAgentId,
        bytes ciphertext,
        uint64 blockNumber
    );
    event BroadcastSent(
        uint32 indexed fromAgentId,
        uint8 indexed world,
        bytes content,
        uint64 blockNumber
    );

    function sendPrivateMessage(uint32 fromAgentId, uint32 toAgentId, bytes calldata ciphertext) external;
    function broadcastMessage(uint32 fromAgentId, uint8 world, bytes calldata content) external;

    function messageCount() external view returns (uint256);
}
