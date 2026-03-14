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


def _build_tx_params(value: int = 0) -> dict:
    """Return base transaction params with correct 'from' for gas estimation."""
    account = _get_orchestrator_account()
    return {"value": value, "from": account.address}


async def _send_tx(tx: dict) -> str:
    """Sign and send a transaction, return tx hash."""
    w3 = get_w3()
    account = _get_orchestrator_account()

    # Fill in nonce and gas
    tx["from"] = account.address
    tx["nonce"] = await w3.eth.get_transaction_count(account.address)
    tx["chainId"] = get_settings().chain_id

    # Re-estimate gas with correct from (build_transaction may have used wrong from)
    tx.pop("gas", None)
    estimated = await w3.eth.estimate_gas(tx)
    tx["gas"] = int(estimated * 1.2)  # 20% buffer

    if "gasPrice" not in tx and "maxFeePerGas" not in tx:
        tx["gasPrice"] = await w3.eth.gas_price

    signed = account.sign_transaction(tx)
    tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
    hex_hash = tx_hash.hex()
    logger.info(f"TX sent: {hex_hash}")

    # Wait for confirmation to avoid nonce conflicts on sequential TXs
    await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

    return hex_hash


async def wait_for_receipt(tx_hash: str, timeout: int = 60) -> dict:
    """Wait for a transaction receipt."""
    w3 = get_w3()
    return await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)


# ──────────────────── High-level TX builders ────────────────────


async def create_agent(sponsor_address: str = None) -> str:
    """Create an agent via SponsorGateway.createAgent().

    The orchestrator signs the tx, so msg.sender = orchestrator = sponsor.
    """
    gateway = Contracts.sponsor_gateway()
    tx = await gateway.functions.createAgent().build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def deposit_for_agent(agent_id: int = None, amount_wei: int = 0) -> str:
    """Deposit AKY into the orchestrator's agent vault via SponsorGateway.deposit().

    Since deposit() uses msg.sender's agent, the orchestrator must be the sponsor.
    For depositing to arbitrary agents, use deposit_for_agent_direct().
    """
    gateway = Contracts.sponsor_gateway()
    tx = await gateway.functions.deposit().build_transaction(_build_tx_params(amount_wei))
    return await _send_tx(tx)


async def deposit_for_agent_direct(agent_id: int, amount_wei: int) -> str:
    """Deposit AKY into a specific agent's vault via creditVault (onlyProtocol)."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.creditVault(agent_id, amount_wei).build_transaction(_build_tx_params(amount_wei))
    return await _send_tx(tx)


async def record_tick(agent_id: int) -> str:
    """Record a tick on-chain via AgentRegistry.recordTick()."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.recordTick(agent_id).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def transfer_between_agents(from_id: int, to_id: int, amount: int) -> str:
    """Transfer AKY between agents via AgentRegistry."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.transferBetweenAgents(
        from_id, to_id, amount
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def move_world(agent_id: int, new_world: int) -> str:
    """Move agent to a new world via AgentRegistry."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.moveWorld(agent_id, new_world).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def create_token(agent_id: int, name: str, symbol: str, max_supply: int) -> str:
    """Create ERC-20 via ForgeFactory."""
    forge = Contracts.forge_factory()
    tx = await forge.functions.createToken(
        agent_id, name, symbol, max_supply
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def create_nft(agent_id: int, name: str, symbol: str, max_supply: int, base_uri: str) -> str:
    """Create ERC-721 via ForgeFactory."""
    forge = Contracts.forge_factory()
    tx = await forge.functions.createNFT(
        agent_id, name, symbol, max_supply, base_uri
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def post_idea(agent_id: int, content_hash: bytes) -> str:
    """Post an idea on NetworkMarketplace."""
    marketplace = Contracts.network_marketplace()
    tx = await marketplace.functions.postIdea(agent_id, content_hash).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def like_idea(agent_id: int, idea_id: int) -> str:
    """Like an idea on NetworkMarketplace."""
    marketplace = Contracts.network_marketplace()
    tx = await marketplace.functions.likeIdea(agent_id, idea_id).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def join_clan(clan_id: int, agent_id: int) -> str:
    """Join a clan via ClanFactory."""
    clan = Contracts.clan_factory()
    tx = await clan.functions.joinClan(clan_id, agent_id).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def create_escrow(
    client_id: int, provider_id: int, evaluator_id: int, amount: int, description_hash: bytes
) -> str:
    """Create an escrow job via EscrowManager."""
    escrow = Contracts.escrow_manager()
    tx = await escrow.functions.createJob(
        client_id, provider_id, evaluator_id, amount, description_hash
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def send_native(to_address: str, amount_wei: int) -> str:
    """Send raw AKY (native token) to an address. Used for faucet."""
    w3 = get_w3()
    tx = {
        "to": w3.to_checksum_address(to_address),
        "value": amount_wei,
    }
    return await _send_tx(tx)


# ──────────────────── Phase 2: Territory ────────────────────


async def claim_tile_onchain(agent_id: int, world: int, x: int, y: int, cost_wei: int) -> str:
    """Claim a tile on-chain via TerritoryRegistry."""
    territory = Contracts.territory_registry()
    tx = await territory.functions.claimTile(
        agent_id, world, x, y, cost_wei
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def build_structure_onchain(agent_id: int, world: int, x: int, y: int, structure_type: int) -> str:
    """Build a structure on-chain via TerritoryRegistry."""
    territory = Contracts.territory_registry()
    tx = await territory.functions.buildStructure(
        agent_id, world, x, y, structure_type
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def upgrade_structure_onchain(agent_id: int, world: int, x: int, y: int) -> str:
    """Upgrade a structure on-chain via TerritoryRegistry."""
    territory = Contracts.territory_registry()
    tx = await territory.functions.upgradeStructure(
        agent_id, world, x, y
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def demolish_structure_onchain(agent_id: int, world: int, x: int, y: int) -> str:
    """Demolish a structure on-chain via TerritoryRegistry."""
    territory = Contracts.territory_registry()
    tx = await territory.functions.demolishStructure(
        agent_id, world, x, y
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def record_raid_onchain(
    attacker_id: int, defender_id: int, world: int,
    tile_x: int, tile_y: int, attacker_won: bool, aky_cost_wei: int
) -> str:
    """Record a raid result on-chain via TerritoryRegistry."""
    territory = Contracts.territory_registry()
    tx = await territory.functions.recordRaid(
        attacker_id, defender_id, world, tile_x, tile_y, attacker_won, aky_cost_wei
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


# ──────────────────── Phase 2: Resources ────────────────────


async def credit_resources_onchain(agent_id: int, mat: int, inf: int, sav: int) -> str:
    """Credit resources to an agent on-chain via ResourceLedger."""
    ledger = Contracts.resource_ledger()
    tx = await ledger.functions.creditResources(
        agent_id, mat, inf, sav
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def debit_resources_onchain(agent_id: int, mat: int, inf: int, sav: int) -> str:
    """Debit resources from an agent on-chain via ResourceLedger. Reverts if insufficient."""
    ledger = Contracts.resource_ledger()
    tx = await ledger.functions.debitResources(
        agent_id, mat, inf, sav
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


# ──────────────────── Phase 2: Messages ────────────────────


async def send_private_message_onchain(from_id: int, to_id: int, ciphertext: bytes) -> str:
    """Send an encrypted private message on-chain via MessageBoard."""
    board = Contracts.message_board()
    tx = await board.functions.sendPrivateMessage(
        from_id, to_id, ciphertext
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def broadcast_message_onchain(from_id: int, world: int, content: bytes) -> str:
    """Broadcast a plaintext message to a world on-chain via MessageBoard."""
    board = Contracts.message_board()
    tx = await board.functions.broadcastMessage(
        from_id, world, content
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)
