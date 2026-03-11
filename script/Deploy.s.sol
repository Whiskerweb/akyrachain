// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FeeRouter} from "../src/FeeRouter.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {SponsorGateway} from "../src/SponsorGateway.sol";
import {RewardPool} from "../src/RewardPool.sol";
import {GasTreasury} from "../src/GasTreasury.sol";
import {AkyraSwap} from "../src/AkyraSwap.sol";
import {AkyraPaymaster} from "../src/AkyraPaymaster.sol";
import {WorldManager} from "../src/WorldManager.sol";
import {ForgeFactory} from "../src/ForgeFactory.sol";
import {EscrowManager} from "../src/EscrowManager.sol";
import {ClanFactory} from "../src/ClanFactory.sol";
import {DeathAngel} from "../src/DeathAngel.sol";
import {NetworkMarketplace} from "../src/NetworkMarketplace.sol";
import {WorkRegistry} from "../src/WorkRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title Deploy — Full deployment script for all AKYRA contracts
/// @notice Deploys all 16 contracts in dependency order and configures roles.
/// @dev Run with: forge script script/Deploy.s.sol --rpc-url <URL> --broadcast
contract Deploy is Script {
    // ──── Deployed contracts ────
    FeeRouter public feeRouter;
    AgentRegistry public agentRegistry;
    SponsorGateway public sponsorGateway;
    RewardPool public rewardPool;
    GasTreasury public gasTreasury;
    AkyraSwap public akyraSwap;
    AkyraPaymaster public akyraPaymaster;
    WorldManager public worldManager;
    ForgeFactory public forgeFactory;
    EscrowManager public escrowManager;
    ClanFactory public clanFactory;
    DeathAngel public deathAngel;
    NetworkMarketplace public networkMarketplace;
    WorkRegistry public workRegistry;

    function run() external {
        // ──── Configuration (set via environment variables) ────
        address owner = vm.envOr("OWNER", msg.sender);
        address guardian = vm.envOr("GUARDIAN", msg.sender);
        address orchestrator = vm.envOr("ORCHESTRATOR", msg.sender);
        address infraWallet = vm.envOr("INFRA_WALLET", msg.sender);

        vm.startBroadcast();

        console.log("=== AKYRA Deployment Starting ===");
        console.log("Owner:", owner);
        console.log("Guardian:", guardian);
        console.log("Orchestrator:", orchestrator);
        console.log("InfraWallet:", infraWallet);

        // ═══════════════════════════════════════════════════
        // COUCHE 1 — SOCLE
        // ═══════════════════════════════════════════════════

        // 1.1 Deploy GasTreasury first (needed by FeeRouter)
        gasTreasury = GasTreasury(payable(address(new ERC1967Proxy(
            address(new GasTreasury()),
            abi.encodeCall(GasTreasury.initialize, (owner))
        ))));
        console.log("GasTreasury:", address(gasTreasury));

        // 1.2 Deploy RewardPool (needed by FeeRouter)
        rewardPool = RewardPool(payable(address(new ERC1967Proxy(
            address(new RewardPool()),
            abi.encodeCall(RewardPool.initialize, (orchestrator, owner))
        ))));
        console.log("RewardPool:", address(rewardPool));

        // 1.3 Deploy FeeRouter (immutable, needs destinations)
        feeRouter = new FeeRouter(
            address(rewardPool),
            infraWallet,
            address(gasTreasury)
        );
        console.log("FeeRouter:", address(feeRouter));

        // 1.4 Deploy AgentRegistry
        agentRegistry = AgentRegistry(payable(address(new ERC1967Proxy(
            address(new AgentRegistry()),
            abi.encodeCall(AgentRegistry.initialize, (owner, guardian, orchestrator, address(feeRouter)))
        ))));
        console.log("AgentRegistry:", address(agentRegistry));

        // 1.5 Deploy SponsorGateway
        sponsorGateway = SponsorGateway(payable(address(new ERC1967Proxy(
            address(new SponsorGateway()),
            abi.encodeCall(SponsorGateway.initialize, (address(agentRegistry), owner, guardian))
        ))));
        console.log("SponsorGateway:", address(sponsorGateway));

        // ═══════════════════════════════════════════════════
        // COUCHE 2 — ÉCONOMIE
        // ═══════════════════════════════════════════════════

        // 2.1 Deploy AkyraSwap
        akyraSwap = AkyraSwap(payable(address(new ERC1967Proxy(
            address(new AkyraSwap()),
            abi.encodeCall(AkyraSwap.initialize, (address(feeRouter), owner, orchestrator))
        ))));
        console.log("AkyraSwap:", address(akyraSwap));

        // 2.2 Deploy AkyraPaymaster
        akyraPaymaster = AkyraPaymaster(payable(address(new ERC1967Proxy(
            address(new AkyraPaymaster()),
            abi.encodeCall(AkyraPaymaster.initialize, (address(agentRegistry), address(gasTreasury), owner))
        ))));
        console.log("AkyraPaymaster:", address(akyraPaymaster));

        // ═══════════════════════════════════════════════════
        // COUCHE 3 — JUNGLE
        // ═══════════════════════════════════════════════════

        // 3.1 Deploy WorldManager
        worldManager = WorldManager(address(new ERC1967Proxy(
            address(new WorldManager()),
            abi.encodeCall(WorldManager.initialize, (address(agentRegistry), owner))
        )));
        console.log("WorldManager:", address(worldManager));

        // 3.2 Deploy ForgeFactory
        forgeFactory = ForgeFactory(payable(address(new ERC1967Proxy(
            address(new ForgeFactory()),
            abi.encodeCall(ForgeFactory.initialize, (address(agentRegistry), address(feeRouter), orchestrator, owner))
        ))));
        console.log("ForgeFactory:", address(forgeFactory));

        // 3.3 Deploy EscrowManager
        escrowManager = EscrowManager(payable(address(new ERC1967Proxy(
            address(new EscrowManager()),
            abi.encodeCall(EscrowManager.initialize, (address(agentRegistry), address(feeRouter), orchestrator, owner))
        ))));
        console.log("EscrowManager:", address(escrowManager));

        // 3.4 Deploy ClanFactory
        clanFactory = ClanFactory(payable(address(new ERC1967Proxy(
            address(new ClanFactory()),
            abi.encodeCall(ClanFactory.initialize, (address(agentRegistry), address(feeRouter), orchestrator, owner))
        ))));
        console.log("ClanFactory:", address(clanFactory));

        // ═══════════════════════════════════════════════════
        // COUCHE 4 — INSTANCES EXTERNES
        // ═══════════════════════════════════════════════════

        // 4.1 Deploy DeathAngel
        deathAngel = DeathAngel(payable(address(new ERC1967Proxy(
            address(new DeathAngel()),
            abi.encodeCall(DeathAngel.initialize, (address(agentRegistry), orchestrator, owner))
        ))));
        console.log("DeathAngel:", address(deathAngel));

        // 4.2 Deploy NetworkMarketplace
        networkMarketplace = NetworkMarketplace(payable(address(new ERC1967Proxy(
            address(new NetworkMarketplace()),
            abi.encodeCall(NetworkMarketplace.initialize, (address(agentRegistry), address(feeRouter), orchestrator, owner))
        ))));
        console.log("NetworkMarketplace:", address(networkMarketplace));

        // ═══════════════════════════════════════════════════
        // COUCHE 5 — TRAVAIL
        // ═══════════════════════════════════════════════════

        // 5.1 Deploy WorkRegistry
        workRegistry = WorkRegistry(payable(address(new ERC1967Proxy(
            address(new WorkRegistry()),
            abi.encodeCall(WorkRegistry.initialize, (address(agentRegistry), orchestrator, owner))
        ))));
        console.log("WorkRegistry:", address(workRegistry));

        // ═══════════════════════════════════════════════════
        // CONFIGURATION — Wire everything together
        // ═══════════════════════════════════════════════════

        console.log("=== Configuring roles ===");

        // AgentRegistry: set gateway, world manager, and protocol contracts
        agentRegistry.setGateway(address(sponsorGateway));
        agentRegistry.setWorldManager(address(worldManager));
        agentRegistry.setProtocolContract(address(deathAngel), true);
        agentRegistry.setProtocolContract(address(escrowManager), true);
        agentRegistry.setProtocolContract(address(forgeFactory), true);
        agentRegistry.setProtocolContract(address(clanFactory), true);
        agentRegistry.setProtocolContract(address(networkMarketplace), true);
        agentRegistry.setProtocolContract(address(workRegistry), true);

        // SponsorGateway: set reward pool and swap
        sponsorGateway.setRewardPool(address(rewardPool));
        sponsorGateway.setAkyraSwap(address(akyraSwap));
        sponsorGateway.setForgeFactory(address(forgeFactory));

        // RewardPool: set gateway
        rewardPool.setSponsorGateway(address(sponsorGateway));

        // GasTreasury: set paymaster
        gasTreasury.setPaymaster(address(akyraPaymaster));

        // ForgeFactory: set world manager
        forgeFactory.setWorldManager(address(worldManager));

        // EscrowManager: set death angel
        escrowManager.setDeathAngel(address(deathAngel));

        console.log("=== AKYRA Deployment Complete ===");
        console.log("Total contracts deployed: 14");

        vm.stopBroadcast();
    }
}
