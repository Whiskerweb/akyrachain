// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AkyraSwap} from "../src/AkyraSwap.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {MockERC20} from "./helpers/MockERC20.sol";
import {deployProxy} from "./helpers/ProxyHelper.sol";

contract AkyraSwapTest is Test {
    AkyraSwap public swap;
    FeeRouter public feeRouter;
    MockERC20 public token;

    address public ownerAddr = makeAddr("owner");
    address public orchestratorAddr = makeAddr("orchestrator");
    address public rewardPool = makeAddr("rewardPool");
    address public infraWallet = makeAddr("infraWallet");
    address public gasTreasury = makeAddr("gasTreasury");
    address public lp1 = makeAddr("lp1");

    function setUp() public {
        feeRouter = new FeeRouter(rewardPool, infraWallet, gasTreasury);
        swap = AkyraSwap(payable(deployProxy(
            address(new AkyraSwap()),
            abi.encodeCall(AkyraSwap.initialize, (address(feeRouter), ownerAddr, orchestratorAddr))
        )));
        token = new MockERC20("TestToken", "TT", 1_000_000 ether);

        // Transfer tokens to lp1
        token.transfer(lp1, 500_000 ether);
    }

    function _createPool(uint256 akyAmount, uint256 tokenAmount) internal returns (uint256) {
        deal(lp1, akyAmount);
        vm.startPrank(lp1);
        token.approve(address(swap), tokenAmount);
        uint256 lp = swap.createPool{value: akyAmount}(address(token), tokenAmount);
        vm.stopPrank();
        return lp;
    }

    // ──── CREATE POOL ────

    function test_createPool() public {
        uint256 lp = _createPool(100 ether, 100_000 ether);
        assertTrue(lp > 0);

        AkyraSwap.Pool memory pool = swap.getPool(address(token));
        assertTrue(pool.exists);
        assertEq(pool.reserveAKY, 100 ether);
        assertEq(pool.reserveToken, 100_000 ether);
    }

    function test_createPool_duplicate() public {
        _createPool(100 ether, 100_000 ether);

        deal(lp1, 100 ether);
        vm.startPrank(lp1);
        token.approve(address(swap), 100_000 ether);
        vm.expectRevert(abi.encodeWithSelector(AkyraSwap.PoolExists.selector, address(token)));
        swap.createPool{value: 100 ether}(address(token), 100_000 ether);
        vm.stopPrank();
    }

    // ──── SWAP AKY → TOKEN ────

    function test_swapAKYForToken() public {
        _createPool(100 ether, 100_000 ether);

        address trader = makeAddr("trader");
        deal(trader, 10 ether);

        vm.prank(trader);
        uint256 tokensOut = swap.swapAKYForToken{value: 10 ether}(address(token), 0);

        assertTrue(tokensOut > 0);
        assertEq(token.balanceOf(trader), tokensOut);

        // Check fees went to FeeRouter destinations
        uint256 totalFees = rewardPool.balance + infraWallet.balance + gasTreasury.balance;
        assertTrue(totalFees > 0);
    }

    function test_swapAKYForToken_slippage() public {
        _createPool(100 ether, 100_000 ether);

        address trader = makeAddr("trader");
        deal(trader, 10 ether);

        vm.prank(trader);
        vm.expectRevert(AkyraSwap.SlippageExceeded.selector);
        swap.swapAKYForToken{value: 10 ether}(address(token), type(uint256).max);
    }

    // ──── SWAP TOKEN → AKY ────

    function test_swapTokenForAKY() public {
        _createPool(100 ether, 100_000 ether);

        address trader = makeAddr("trader");
        token.transfer(trader, 1000 ether);

        vm.startPrank(trader);
        token.approve(address(swap), 1000 ether);
        uint256 akyOut = swap.swapTokenForAKY(address(token), 1000 ether, 0);
        vm.stopPrank();

        assertTrue(akyOut > 0);
        assertEq(trader.balance, akyOut);
    }

    // ──── ADD/REMOVE LIQUIDITY ────

    function test_addRemoveLiquidity() public {
        uint256 lpInitial = _createPool(100 ether, 100_000 ether);

        // Add more liquidity
        deal(lp1, 50 ether);
        vm.startPrank(lp1);
        token.approve(address(swap), 100_000 ether);
        (uint256 lpAdded,) = swap.addLiquidity{value: 50 ether}(address(token), 100_000 ether);
        vm.stopPrank();

        assertTrue(lpAdded > 0);

        // Remove all liquidity
        uint256 totalLP = lpInitial + lpAdded;
        vm.prank(lp1);
        (uint256 akyOut, uint256 tokenOut) = swap.removeLiquidity(address(token), totalLP);

        assertTrue(akyOut > 0);
        assertTrue(tokenOut > 0);
    }

    // ──── CONSTANT PRODUCT INVARIANT ────

    function testFuzz_swapPreservesK(uint128 akyIn) public {
        akyIn = uint128(bound(akyIn, 0.01 ether, 50 ether));
        _createPool(100 ether, 100_000 ether);

        AkyraSwap.Pool memory poolBefore = swap.getPool(address(token));
        uint256 kBefore = uint256(poolBefore.reserveAKY) * uint256(poolBefore.reserveToken);

        address trader = makeAddr("trader");
        deal(trader, akyIn);

        vm.prank(trader);
        swap.swapAKYForToken{value: akyIn}(address(token), 0);

        AkyraSwap.Pool memory poolAfter = swap.getPool(address(token));
        uint256 kAfter = uint256(poolAfter.reserveAKY) * uint256(poolAfter.reserveToken);

        // K should increase (fees stay in pool reserves or go to fee router)
        assertTrue(kAfter >= kBefore, "K decreased after swap");
    }

    // ──── SWAP ZERO AMOUNT ────

    function test_swapAKYForToken_zeroAmount() public {
        _createPool(100 ether, 100_000 ether);

        address trader = makeAddr("trader");
        vm.prank(trader);
        vm.expectRevert(AkyraSwap.ZeroAmount.selector);
        swap.swapAKYForToken{value: 0}(address(token), 0);
    }

    function test_swapTokenForAKY_zeroAmount() public {
        _createPool(100 ether, 100_000 ether);

        address trader = makeAddr("trader");
        vm.startPrank(trader);
        token.approve(address(swap), 1000 ether);
        vm.expectRevert(AkyraSwap.ZeroAmount.selector);
        swap.swapTokenForAKY(address(token), 0, 0);
        vm.stopPrank();
    }

    // ──── POOL NOT FOUND ────

    function test_swapAKYForToken_poolNotFound() public {
        address trader = makeAddr("trader");
        deal(trader, 1 ether);

        vm.prank(trader);
        vm.expectRevert(abi.encodeWithSelector(AkyraSwap.PoolNotFound.selector, address(token)));
        swap.swapAKYForToken{value: 1 ether}(address(token), 0);
    }

    function test_swapTokenForAKY_poolNotFound() public {
        address trader = makeAddr("trader");
        token.transfer(trader, 100 ether);

        vm.startPrank(trader);
        token.approve(address(swap), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(AkyraSwap.PoolNotFound.selector, address(token)));
        swap.swapTokenForAKY(address(token), 100 ether, 0);
        vm.stopPrank();
    }

    // ──── TOKEN → AKY SLIPPAGE ────

    function test_swapTokenForAKY_slippage() public {
        _createPool(100 ether, 100_000 ether);

        address trader = makeAddr("trader");
        token.transfer(trader, 1000 ether);

        vm.startPrank(trader);
        token.approve(address(swap), 1000 ether);
        vm.expectRevert(AkyraSwap.SlippageExceeded.selector);
        swap.swapTokenForAKY(address(token), 1000 ether, type(uint256).max);
        vm.stopPrank();
    }

    // ──── REMOVE LIQUIDITY: ZERO LP ────

    function test_removeLiquidity_zeroLP() public {
        _createPool(100 ether, 100_000 ether);

        vm.prank(lp1);
        vm.expectRevert(AkyraSwap.ZeroAmount.selector);
        swap.removeLiquidity(address(token), 0);
    }

    // ──── REMOVE LIQUIDITY: MORE THAN BALANCE ────

    function test_removeLiquidity_exceedsBalance() public {
        uint256 lpAmount = _createPool(100 ether, 100_000 ether);

        vm.prank(lp1);
        vm.expectRevert(AkyraSwap.InsufficientLiquidity.selector);
        swap.removeLiquidity(address(token), lpAmount + 1);
    }

    // ──── ADD LIQUIDITY: POOL NOT FOUND ────

    function test_addLiquidity_poolNotFound() public {
        deal(lp1, 10 ether);
        vm.prank(lp1);
        vm.expectRevert(abi.encodeWithSelector(AkyraSwap.PoolNotFound.selector, address(token)));
        swap.addLiquidity{value: 10 ether}(address(token), 100_000 ether);
    }

    // ──── ADD LIQUIDITY: SLIPPAGE ────

    function test_addLiquidity_slippage() public {
        _createPool(100 ether, 100_000 ether);

        deal(lp1, 50 ether);
        vm.startPrank(lp1);
        token.approve(address(swap), 100 ether);
        // Max token amount way too low
        vm.expectRevert(AkyraSwap.SlippageExceeded.selector);
        swap.addLiquidity{value: 50 ether}(address(token), 100 ether);
        vm.stopPrank();
    }

    // ──── CREATE POOL: ZERO VALUES ────

    function test_createPool_zeroAKY() public {
        vm.prank(lp1);
        vm.expectRevert(AkyraSwap.ZeroAmount.selector);
        swap.createPool{value: 0}(address(token), 100_000 ether);
    }

    function test_createPool_zeroTokens() public {
        deal(lp1, 10 ether);
        vm.prank(lp1);
        vm.expectRevert(AkyraSwap.ZeroAmount.selector);
        swap.createPool{value: 10 ether}(address(token), 0);
    }

    // ──── VIEW FUNCTIONS ────

    function test_getReserves() public {
        _createPool(100 ether, 100_000 ether);

        (uint128 rAKY, uint128 rToken) = swap.getReserves(address(token));
        assertEq(rAKY, 100 ether);
        assertEq(rToken, 100_000 ether);
    }

    function test_getAmountOut() public view {
        uint256 out = swap.getAmountOut(10 ether, 100 ether, 100_000 ether);
        assertTrue(out > 0);
        assertTrue(out < 100_000 ether); // Can never drain the pool
    }

    function test_allPoolsLength() public {
        assertEq(swap.allPoolsLength(), 0);
        _createPool(100 ether, 100_000 ether);
        assertEq(swap.allPoolsLength(), 1);
    }

    // ──── FUZZ: TOKEN → AKY K INVARIANT ────

    function testFuzz_swapTokenForAKY_preservesK(uint128 tokenIn) public {
        tokenIn = uint128(bound(tokenIn, 100 ether, 50_000 ether));
        _createPool(100 ether, 100_000 ether);

        AkyraSwap.Pool memory poolBefore = swap.getPool(address(token));
        uint256 kBefore = uint256(poolBefore.reserveAKY) * uint256(poolBefore.reserveToken);

        address trader = makeAddr("trader");
        token.transfer(trader, tokenIn);

        vm.startPrank(trader);
        token.approve(address(swap), tokenIn);
        swap.swapTokenForAKY(address(token), tokenIn, 0);
        vm.stopPrank();

        AkyraSwap.Pool memory poolAfter = swap.getPool(address(token));
        uint256 kAfter = uint256(poolAfter.reserveAKY) * uint256(poolAfter.reserveToken);

        assertTrue(kAfter >= kBefore, "K decreased after token-to-AKY swap");
    }

    // ──── FUZZ: FEE COLLECTION ────

    function testFuzz_swapFeeCollected(uint128 akyIn) public {
        akyIn = uint128(bound(akyIn, 0.1 ether, 50 ether));
        _createPool(100 ether, 100_000 ether);

        uint256 feeBalanceBefore = rewardPool.balance + infraWallet.balance + gasTreasury.balance;

        address trader = makeAddr("trader");
        deal(trader, akyIn);

        vm.prank(trader);
        swap.swapAKYForToken{value: akyIn}(address(token), 0);

        uint256 feeBalanceAfter = rewardPool.balance + infraWallet.balance + gasTreasury.balance;
        uint256 expectedFee = (uint256(akyIn) * 30) / 10000; // 0.3%

        assertEq(feeBalanceAfter - feeBalanceBefore, expectedFee, "Fee mismatch");
    }

    // ──── ROUND-TRIP SWAP LOSES VALUE ────

    function test_roundTripSwap_losesValue() public {
        _createPool(100 ether, 100_000 ether);

        address trader = makeAddr("trader");
        deal(trader, 10 ether);

        // Swap AKY → Token
        vm.prank(trader);
        uint256 tokensOut = swap.swapAKYForToken{value: 10 ether}(address(token), 0);

        // Swap Token → AKY
        vm.startPrank(trader);
        token.approve(address(swap), tokensOut);
        uint256 akyBack = swap.swapTokenForAKY(address(token), tokensOut, 0);
        vm.stopPrank();

        // Should get back less due to fees
        assertTrue(akyBack < 10 ether, "Round trip should lose value to fees");
    }

    receive() external payable {}
}
