"""Transaction manager — builds, signs, and sends transactions on-chain."""

import logging

from eth_account import Account
from web3 import AsyncWeb3

from config import get_settings
from chain.contracts import get_w3, Contracts

logger = logging.getLogger(__name__)


def _get_orchestrator_account() -> Account:
    settings = get_settings()
    return Account.from_key(settings.orchestrator_private_key)


async def _send_tx(tx: dict) -> str:
    """Sign and send a transaction, return tx hash."""
    w3 = get_w3()
    account = _get_orchestrator_account()

    # Fill in nonce and gas
    tx["from"] = account.address
    tx["nonce"] = await w3.eth.get_transaction_count(account.address)
    tx["chainId"] = get_settings().chain_id

    if "gas" not in tx:
        estimated = await w3.eth.estimate_gas(tx)
        tx["gas"] = int(estimated * 1.2)  # 20% buffer

    if "gasPrice" not in tx and "maxFeePerGas" not in tx:
        tx["gasPrice"] = await w3.eth.gas_price

    signed = account.sign_transaction(tx)
    tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
    hex_hash = tx_hash.hex()
    logger.info(f"TX sent: {hex_hash}")
    return hex_hash


async def wait_for_receipt(tx_hash: str, timeout: int = 60) -> dict:
    """Wait for a transaction receipt."""
    w3 = get_w3()
    return await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)


# ──────────────────── High-level TX builders ────────────────────


async def create_agent(sponsor_address: str) -> str:
    """Call SponsorGateway.createAgent() — orchestrator signs as the gateway caller.
    Actually, createAgent is called BY the sponsor through the gateway.
    The orchestrator calls AgentRegistry.createAgent(sponsor) directly since it's the gateway.
    """
    registry = Contracts.agent_registry()
    w3 = get_w3()
    tx = await registry.functions.createAgent(
        w3.to_checksum_address(sponsor_address)
    ).build_transaction({"value": 0})
    return await _send_tx(tx)


async def deposit_for_agent(agent_id: int, amount_wei: int) -> str:
    """Deposit AKY into an agent's vault via AgentRegistry."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.deposit(agent_id).build_transaction({"value": amount_wei})
    return await _send_tx(tx)


async def record_tick(agent_id: int) -> str:
    """Record a tick on-chain via AgentRegistry.recordTick()."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.recordTick(agent_id).build_transaction({"value": 0})
    return await _send_tx(tx)


async def transfer_between_agents(from_id: int, to_id: int, amount: int) -> str:
    """Transfer AKY between agents via AgentRegistry."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.transferBetweenAgents(
        from_id, to_id, amount
    ).build_transaction({"value": 0})
    return await _send_tx(tx)


async def move_world(agent_id: int, new_world: int) -> str:
    """Move agent to a new world via AgentRegistry."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.moveWorld(agent_id, new_world).build_transaction({"value": 0})
    return await _send_tx(tx)


async def create_token(agent_id: int, name: str, symbol: str, max_supply: int) -> str:
    """Create ERC-20 via ForgeFactory."""
    forge = Contracts.forge_factory()
    tx = await forge.functions.createToken(
        agent_id, name, symbol, max_supply
    ).build_transaction({"value": 0})
    return await _send_tx(tx)


async def create_nft(agent_id: int, name: str, symbol: str, max_supply: int, base_uri: str) -> str:
    """Create ERC-721 via ForgeFactory."""
    forge = Contracts.forge_factory()
    tx = await forge.functions.createNFT(
        agent_id, name, symbol, max_supply, base_uri
    ).build_transaction({"value": 0})
    return await _send_tx(tx)


async def post_idea(agent_id: int, content_hash: bytes) -> str:
    """Post an idea on NetworkMarketplace."""
    marketplace = Contracts.network_marketplace()
    tx = await marketplace.functions.postIdea(agent_id, content_hash).build_transaction({"value": 0})
    return await _send_tx(tx)


async def like_idea(agent_id: int, idea_id: int) -> str:
    """Like an idea on NetworkMarketplace."""
    marketplace = Contracts.network_marketplace()
    tx = await marketplace.functions.likeIdea(agent_id, idea_id).build_transaction({"value": 0})
    return await _send_tx(tx)


async def join_clan(clan_id: int, agent_id: int) -> str:
    """Join a clan via ClanFactory."""
    clan = Contracts.clan_factory()
    tx = await clan.functions.joinClan(clan_id, agent_id).build_transaction({"value": 0})
    return await _send_tx(tx)


async def create_escrow(
    client_id: int, provider_id: int, evaluator_id: int, amount: int, description_hash: bytes
) -> str:
    """Create an escrow job via EscrowManager."""
    escrow = Contracts.escrow_manager()
    tx = await escrow.functions.createJob(
        client_id, provider_id, evaluator_id, amount, description_hash
    ).build_transaction({"value": 0})
    return await _send_tx(tx)


async def send_native(to_address: str, amount_wei: int) -> str:
    """Send raw AKY (native token) to an address. Used for faucet."""
    w3 = get_w3()
    tx = {
        "to": w3.to_checksum_address(to_address),
        "value": amount_wei,
    }
    return await _send_tx(tx)
