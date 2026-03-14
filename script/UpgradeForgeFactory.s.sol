// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ForgeFactory} from "../src/ForgeFactory.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title UpgradeForgeFactory — UUPS upgrade to add token transfer/approve functions
/// @dev Run with: forge script script/UpgradeForgeFactory.s.sol --rpc-url $RPC --broadcast
contract UpgradeForgeFactory is Script {
    function run() external {
        address proxy = vm.envAddress("FORGE_FACTORY_PROXY");

        vm.startBroadcast();

        // Deploy new implementation
        ForgeFactory newImpl = new ForgeFactory();
        console.log("New ForgeFactory impl:", address(newImpl));

        // Upgrade proxy to new implementation
        UUPSUpgradeable(proxy).upgradeToAndCall(address(newImpl), "");
        console.log("ForgeFactory upgraded!");

        vm.stopBroadcast();
    }
}
