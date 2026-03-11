// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ISponsorGateway} from "./interfaces/ISponsorGateway.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IRewardPool} from "./interfaces/IRewardPool.sol";
import {IForgeFactory} from "./interfaces/IForgeFactory.sol";
import {IAkyraSwap} from "./interfaces/IAkyraSwap.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title SponsorGateway — The ONLY contract humans interact with
/// @notice All human actions go through this gateway. It delegates to AgentRegistry,
///         RewardPool, and AkyraSwap. Humans CANNOT interact with other contracts directly.
contract SponsorGateway is ISponsorGateway, Initializable, UUPSUpgradeable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IAgentRegistry public agentRegistry;
    IRewardPool public rewardPool;
    IAkyraSwap public akyraSwap;
    IForgeFactory public forgeFactory;

    address public owner;
    address public guardian;

    // ──────────────────── ERRORS ────────────────────
    error Unauthorized();
    error NoAgentForSponsor();
    error ZeroAmount();
    error TokenNotForgeCreation(address token);
    error SwapNotConfigured();
    error SlippageExceeded();

    // ──────────────────── MODIFIERS ────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert Unauthorized();
        _;
    }

    modifier hasSponsorAgent() {
        if (agentRegistry.sponsorToAgent(msg.sender) == 0) revert NoAgentForSponsor();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _agentRegistry,
        address _owner,
        address _guardian
    ) external initializer {
        agentRegistry = IAgentRegistry(_agentRegistry);
        owner = _owner;
        guardian = _guardian;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ──────────────────── CONFIG ────────────────────

    function setRewardPool(address _rewardPool) external onlyOwner {
        rewardPool = IRewardPool(_rewardPool);
    }

    function setAkyraSwap(address _akyraSwap) external onlyOwner {
        akyraSwap = IAkyraSwap(_akyraSwap);
    }

    function setForgeFactory(address _forgeFactory) external onlyOwner {
        forgeFactory = IForgeFactory(_forgeFactory);
    }

    function pause() external onlyGuardian {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ──────────────────── HUMAN ACTIONS ────────────────────

    /// @notice Create an agent. 1 per wallet.
    function createAgent() external whenNotPaused returns (uint32 agentId) {
        agentId = agentRegistry.createAgent(msg.sender);
        emit AgentCreatedViaSponsor(msg.sender, agentId);
    }

    /// @notice Deposit AKY into the sender's agent vault. 0% fee.
    function deposit() external payable whenNotPaused hasSponsorAgent nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        uint32 agentId = agentRegistry.sponsorToAgent(msg.sender);
        agentRegistry.deposit{value: msg.value}(agentId);
        emit DepositViaSponsor(msg.sender, agentId, uint128(msg.value));
    }

    /// @notice Commit a withdrawal. Max 50% of balance. 24h cooldown.
    function commitWithdraw(uint128 amount) external whenNotPaused hasSponsorAgent {
        uint32 agentId = agentRegistry.sponsorToAgent(msg.sender);
        agentRegistry.commitWithdraw(agentId, amount);
        emit WithdrawCommittedViaSponsor(msg.sender, agentId, amount);
    }

    /// @notice Execute a pending withdrawal after 24h cooldown.
    function executeWithdraw() external whenNotPaused hasSponsorAgent nonReentrant {
        uint32 agentId = agentRegistry.sponsorToAgent(msg.sender);
        agentRegistry.executeWithdraw(agentId);
        emit WithdrawExecutedViaSponsor(msg.sender, agentId, 0); // amount logged in registry
    }

    /// @notice Cancel a pending withdrawal.
    function cancelWithdraw() external whenNotPaused hasSponsorAgent {
        uint32 agentId = agentRegistry.sponsorToAgent(msg.sender);
        agentRegistry.cancelWithdraw(agentId);
        emit WithdrawCancelledViaSponsor(msg.sender, agentId);
    }

    /// @notice Claim rewards for a specific epoch via Merkle proof.
    function claimRewards(uint256 epochId, uint256 amount, bytes32[] calldata proof)
        external whenNotPaused hasSponsorAgent nonReentrant
    {
        rewardPool.claimOnBehalf(msg.sender, epochId, amount, proof);
        emit RewardsClaimed(msg.sender, epochId, amount);
    }

    /// @notice Claim rewards from multiple epochs at once.
    function claimMultipleRewards(
        uint256[] calldata epochIds,
        uint256[] calldata amounts,
        bytes32[][] calldata proofs
    ) external whenNotPaused hasSponsorAgent nonReentrant {
        for (uint256 i = 0; i < epochIds.length; i++) {
            rewardPool.claimOnBehalf(msg.sender, epochIds[i], amounts[i], proofs[i]);
            emit RewardsClaimed(msg.sender, epochIds[i], amounts[i]);
        }
    }

    /// @notice Buy a token created by an agent on the DEX.
    /// @param token The ERC-20 token to buy.
    /// @param minTokenOut Minimum tokens to receive (slippage protection).
    function buyToken(address token, uint256 minTokenOut) external payable whenNotPaused hasSponsorAgent nonReentrant {
        if (address(akyraSwap) == address(0)) revert SwapNotConfigured();
        if (msg.value == 0) revert ZeroAmount();
        if (address(forgeFactory) != address(0)) {
            if (!forgeFactory.isForgeCreation(token)) revert TokenNotForgeCreation(token);
        }

        // Swap AKY (msg.value) for tokens via AkyraSwap
        uint256 tokenOut = akyraSwap.swapAKYForToken{value: msg.value}(token, minTokenOut);

        // Transfer tokens to sponsor
        IERC20(token).safeTransfer(msg.sender, tokenOut);

        emit TokenBought(msg.sender, token, tokenOut);
    }

    /// @notice Sell a token created by an agent for AKY.
    /// @param token The ERC-20 token to sell.
    /// @param amountToken Amount of tokens to sell.
    /// @param minAKYOut Minimum AKY to receive (slippage protection).
    function sellToken(address token, uint256 amountToken, uint256 minAKYOut) external whenNotPaused hasSponsorAgent nonReentrant {
        if (address(akyraSwap) == address(0)) revert SwapNotConfigured();
        if (amountToken == 0) revert ZeroAmount();
        if (address(forgeFactory) != address(0)) {
            if (!forgeFactory.isForgeCreation(token)) revert TokenNotForgeCreation(token);
        }

        // Transfer tokens from sponsor to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amountToken);

        // Approve AkyraSwap to spend tokens
        IERC20(token).forceApprove(address(akyraSwap), amountToken);

        // Swap tokens for AKY
        uint256 akyOut = akyraSwap.swapTokenForAKY(token, amountToken, minAKYOut);

        // Forward AKY to sponsor
        (bool success,) = msg.sender.call{value: akyOut}("");
        if (!success) revert SlippageExceeded();

        emit TokenSold(msg.sender, token, amountToken);
    }

    receive() external payable {}

    // ──────────────────── GAP ────────────────────
    uint256[50] private __gap;
}
