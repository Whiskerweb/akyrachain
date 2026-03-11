// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @dev Helper to deploy a UUPS proxy in tests.
///      Usage: address proxy = deployProxy(address(impl), initData);
function deployProxy(address implementation, bytes memory initData) returns (address) {
    ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
    return address(proxy);
}
