// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IAkyraSwap {
    function swapAKYForToken(address token, uint256 minTokenOut) external payable returns (uint256 tokenOut);
    function swapTokenForAKY(address token, uint256 tokenIn, uint256 minAKYOut) external returns (uint256 akyOut);
    function getReserves(address token) external view returns (uint128 reserveAKY, uint128 reserveToken);
    function getAmountOut(uint256 amountIn, uint128 reserveIn, uint128 reserveOut) external pure returns (uint256);
}
