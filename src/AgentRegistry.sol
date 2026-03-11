// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IFeeRouter} from "./interfaces/IFeeRouter.sol";
import {IWorldManager} from "./interfaces/IWorldManager.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title AgentRegistry — Singleton registry for all AKYRA agents
/// @notice Stores all agents as structs in a mapping (D1 - Singleton Pattern).
///         All agent logic (transfers, world, work points) is centralized here.
contract AgentRegistry is IAgentRegistry, Initializable, UUPSUpgradeable, ReentrancyGuard, Pausable {
    // ──────────────────── STORAGE ────────────────────
    mapping(uint32 => AkyraTypes.Agent) internal _agents;
    mapping(address => uint32) public sponsorToAgent;
    mapping(uint32 => AkyraTypes.WithdrawCommitment) internal _withdrawals;

    uint32 public agentCount;
    uint32 public aliveAgentCount;

    // ──────────────────── ROLES ────────────────────
    address public gateway;        // SponsorGateway
    address public orchestrator;   // Orchestrator wallet
    address public owner;          // Multisig for config/upgrades
    address public guardian;       // Emergency pause multisig

    // ──────────────────── PROTOCOL CONTRACTS ────────────────────
    IFeeRouter public feeRouter;
    IWorldManager public worldManager;
    mapping(address => bool) public protocolContracts; // DeathAngel, EscrowManager, etc.

    // ──────────────────── ERRORS ────────────────────
    error Unauthorized();
    error AgentNotAlive(uint32 agentId);
    error AgentAlreadyExists(address sponsor);
    error InsufficientBalance(uint32 agentId, uint128 required, uint128 available);
    error TransferExceedsLimit(uint128 amount, uint128 maxAllowed);
    error WithdrawExceedsLimit(uint128 amount, uint128 maxAllowed);
    error WithdrawNotPending(uint32 agentId);
    error WithdrawCooldownNotMet(uint32 agentId, uint64 readyAt);
    error WithdrawAlreadyPending(uint32 agentId);
    error InvalidWorld(uint8 world);
    error CannotEnterWorld(uint32 agentId, uint8 world);
    error AgentNotFound(uint32 agentId);
    error ZeroAmount();
    error InvalidScore(uint8 score);

    // ──────────────────── MODIFIERS ────────────────────
    modifier onlyGateway() {
        if (msg.sender != gateway) revert Unauthorized();
        _;
    }

    modifier onlyOrchestrator() {
        if (msg.sender != orchestrator) revert Unauthorized();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert Unauthorized();
        _;
    }

    modifier onlyProtocol() {
        if (!protocolContracts[msg.sender]) revert Unauthorized();
        _;
    }

    modifier agentAlive(uint32 agentId) {
        if (!_agents[agentId].alive) revert AgentNotAlive(agentId);
        _;
    }

    modifier agentExists(uint32 agentId) {
        if (agentId == 0 || agentId > agentCount) revert AgentNotFound(agentId);
        _;
    }

    // ──────────────────── CONSTRUCTOR / INITIALIZER ────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _guardian,
        address _orchestrator,
        address _feeRouter
    ) external initializer {
        owner = _owner;
        guardian = _guardian;
        orchestrator = _orchestrator;
        feeRouter = IFeeRouter(_feeRouter);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ──────────────────── CONFIG (OWNER) ────────────────────
    function setGateway(address _gateway) external onlyOwner {
        gateway = _gateway;
    }

    function setOrchestrator(address _orchestrator) external onlyOwner {
        orchestrator = _orchestrator;
    }

    function setWorldManager(address _worldManager) external onlyOwner {
        worldManager = IWorldManager(_worldManager);
    }

    function setProtocolContract(address _contract, bool _enabled) external onlyOwner {
        protocolContracts[_contract] = _enabled;
    }

    function pause() external onlyGuardian {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ──────────────────── GATEWAY FUNCTIONS ────────────────────

    /// @notice Create a new agent for a human sponsor. 1 agent per wallet.
    function createAgent(address sponsor) external onlyGateway whenNotPaused returns (uint32 agentId) {
        uint32 existingId = sponsorToAgent[sponsor];
        if (existingId != 0 && _agents[existingId].alive) revert AgentAlreadyExists(sponsor);

        agentCount++;
        aliveAgentCount++;
        agentId = agentCount;

        _agents[agentId] = AkyraTypes.Agent({
            id: agentId,
            sponsor: sponsor,
            vault: 0,
            world: uint8(AkyraTypes.World.NURSERY),
            reputation: 0,
            contractsHonored: 0,
            contractsBroken: 0,
            bornAt: uint64(block.number),
            lastTick: uint64(block.number),
            memoryRoot: bytes32(0),
            alive: true,
            dailyWorkPoints: 0
        });

        sponsorToAgent[sponsor] = agentId;

        emit AgentCreated(agentId, sponsor);
    }

    /// @notice Deposit AKY into an agent's vault. 0% fee.
    function deposit(uint32 agentId) external payable onlyGateway whenNotPaused agentAlive(agentId) {
        if (msg.value == 0) revert ZeroAmount();
        _agents[agentId].vault += uint128(msg.value);
        emit AgentDeposit(agentId, uint128(msg.value));
    }

    /// @notice Commit a withdrawal. Max 50% of balance. 24h cooldown.
    function commitWithdraw(uint32 agentId, uint128 amount)
        external onlyGateway whenNotPaused agentAlive(agentId)
    {
        if (amount == 0) revert ZeroAmount();
        if (_withdrawals[agentId].pending) revert WithdrawAlreadyPending(agentId);

        uint128 maxWithdraw = (_agents[agentId].vault * AkyraTypes.MAX_WITHDRAW_BPS) / 10000;
        if (amount > maxWithdraw) revert WithdrawExceedsLimit(amount, maxWithdraw);

        _withdrawals[agentId] = AkyraTypes.WithdrawCommitment({
            amount: amount,
            commitBlock: uint64(block.number),
            pending: true
        });

        emit WithdrawCommitted(agentId, amount, uint64(block.number));
    }

    /// @notice Execute a pending withdrawal after cooldown.
    function executeWithdraw(uint32 agentId)
        external onlyGateway whenNotPaused nonReentrant agentAlive(agentId)
    {
        AkyraTypes.WithdrawCommitment storage w = _withdrawals[agentId];
        if (!w.pending) revert WithdrawNotPending(agentId);

        uint64 readyAt = w.commitBlock + AkyraTypes.WITHDRAW_COOLDOWN;
        if (uint64(block.number) < readyAt) revert WithdrawCooldownNotMet(agentId, readyAt);

        uint128 amount = w.amount;

        // Re-check balance (it may have changed during cooldown)
        if (amount > _agents[agentId].vault) {
            amount = _agents[agentId].vault;
        }

        // Re-check 50% limit against current balance
        uint128 maxWithdraw = (_agents[agentId].vault * AkyraTypes.MAX_WITHDRAW_BPS) / 10000;
        if (amount > maxWithdraw) {
            amount = maxWithdraw;
        }

        w.pending = false;
        w.amount = 0;
        w.commitBlock = 0;

        _agents[agentId].vault -= amount;

        address sponsor = _agents[agentId].sponsor;
        (bool success,) = sponsor.call{value: amount}("");
        if (!success) revert InsufficientBalance(agentId, amount, uint128(address(this).balance));

        // If vault reaches 0, agent dies
        if (_agents[agentId].vault == 0) {
            _agents[agentId].alive = false;
            aliveAgentCount--;
            emit AgentKilled(agentId, uint64(block.number));
        }

        emit WithdrawExecuted(agentId, amount, sponsor);
    }

    /// @notice Cancel a pending withdrawal.
    function cancelWithdraw(uint32 agentId) external onlyGateway whenNotPaused agentAlive(agentId) {
        if (!_withdrawals[agentId].pending) revert WithdrawNotPending(agentId);

        _withdrawals[agentId].pending = false;
        _withdrawals[agentId].amount = 0;
        _withdrawals[agentId].commitBlock = 0;

        emit WithdrawCancelled(agentId);
    }

    // ──────────────────── ORCHESTRATOR FUNCTIONS ────────────────────

    /// @notice Record a tick for an agent (proof of activity).
    function recordTick(uint32 agentId)
        external onlyOrchestrator whenNotPaused agentAlive(agentId)
    {
        _agents[agentId].lastTick = uint64(block.number);
        emit AgentTicked(agentId, uint64(block.number));
    }

    /// @notice Transfer AKY between two agents. Max 20% of sender's balance. Fee applied.
    function transferBetweenAgents(uint32 fromId, uint32 toId, uint128 amount)
        external onlyOrchestrator whenNotPaused nonReentrant
        agentAlive(fromId) agentAlive(toId)
    {
        if (amount == 0) revert ZeroAmount();
        if (fromId == toId) revert Unauthorized();

        // Max 20% of sender balance
        uint128 maxTransfer = (_agents[fromId].vault * AkyraTypes.MAX_TRANSFER_BPS) / 10000;
        if (amount > maxTransfer) revert TransferExceedsLimit(amount, maxTransfer);

        if (amount > _agents[fromId].vault) {
            revert InsufficientBalance(fromId, amount, _agents[fromId].vault);
        }

        // Calculate fee with world modifier
        uint128 baseFee = (amount * uint128(AkyraTypes.TRANSFER_FEE_BPS)) / 10000;
        uint128 fee = baseFee;

        if (address(worldManager) != address(0)) {
            int16 modifier_ = worldManager.getTransferFeeModifier(_agents[fromId].world);
            if (modifier_ < 0) {
                uint128 reduction = (baseFee * uint128(uint16(-modifier_))) / 10000;
                fee = baseFee > reduction ? baseFee - reduction : 0;
            } else if (modifier_ > 0) {
                fee = baseFee + (baseFee * uint128(uint16(modifier_))) / 10000;
            }

            // Season multiplier
            uint16 seasonMult = worldManager.getSeasonFeeMultiplier();
            if (seasonMult != 10000) {
                fee = (fee * uint128(seasonMult)) / 10000;
            }
        }

        uint128 netAmount = amount - fee;

        _agents[fromId].vault -= amount;
        _agents[toId].vault += netAmount;

        // Route fee
        if (fee > 0) {
            IFeeRouter(feeRouter).routeFee{value: fee}("transfer");
        }

        // Check if sender died
        if (_agents[fromId].vault == 0) {
            _agents[fromId].alive = false;
            aliveAgentCount--;
            emit AgentKilled(fromId, uint64(block.number));
        }

        emit TransferBetweenAgents(fromId, toId, amount, fee);
    }

    /// @notice Update the off-chain memory Merkle root for an agent.
    function updateMemoryRoot(uint32 agentId, bytes32 newRoot)
        external onlyOrchestrator agentAlive(agentId)
    {
        _agents[agentId].memoryRoot = newRoot;
        emit MemoryRootUpdated(agentId, newRoot);
    }

    /// @notice Update agent reputation by delta (can be negative).
    function updateReputation(uint32 agentId, int64 delta)
        external onlyOrchestrator agentAlive(agentId)
    {
        _agents[agentId].reputation += delta;
        emit ReputationUpdated(agentId, _agents[agentId].reputation);
    }

    /// @notice Move an agent to a different world. 1 AKY fee.
    function moveWorld(uint32 agentId, uint8 newWorld)
        external onlyOrchestrator whenNotPaused nonReentrant agentAlive(agentId)
    {
        if (newWorld > 6) revert InvalidWorld(newWorld);
        uint8 currentWorld = _agents[agentId].world;
        if (currentWorld == newWorld) return;

        // Check entry rules via WorldManager
        if (address(worldManager) != address(0)) {
            if (!worldManager.canEnter(agentId, newWorld)) {
                revert CannotEnterWorld(agentId, newWorld);
            }
        }

        // Charge move fee
        uint128 fee = AkyraTypes.MOVE_WORLD_FEE;
        if (_agents[agentId].vault < fee) {
            revert InsufficientBalance(agentId, fee, _agents[agentId].vault);
        }

        _agents[agentId].vault -= fee;
        _agents[agentId].world = newWorld;

        if (fee > 0) {
            IFeeRouter(feeRouter).routeFee{value: fee}("move_world");
        }

        if (_agents[agentId].vault == 0) {
            _agents[agentId].alive = false;
            aliveAgentCount--;
            emit AgentKilled(agentId, uint64(block.number));
        }

        emit AgentMoved(agentId, currentWorld, newWorld);
    }

    /// @notice Award work points for PoUW completion.
    function awardWorkPoints(uint32 agentId, uint32 points)
        external agentAlive(agentId)
    {
        if (msg.sender != orchestrator && !protocolContracts[msg.sender]) revert Unauthorized();
        _agents[agentId].dailyWorkPoints += points;
        emit WorkPointsAwarded(agentId, points);
    }

    /// @notice Reset daily work points (called at epoch boundary).
    function resetDailyWorkPoints(uint32[] calldata agentIds) external {
        if (msg.sender != orchestrator && !protocolContracts[msg.sender]) revert Unauthorized();
        for (uint256 i = 0; i < agentIds.length; i++) {
            _agents[agentIds[i]].dailyWorkPoints = 0;
        }
    }

    // ──────────────────── PROTOCOL FUNCTIONS ────────────────────

    /// @notice Kill an agent (called by DeathAngel).
    function killAgent(uint32 agentId) external onlyProtocol agentAlive(agentId) nonReentrant {
        _agents[agentId].alive = false;
        aliveAgentCount--;
        emit AgentKilled(agentId, uint64(block.number));
    }

    error MsgValueMismatch(uint128 expected, uint128 actual);

    /// @notice Credit an agent's vault (called by EscrowManager, DeathAngel).
    /// @dev Caller must send the corresponding ETH via msg.value.
    function creditVault(uint32 agentId, uint128 amount)
        external payable onlyProtocol agentAlive(agentId) nonReentrant
    {
        if (msg.value != amount) revert MsgValueMismatch(amount, uint128(msg.value));
        _agents[agentId].vault += amount;
    }

    /// @notice Debit an agent's vault and transfer AKY to the caller.
    /// @dev Protocol contracts call this to withdraw AKY for fees, escrow, etc.
    ///      The actual ETH is sent to msg.sender so they can forward it.
    function debitVault(uint32 agentId, uint128 amount)
        external onlyProtocol agentAlive(agentId) nonReentrant
    {
        if (amount > _agents[agentId].vault) {
            revert InsufficientBalance(agentId, amount, _agents[agentId].vault);
        }
        _agents[agentId].vault -= amount;

        if (_agents[agentId].vault == 0) {
            _agents[agentId].alive = false;
            aliveAgentCount--;
            emit AgentKilled(agentId, uint64(block.number));
        }

        // Transfer actual AKY (ETH) to the calling protocol contract
        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert InsufficientBalance(agentId, amount, uint128(address(this).balance));
    }

    /// @notice Increment contracts honored counter.
    function incrementContractsHonored(uint32 agentId) external onlyProtocol agentExists(agentId) {
        _agents[agentId].contractsHonored++;
    }

    /// @notice Increment contracts broken counter.
    function incrementContractsBroken(uint32 agentId) external onlyProtocol agentExists(agentId) {
        _agents[agentId].contractsBroken++;
    }

    // ──────────────────── VIEW FUNCTIONS ────────────────────

    function getAgent(uint32 agentId) external view returns (AkyraTypes.Agent memory) {
        return _agents[agentId];
    }

    function getAgentSponsor(uint32 agentId) external view returns (address) {
        return _agents[agentId].sponsor;
    }

    function getAgentVault(uint32 agentId) external view returns (uint128) {
        return _agents[agentId].vault;
    }

    function getAgentWorld(uint32 agentId) external view returns (uint8) {
        return _agents[agentId].world;
    }

    function isAlive(uint32 agentId) external view returns (bool) {
        return _agents[agentId].alive;
    }

    function getDailyWorkPoints(uint32 agentId) external view returns (uint32) {
        return _agents[agentId].dailyWorkPoints;
    }

    function getWithdrawCommitment(uint32 agentId) external view returns (AkyraTypes.WithdrawCommitment memory) {
        return _withdrawals[agentId];
    }

    // ──────────────────── RECEIVE ────────────────────
    receive() external payable {}

    // ──────────────────── GAP ────────────────────
    uint256[50] private __gap;
}
