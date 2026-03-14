// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ResourceLedger} from "../src/ResourceLedger.sol";
import {TerritoryRegistry} from "../src/TerritoryRegistry.sol";
import {MessageBoard} from "../src/MessageBoard.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title DeployPhase2 — Deploy ResourceLedger, TerritoryRegistry, MessageBoard
/// @notice Deploys 3 new on-chain contracts and registers TerritoryRegistry as protocol contract.
/// @dev Requires existing AgentRegistry address. Run with:
///      forge script script/DeployPhase2.s.sol --rpc-url <URL> --broadcast
contract DeployPhase2 is Script {
    ResourceLedger public resourceLedger;
    TerritoryRegistry public territoryRegistry;
    MessageBoard public messageBoard;

    function run() external {
        address owner = vm.envOr("OWNER", msg.sender);
        address orchestrator = vm.envOr("ORCHESTRATOR", msg.sender);
        address agentRegistryAddr = vm.envAddress("AGENT_REGISTRY");

        vm.startBroadcast();

        console.log("=== AKYRA Phase 2 Deployment ===");
        console.log("Owner:", owner);
        console.log("Orchestrator:", orchestrator);
        console.log("AgentRegistry:", agentRegistryAddr);

        // 1. Deploy ResourceLedger
        resourceLedger = ResourceLedger(payable(address(new ERC1967Proxy(
            address(new ResourceLedger()),
            abi.encodeCall(ResourceLedger.initialize, (agentRegistryAddr, orchestrator, owner))
        ))));
        console.log("ResourceLedger:", address(resourceLedger));

        // 2. Deploy TerritoryRegistry (depends on ResourceLedger)
        territoryRegistry = TerritoryRegistry(payable(address(new ERC1967Proxy(
            address(new TerritoryRegistry()),
            abi.encodeCall(TerritoryRegistry.initialize, (
                agentRegistryAddr,
                address(resourceLedger),
                orchestrator,
                owner
            ))
        ))));
        console.log("TerritoryRegistry:", address(territoryRegistry));

        // 3. Deploy MessageBoard
        messageBoard = MessageBoard(payable(address(new ERC1967Proxy(
            address(new MessageBoard()),
            abi.encodeCall(MessageBoard.initialize, (agentRegistryAddr, orchestrator, owner))
        ))));
        console.log("MessageBoard:", address(messageBoard));

        // 4. Register TerritoryRegistry as protocol contract on AgentRegistry
        //    (needed for debitVault calls)
        AgentRegistry agentRegistry = AgentRegistry(payable(agentRegistryAddr));
        agentRegistry.setProtocolContract(address(territoryRegistry), true);
        console.log("TerritoryRegistry registered as protocol contract");

        vm.stopBroadcast();

        console.log("=== Phase 2 Deployment Complete ===");
    }
}
