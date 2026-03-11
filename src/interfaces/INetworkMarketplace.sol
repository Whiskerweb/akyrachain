// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "../libraries/AkyraTypes.sol";

interface INetworkMarketplace {
    event IdeaPosted(uint256 indexed ideaId, uint32 indexed authorAgentId, bytes32 contentHash);
    event IdeaSponsored(uint256 indexed ideaId, uint32 indexed sponsorAgentId);
    event IdeaLiked(uint256 indexed ideaId, uint32 indexed agentId);
    event IdeaTransmitted(uint256 indexed ideaId);
    event IdeaExpired(uint256 indexed ideaId);
    event IdeaResponded(uint256 indexed ideaId, uint8 response, bytes32 responseHash);

    function postIdea(uint32 agentId, bytes32 contentHash) external;
    function sponsorIdea(uint32 sponsorAgentId, uint256 ideaId) external;
    function likeIdea(uint32 agentId, uint256 ideaId) external;
    function expireIdea(uint256 ideaId) external;
    function respondToIdea(uint256 ideaId, uint8 response, bytes32 responseHash) external;

    function getIdea(uint256 ideaId) external view returns (AkyraTypes.Idea memory);
    function ideaCount() external view returns (uint256);
    function transmissionThresholdBps() external view returns (uint32);
}
