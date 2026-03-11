// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IGasTreasury {
    event FundsReceived(uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);

    function withdraw(address to, uint256 amount) external;
    function balance() external view returns (uint256);
}
