// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IFeeRouter} from "./interfaces/IFeeRouter.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title AkyraSwap — Minimal Uniswap V2-style AMM for AKY/token pairs
/// @notice Supports AKY (native) paired with ERC-20 tokens created by agents.
///         Fee: 0.3% routed to FeeRouter.
contract AkyraSwap is Initializable, UUPSUpgradeable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Pool {
        address token;
        uint128 reserveAKY;
        uint128 reserveToken;
        uint256 totalLP;
        bool exists;
    }

    mapping(address => Pool) public pools;        // token => Pool
    mapping(address => mapping(address => uint256)) public lpBalances; // token => user => LP

    address[] public allPools;

    IFeeRouter public feeRouter;
    address public owner;
    address public orchestrator;

    uint16 public constant SWAP_FEE_BPS = 30; // 0.3%
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    error Unauthorized();
    error PoolExists(address token);
    error PoolNotFound(address token);
    error InsufficientLiquidity();
    error InsufficientAmount();
    error ZeroAmount();
    error TransferFailed();
    error InvalidK();
    error SlippageExceeded();
    error Overflow();

    event PoolCreated(address indexed token, uint128 reserveAKY, uint128 reserveToken, uint256 lpMinted);
    event LiquidityAdded(address indexed token, address indexed provider, uint256 akyAmount, uint256 tokenAmount, uint256 lpMinted);
    event LiquidityRemoved(address indexed token, address indexed provider, uint256 akyOut, uint256 tokenOut, uint256 lpBurned);
    event Swap(address indexed token, address indexed user, bool akyToToken, uint256 amountIn, uint256 amountOut, uint256 fee);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOrchestratorOrOwner() {
        if (msg.sender != orchestrator && msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _feeRouter, address _owner, address _orchestrator) external initializer {
        feeRouter = IFeeRouter(_feeRouter);
        owner = _owner;
        orchestrator = _orchestrator;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @dev Safe downcast from uint256 to uint128
    function _safeU128(uint256 value) internal pure returns (uint128) {
        if (value > type(uint128).max) revert Overflow();
        return uint128(value);
    }

    // ──────────────────── POOL MANAGEMENT ────────────────────

    /// @notice Create a new AKY/token pool with initial liquidity.
    function createPool(address token, uint256 tokenAmount)
        external payable nonReentrant returns (uint256 lpMinted)
    {
        if (pools[token].exists) revert PoolExists(token);
        if (msg.value == 0 || tokenAmount == 0) revert ZeroAmount();

        uint128 akyAmount = _safeU128(msg.value);
        uint128 tokenAmt = _safeU128(tokenAmount);

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        uint256 liquidity = _sqrt(msg.value * tokenAmount);
        if (liquidity <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();

        // Lock minimum liquidity
        lpMinted = liquidity - MINIMUM_LIQUIDITY;

        pools[token] = Pool({
            token: token,
            reserveAKY: akyAmount,
            reserveToken: tokenAmt,
            totalLP: liquidity,
            exists: true
        });

        lpBalances[token][address(0)] = MINIMUM_LIQUIDITY; // locked
        lpBalances[token][msg.sender] = lpMinted;
        allPools.push(token);

        emit PoolCreated(token, akyAmount, tokenAmt, lpMinted);

        return lpMinted;
    }

    /// @notice Add liquidity to an existing pool.
    function addLiquidity(address token, uint256 tokenAmountMax)
        external payable nonReentrant returns (uint256 lpMinted, uint256 tokenUsed)
    {
        Pool storage pool = pools[token];
        if (!pool.exists) revert PoolNotFound(token);
        if (msg.value == 0) revert ZeroAmount();

        // Calculate optimal token amount
        tokenUsed = (msg.value * uint256(pool.reserveToken)) / uint256(pool.reserveAKY);
        if (tokenUsed > tokenAmountMax) revert SlippageExceeded();
        if (tokenUsed == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenUsed);

        lpMinted = (msg.value * pool.totalLP) / uint256(pool.reserveAKY);

        pool.reserveAKY += _safeU128(msg.value);
        pool.reserveToken += _safeU128(tokenUsed);
        pool.totalLP += lpMinted;
        lpBalances[token][msg.sender] += lpMinted;

        emit LiquidityAdded(token, msg.sender, msg.value, tokenUsed, lpMinted);

        return (lpMinted, tokenUsed);
    }

    /// @notice Remove liquidity from a pool.
    function removeLiquidity(address token, uint256 lpAmount)
        external nonReentrant returns (uint256 akyOut, uint256 tokenOut)
    {
        Pool storage pool = pools[token];
        if (!pool.exists) revert PoolNotFound(token);
        if (lpAmount == 0) revert ZeroAmount();
        if (lpBalances[token][msg.sender] < lpAmount) revert InsufficientLiquidity();

        akyOut = (lpAmount * uint256(pool.reserveAKY)) / pool.totalLP;
        tokenOut = (lpAmount * uint256(pool.reserveToken)) / pool.totalLP;

        if (akyOut == 0 || tokenOut == 0) revert InsufficientAmount();

        lpBalances[token][msg.sender] -= lpAmount;
        pool.totalLP -= lpAmount;
        pool.reserveAKY -= _safeU128(akyOut);
        pool.reserveToken -= _safeU128(tokenOut);

        (bool success,) = msg.sender.call{value: akyOut}("");
        if (!success) revert TransferFailed();
        IERC20(token).safeTransfer(msg.sender, tokenOut);

        emit LiquidityRemoved(token, msg.sender, akyOut, tokenOut, lpAmount);

        return (akyOut, tokenOut);
    }

    // ──────────────────── SWAP ────────────────────

    /// @notice Swap AKY for tokens. Fee taken from input.
    function swapAKYForToken(address token, uint256 minTokenOut)
        external payable nonReentrant returns (uint256 tokenOut)
    {
        Pool storage pool = pools[token];
        if (!pool.exists) revert PoolNotFound(token);
        if (msg.value == 0) revert ZeroAmount();

        // Calculate fee from input
        uint256 fee = (msg.value * SWAP_FEE_BPS) / 10000;
        uint256 akyIn = msg.value - fee;

        // Capture old K for invariant check
        uint256 kBefore = uint256(pool.reserveAKY) * uint256(pool.reserveToken);

        // x * y = k (constant product)
        tokenOut = (akyIn * uint256(pool.reserveToken)) / (uint256(pool.reserveAKY) + akyIn);
        if (tokenOut == 0 || tokenOut < minTokenOut) revert SlippageExceeded();

        pool.reserveAKY += _safeU128(akyIn);
        pool.reserveToken -= _safeU128(tokenOut);

        // K-invariant check
        uint256 kAfter = uint256(pool.reserveAKY) * uint256(pool.reserveToken);
        if (kAfter < kBefore) revert InvalidK();

        // Route fee
        if (fee > 0) {
            feeRouter.routeFee{value: fee}("swap");
        }

        IERC20(token).safeTransfer(msg.sender, tokenOut);

        emit Swap(token, msg.sender, true, msg.value, tokenOut, fee);

        return tokenOut;
    }

    /// @notice Swap tokens for AKY. Fee taken from AKY output and routed to FeeRouter.
    function swapTokenForAKY(address token, uint256 tokenIn, uint256 minAKYOut)
        external nonReentrant returns (uint256 akyOut)
    {
        Pool storage pool = pools[token];
        if (!pool.exists) revert PoolNotFound(token);
        if (tokenIn == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenIn);

        // Capture old K for invariant check
        uint256 kBefore = uint256(pool.reserveAKY) * uint256(pool.reserveToken);

        // Calculate gross AKY output (full tokenIn used for AMM math)
        uint256 grossAkyOut = (tokenIn * uint256(pool.reserveAKY)) / (uint256(pool.reserveToken) + tokenIn);

        // Fee taken from AKY output (consistent with swapAKYForToken routing to FeeRouter)
        uint256 fee = (grossAkyOut * SWAP_FEE_BPS) / 10000;
        akyOut = grossAkyOut - fee;
        if (akyOut == 0 || akyOut < minAKYOut) revert SlippageExceeded();

        pool.reserveToken += _safeU128(tokenIn);
        pool.reserveAKY -= _safeU128(grossAkyOut);

        // K-invariant check
        uint256 kAfter = uint256(pool.reserveAKY) * uint256(pool.reserveToken);
        if (kAfter < kBefore) revert InvalidK();

        // Route fee in AKY to FeeRouter (consistent with swapAKYForToken)
        if (fee > 0) {
            feeRouter.routeFee{value: fee}("swap");
        }

        (bool success,) = msg.sender.call{value: akyOut}("");
        if (!success) revert TransferFailed();

        emit Swap(token, msg.sender, false, tokenIn, akyOut, fee);

        return akyOut;
    }

    // ──────────────────── VIEW ────────────────────

    function getPool(address token) external view returns (Pool memory) {
        return pools[token];
    }

    function getReserves(address token) external view returns (uint128 reserveAKY, uint128 reserveToken) {
        Pool storage pool = pools[token];
        return (pool.reserveAKY, pool.reserveToken);
    }

    function getAmountOut(uint256 amountIn, uint128 reserveIn, uint128 reserveOut) public pure returns (uint256) {
        uint256 amountInAfterFee = (amountIn * (10000 - SWAP_FEE_BPS)) / 10000;
        return (amountInAfterFee * uint256(reserveOut)) / (uint256(reserveIn) + amountInAfterFee);
    }

    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }

    // ──────────────────── INTERNAL ────────────────────

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    receive() external payable {}

    // ──────────────────── GAP ────────────────────
    uint256[50] private __gap;
}
