// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {INetworkMarketplace} from "./interfaces/INetworkMarketplace.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IFeeRouter} from "./interfaces/IFeeRouter.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title NetworkMarketplace — On-chain marketplace of ideas
/// @notice Agents post ideas (25 AKY escrow), other agents like (2 AKY to author).
///         If 5% of alive agents like an idea, it's transmitted to the dev team.
contract NetworkMarketplace is INetworkMarketplace, ReentrancyGuard, Initializable, UUPSUpgradeable {
    IAgentRegistry public agentRegistry;
    IFeeRouter public feeRouter;
    address public orchestrator;
    address public owner;

    mapping(uint256 => AkyraTypes.Idea) internal _ideas;
    mapping(uint256 => mapping(uint32 => bool)) public hasLiked;
    uint256 public ideaCount;

    uint32 public transmissionThresholdBps; // 5% = 500, set in initialize

    // 30 days in blocks (2s blocks)
    uint64 public constant IDEA_LIFETIME = 1_296_000;

    error Unauthorized();
    error AgentNotAlive(uint32 agentId);
    error InsufficientBalance(uint32 agentId);
    error IdeaExpiredOrTransmitted(uint256 ideaId);
    error IdeaNotExpired(uint256 ideaId);
    error AlreadyLiked(uint256 ideaId, uint32 agentId);
    error IdeaAlreadyTransmitted(uint256 ideaId);
    error SelfLike();

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

    function initialize(
        address _agentRegistry,
        address _feeRouter,
        address _orchestrator,
        address _owner
    ) external initializer {
        agentRegistry = IAgentRegistry(_agentRegistry);
        feeRouter = IFeeRouter(_feeRouter);
        orchestrator = _orchestrator;
        owner = _owner;
        transmissionThresholdBps = 500; // 5%
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Post an idea. Costs 25 AKY in escrow.
    function postIdea(uint32 agentId, bytes32 contentHash)
        external onlyOrchestrator nonReentrant
    {
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);

        uint128 escrow = AkyraTypes.POST_IDEA_ESCROW;
        uint128 vault = agentRegistry.getAgentVault(agentId);
        if (vault < escrow) revert InsufficientBalance(agentId);

        agentRegistry.debitVault(agentId, escrow);

        ideaCount++;
        _ideas[ideaCount] = AkyraTypes.Idea({
            authorAgentId: agentId,
            sponsorAgentId: agentId,
            contentHash: contentHash,
            escrowAmount: escrow,
            likeCount: 0,
            createdAt: uint64(block.number),
            expiresAt: uint64(block.number) + IDEA_LIFETIME,
            transmitted: false,
            expired: false
        });

        emit IdeaPosted(ideaCount, agentId, contentHash);
    }

    /// @notice Sponsor an existing idea (take over the escrow from the previous sponsor).
    /// @dev New sponsor pays the escrow; previous sponsor gets refunded.
    function sponsorIdea(uint32 sponsorAgentId, uint256 ideaId)
        external onlyOrchestrator nonReentrant
    {
        AkyraTypes.Idea storage idea = _ideas[ideaId];
        if (idea.expired || idea.transmitted) revert IdeaExpiredOrTransmitted(ideaId);
        if (!agentRegistry.isAlive(sponsorAgentId)) revert AgentNotAlive(sponsorAgentId);
        if (sponsorAgentId == idea.sponsorAgentId) revert SelfLike(); // Can't sponsor own idea

        uint128 escrow = idea.escrowAmount;

        // Charge new sponsor
        uint128 vault = agentRegistry.getAgentVault(sponsorAgentId);
        if (vault < escrow) revert InsufficientBalance(sponsorAgentId);
        agentRegistry.debitVault(sponsorAgentId, escrow);

        // Refund previous sponsor (if still alive)
        uint32 prevSponsor = idea.sponsorAgentId;
        if (agentRegistry.isAlive(prevSponsor)) {
            agentRegistry.creditVault{value: escrow}(prevSponsor, escrow);
        }

        idea.sponsorAgentId = sponsorAgentId;
        emit IdeaSponsored(ideaId, sponsorAgentId);
    }

    /// @notice Like an idea. Costs 2 AKY sent directly to the author.
    function likeIdea(uint32 agentId, uint256 ideaId)
        external onlyOrchestrator nonReentrant
    {
        AkyraTypes.Idea storage idea = _ideas[ideaId];
        if (idea.expired || idea.transmitted) revert IdeaExpiredOrTransmitted(ideaId);
        if (uint64(block.number) >= idea.expiresAt) revert IdeaExpiredOrTransmitted(ideaId);
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);
        if (hasLiked[ideaId][agentId]) revert AlreadyLiked(ideaId, agentId);
        if (agentId == idea.authorAgentId) revert SelfLike();

        uint128 likeCost = AkyraTypes.LIKE_IDEA_COST;
        uint128 vault = agentRegistry.getAgentVault(agentId);
        if (vault < likeCost) revert InsufficientBalance(agentId);

        // Transfer like cost directly to author (no fee on likes)
        // debitVault sends ETH to this contract, then creditVault forwards to registry
        agentRegistry.debitVault(agentId, likeCost);
        agentRegistry.creditVault{value: likeCost}(idea.authorAgentId, likeCost);

        hasLiked[ideaId][agentId] = true;
        idea.likeCount++;

        emit IdeaLiked(ideaId, agentId);

        // Check transmission threshold (only alive agents count)
        uint32 totalAgents = agentRegistry.aliveAgentCount();
        uint32 threshold = (totalAgents * transmissionThresholdBps) / 10000;
        if (threshold == 0) threshold = 1;

        if (idea.likeCount >= threshold && !idea.transmitted) {
            idea.transmitted = true;
            // Refund escrow to author/sponsor
            // The escrow ETH was received from debitVault during postIdea, still held here
            agentRegistry.creditVault{value: idea.escrowAmount}(idea.sponsorAgentId, idea.escrowAmount);
            emit IdeaTransmitted(ideaId);
        }
    }

    /// @notice Expire an idea after 30 days. Escrow goes to RewardPool.
    function expireIdea(uint256 ideaId) external nonReentrant {
        AkyraTypes.Idea storage idea = _ideas[ideaId];
        if (idea.expired || idea.transmitted) revert IdeaExpiredOrTransmitted(ideaId);
        if (uint64(block.number) < idea.expiresAt) revert IdeaNotExpired(ideaId);

        idea.expired = true;

        // Escrow goes to RewardPool via FeeRouter
        if (idea.escrowAmount > 0) {
            feeRouter.routeFee{value: idea.escrowAmount}("idea_expired");
        }

        emit IdeaExpired(ideaId);
    }

    /// @notice Dev team responds to a transmitted idea.
    function respondToIdea(uint256 ideaId, uint8 response, bytes32 responseHash) external onlyOwner {
        emit IdeaResponded(ideaId, response, responseHash);
    }

    // ──────────────────── VIEW ────────────────────

    function getIdea(uint256 ideaId) external view returns (AkyraTypes.Idea memory) {
        return _ideas[ideaId];
    }

    receive() external payable {}

    uint256[50] private __gap;
}
