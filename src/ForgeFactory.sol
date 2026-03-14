// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IForgeFactory} from "./interfaces/IForgeFactory.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IFeeRouter} from "./interfaces/IFeeRouter.sol";
import {IWorldManager} from "./interfaces/IWorldManager.sol";
import {AkyraTypes} from "./libraries/AkyraTypes.sol";
import {AkyraERC20} from "./templates/AkyraERC20.sol";
import {AkyraERC721} from "./templates/AkyraERC721.sol";
import {AkyraDAO} from "./templates/AkyraDAO.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title ForgeFactory — Template-based asset creation by agents
/// @notice Phase 1: only pre-audited templates. Agents pay creation fees.
contract ForgeFactory is IForgeFactory, ReentrancyGuard, Initializable, UUPSUpgradeable {
    IAgentRegistry public agentRegistry;
    IFeeRouter public feeRouter;
    IWorldManager public worldManager;
    address public orchestrator;
    address public owner;

    mapping(address => uint32) public creatorOf;
    mapping(address => bool) internal _isForgeCreation;
    address[] public allCreations;

    error Unauthorized();
    error AgentNotAlive(uint32 agentId);
    error InsufficientBalance(uint32 agentId, uint128 required);

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
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setWorldManager(address _worldManager) external onlyOwner {
        worldManager = IWorldManager(_worldManager);
    }

    // ──────────────────── CREATION FUNCTIONS ────────────────────

    /// @notice Create an ERC-20 token. Fee: 50 AKY (modified by world).
    function createToken(
        uint32 agentId,
        string calldata name,
        string calldata symbol,
        uint256 totalSupply
    ) external onlyOrchestrator nonReentrant returns (address token) {
        _checkAlive(agentId);

        uint128 fee = _getCreationFee(AkyraTypes.CREATION_TOKEN_FEE, agentId);
        _chargeFee(agentId, fee, "forge_token");

        // Deploy the token, minting to this contract (ForgeFactory)
        // The agent's vault is a logical balance in AgentRegistry, not an address that can hold ERC20
        // Tokens are held by ForgeFactory and managed via orchestrator
        AkyraERC20 newToken = new AkyraERC20(name, symbol, totalSupply, agentId, address(this));
        token = address(newToken);

        creatorOf[token] = agentId;
        _isForgeCreation[token] = true;
        allCreations.push(token);

        emit TokenCreated(agentId, token, name, symbol, totalSupply);
    }

    /// @notice Create an ERC-721 NFT collection. Fee: 10 AKY (modified by world).
    function createNFT(
        uint32 agentId,
        string calldata name,
        string calldata symbol,
        uint256 maxSupply,
        string calldata baseURI
    ) external onlyOrchestrator nonReentrant returns (address nft) {
        _checkAlive(agentId);

        uint128 fee = _getCreationFee(AkyraTypes.CREATION_NFT_FEE, agentId);
        _chargeFee(agentId, fee, "forge_nft");

        AkyraERC721 newNFT = new AkyraERC721(name, symbol, maxSupply, baseURI, agentId);
        nft = address(newNFT);

        creatorOf[nft] = agentId;
        _isForgeCreation[nft] = true;
        allCreations.push(nft);

        emit NFTCreated(agentId, nft, name, symbol, maxSupply);
    }

    /// @notice Create a DAO contract. Fee: 75 AKY.
    function createDAO(
        uint32 agentId,
        string calldata name,
        uint16 quorumBps,
        uint64 votingPeriod
    ) external onlyOrchestrator nonReentrant returns (address dao) {
        _checkAlive(agentId);

        uint128 fee = AkyraTypes.CREATION_CLAN_FEE; // No world modifier for DAO
        _chargeFee(agentId, fee, "forge_dao");

        AkyraDAO newDAO = new AkyraDAO(name, agentId, quorumBps, votingPeriod);
        dao = address(newDAO);

        creatorOf[dao] = agentId;
        _isForgeCreation[dao] = true;
        allCreations.push(dao);

        emit DAOCreated(agentId, dao, name);
    }

    // ──────────────────── TOKEN MANAGEMENT ────────────────────

    /// @notice Transfer tokens held by ForgeFactory to a recipient (for pool creation).
    function transferCreatorTokens(
        address token,
        uint256 amount,
        address to
    ) external onlyOrchestrator {
        require(_isForgeCreation[token], "Not a forge token");
        require(to != address(0), "Zero address");
        IERC20(token).transfer(to, amount);
    }

    /// @notice Approve a spender to use tokens held by ForgeFactory (for AkyraSwap).
    function approveTokens(
        address token,
        address spender,
        uint256 amount
    ) external onlyOrchestrator {
        require(_isForgeCreation[token], "Not a forge token");
        IERC20(token).approve(spender, amount);
    }

    // ──────────────────── VIEW ────────────────────

    function isForgeCreation(address token) external view returns (bool) {
        return _isForgeCreation[token];
    }

    function allCreationsLength() external view returns (uint256) {
        return allCreations.length;
    }

    // ──────────────────── INTERNAL ────────────────────

    function _checkAlive(uint32 agentId) internal view {
        if (!agentRegistry.isAlive(agentId)) revert AgentNotAlive(agentId);
    }

    function _getCreationFee(uint128 baseFee, uint32 agentId) internal view returns (uint128) {
        if (address(worldManager) == address(0)) return baseFee;

        uint8 world = agentRegistry.getAgentWorld(agentId);
        int16 modifier_ = worldManager.getCreationFeeModifier(world);

        if (modifier_ < 0) {
            uint128 discount = (baseFee * uint128(uint16(-modifier_))) / 10000;
            return baseFee > discount ? baseFee - discount : 0;
        } else if (modifier_ > 0) {
            return baseFee + (baseFee * uint128(uint16(modifier_))) / 10000;
        }
        return baseFee;
    }

    function _chargeFee(uint32 agentId, uint128 fee, string memory feeType) internal {
        if (fee == 0) return;

        uint128 vault = agentRegistry.getAgentVault(agentId);
        if (vault < fee) revert InsufficientBalance(agentId, fee);

        agentRegistry.debitVault(agentId, fee);

        // Route fee — the AKY is held in AgentRegistry, debitVault reduces the vault
        // We need to pull it from the registry. The registry holds the actual ETH.
        // We forward the fee to FeeRouter.
        feeRouter.routeFee{value: fee}(feeType);
    }

    receive() external payable {}

    uint256[50] private __gap;
}
