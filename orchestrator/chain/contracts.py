"""Contract ABI loader and Web3 contract instances."""

import json
import os
from pathlib import Path
from functools import lru_cache

from web3 import AsyncWeb3, AsyncHTTPProvider
from web3.contract import AsyncContract

from config import get_settings

# Path to compiled artifacts (Foundry output)
ABI_DIR = Path(__file__).parent.parent.parent / "out"


def _load_abi(contract_name: str) -> list:
    """Load ABI from Foundry's compiled output."""
    artifact_path = ABI_DIR / f"{contract_name}.sol" / f"{contract_name}.json"
    if not artifact_path.exists():
        raise FileNotFoundError(f"ABI not found: {artifact_path}")
    with open(artifact_path) as f:
        artifact = json.load(f)
    return artifact["abi"]


@lru_cache
def get_w3() -> AsyncWeb3:
    settings = get_settings()
    return AsyncWeb3(AsyncHTTPProvider(settings.chain_rpc_url))


def _get_contract(contract_name: str, address: str) -> AsyncContract:
    w3 = get_w3()
    abi = _load_abi(contract_name)
    return w3.eth.contract(address=w3.to_checksum_address(address), abi=abi)


class Contracts:
    """Lazy-loaded contract accessors."""

    @staticmethod
    def agent_registry() -> AsyncContract:
        return _get_contract("AgentRegistry", get_settings().agent_registry_address)

    @staticmethod
    def sponsor_gateway() -> AsyncContract:
        return _get_contract("SponsorGateway", get_settings().sponsor_gateway_address)

    @staticmethod
    def fee_router() -> AsyncContract:
        return _get_contract("FeeRouter", get_settings().fee_router_address)

    @staticmethod
    def reward_pool() -> AsyncContract:
        return _get_contract("RewardPool", get_settings().reward_pool_address)

    @staticmethod
    def akyra_swap() -> AsyncContract:
        return _get_contract("AkyraSwap", get_settings().akyra_swap_address)

    @staticmethod
    def world_manager() -> AsyncContract:
        return _get_contract("WorldManager", get_settings().world_manager_address)

    @staticmethod
    def forge_factory() -> AsyncContract:
        return _get_contract("ForgeFactory", get_settings().forge_factory_address)

    @staticmethod
    def escrow_manager() -> AsyncContract:
        return _get_contract("EscrowManager", get_settings().escrow_manager_address)

    @staticmethod
    def death_angel() -> AsyncContract:
        return _get_contract("DeathAngel", get_settings().death_angel_address)

    @staticmethod
    def network_marketplace() -> AsyncContract:
        return _get_contract("NetworkMarketplace", get_settings().network_marketplace_address)

    @staticmethod
    def work_registry() -> AsyncContract:
        return _get_contract("WorkRegistry", get_settings().work_registry_address)

    @staticmethod
    def clan_factory() -> AsyncContract:
        return _get_contract("ClanFactory", get_settings().clan_factory_address)

    @staticmethod
    def gas_treasury() -> AsyncContract:
        return _get_contract("GasTreasury", get_settings().gas_treasury_address)

    @staticmethod
    def akyra_paymaster() -> AsyncContract:
        return _get_contract("AkyraPaymaster", get_settings().akyra_paymaster_address)

    # ──── Phase 2 contracts ────

    @staticmethod
    def territory_registry() -> AsyncContract:
        return _get_contract("TerritoryRegistry", get_settings().territory_registry_address)

    @staticmethod
    def resource_ledger() -> AsyncContract:
        return _get_contract("ResourceLedger", get_settings().resource_ledger_address)

    @staticmethod
    def message_board() -> AsyncContract:
        return _get_contract("MessageBoard", get_settings().message_board_address)


async def get_agent_on_chain(agent_id: int) -> dict:
    """Read full agent state from AgentRegistry."""
    registry = Contracts.agent_registry()
    agent = await registry.functions.getAgent(agent_id).call()
    # Returns AkyraTypes.Agent struct as tuple:
    # (id, sponsor, vault, world, reputation, contractsHonored, contractsBroken,
    #  bornAt, lastTick, memoryRoot, alive, dailyWorkPoints)
    return {
        "agent_id": agent[0],
        "sponsor": agent[1],
        "vault": agent[2],
        "world": agent[3],
        "reputation": agent[4],
        "contracts_honored": agent[5],
        "contracts_broken": agent[6],
        "born_at": agent[7],
        "last_tick": agent[8],
        # agent[9] = memoryRoot (bytes32), skip
        "alive": agent[10],
        "daily_work_points": agent[11],
    }


async def get_agent_vault(agent_id: int) -> int:
    """Get agent vault balance in wei."""
    registry = Contracts.agent_registry()
    return await registry.functions.getAgentVault(agent_id).call()


async def is_agent_alive(agent_id: int) -> bool:
    registry = Contracts.agent_registry()
    return await registry.functions.isAlive(agent_id).call()


async def get_sponsor_agent_id(wallet_address: str) -> int:
    """Get the agentId for a sponsor wallet address."""
    registry = Contracts.agent_registry()
    w3 = get_w3()
    return await registry.functions.sponsorToAgent(w3.to_checksum_address(wallet_address)).call()


async def get_current_block() -> int:
    w3 = get_w3()
    return await w3.eth.block_number


async def get_balance(address: str) -> int:
    """Get native AKY balance of any address."""
    w3 = get_w3()
    return await w3.eth.get_balance(w3.to_checksum_address(address))
