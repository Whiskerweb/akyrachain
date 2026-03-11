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

    receive() external payable {}
}
