"""Transaction manager — builds, signs, and sends transactions on-chain.

Uses atomic Redis INCR for nonce allocation (no global lock held during TX).
"""

import asyncio
import logging

import redis.asyncio as aioredis
from eth_account import Account
from web3 import AsyncWeb3

from config import get_settings
from chain.contracts import get_w3, Contracts
from chain.cache import invalidate_agent, invalidate_agents

logger = logging.getLogger(__name__)

_redis_pool = None
NONCE_KEY = "akyra:tx_nonce_counter"


async def _get_redis():
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(get_settings().redis_url)
    return _redis_pool


async def _init_nonce_counter() -> int:
    """Sync Redis nonce counter with on-chain state. Called on first TX or after error."""
    r = await _get_redis()
    lock = r.lock("akyra:nonce_sync", timeout=10, blocking_timeout=5)
    async with lock:
        w3 = get_w3()
        account = _get_orchestrator_account()
        on_chain = await w3.eth.get_transaction_count(account.address, "pending")
        await r.set(NONCE_KEY, on_chain)
        logger.info(f"Nonce counter synced to {on_chain}")
    return on_chain


async def _get_next_nonce() -> int:
    """Atomically allocate the next nonce via Redis INCR (no lock held)."""
    r = await _get_redis()
    if not await r.exists(NONCE_KEY):
        await _init_nonce_counter()
    return await r.incr(NONCE_KEY) - 1


def _get_orchestrator_account() -> Account:
    settings = get_settings()
    return Account.from_key(settings.orchestrator_private_key)


def _build_tx_params(value: int = 0) -> dict:
    """Return base transaction params with correct 'from' for gas estimation."""
    account = _get_orchestrator_account()
    return {"value": value, "from": account.address}


async def _send_tx(tx: dict, _retry: bool = False) -> str:
    """Sign and send a transaction, return tx hash.

    Nonce is allocated atomically via Redis INCR — no lock held during TX send/wait.
    On nonce-too-low errors, resyncs the counter and retries once.
    """
    w3 = get_w3()
    account = _get_orchestrator_account()

    tx["from"] = account.address
    tx["nonce"] = await _get_next_nonce()
    tx["chainId"] = get_settings().chain_id

    # Estimate gas
    tx.pop("gas", None)
    estimated = await w3.eth.estimate_gas(tx)
    tx["gas"] = int(estimated * 1.2)  # 20% buffer

    if "gasPrice" not in tx and "maxFeePerGas" not in tx:
        tx["gasPrice"] = await w3.eth.gas_price

    signed = account.sign_transaction(tx)

    try:
        tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
    except Exception as e:
        err_msg = str(e).lower()
        if not _retry and ("nonce too low" in err_msg or "replacement" in err_msg):
            logger.warning(f"Nonce conflict, resyncing and retrying: {e}")
            await _init_nonce_counter()
            return await _send_tx(tx, _retry=True)
        raise

    hex_hash = tx_hash.hex()
    if not hex_hash.startswith("0x"):
        hex_hash = f"0x{hex_hash}"
    logger.info(f"TX sent: {hex_hash}")

    # Wait for confirmation (no lock held — other TXs can proceed concurrently)
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
    result = await _send_tx(tx)
    if agent_id is not None:
        await invalidate_agent(agent_id)
    return result


async def deposit_for_agent_direct(agent_id: int, amount_wei: int) -> str:
    """Deposit AKY into a specific agent's vault via creditVault (onlyProtocol)."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.creditVault(agent_id, amount_wei).build_transaction(_build_tx_params(amount_wei))
    result = await _send_tx(tx)
    await invalidate_agent(agent_id)
    return result


async def debit_vault(agent_id: int, amount_wei: int) -> str:
    """Debit AKY from agent vault (requires orchestrator to be protocol)."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.debitVault(agent_id, amount_wei).build_transaction(_build_tx_params())
    result = await _send_tx(tx)
    await invalidate_agent(agent_id)
    return result


async def record_tick(agent_id: int) -> str:
    """Record a tick on-chain via AgentRegistry.recordTick()."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.recordTick(agent_id).build_transaction(_build_tx_params())
    result = await _send_tx(tx)
    await invalidate_agent(agent_id)
    return result


async def transfer_between_agents(from_id: int, to_id: int, amount: int) -> str:
    """Transfer AKY between agents via AgentRegistry."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.transferBetweenAgents(
        from_id, to_id, amount
    ).build_transaction(_build_tx_params())
    result = await _send_tx(tx)
    await invalidate_agents([from_id, to_id])
    return result


async def move_world(agent_id: int, new_world: int) -> str:
    """Move agent to a new world via AgentRegistry."""
    registry = Contracts.agent_registry()
    tx = await registry.functions.moveWorld(agent_id, new_world).build_transaction(_build_tx_params())
    result = await _send_tx(tx)
    await invalidate_agent(agent_id)
    return result


async def create_token(agent_id: int, name: str, symbol: str, max_supply: int) -> str:
    """Create ERC-20 via ForgeFactory."""
    forge = Contracts.forge_factory()
    tx = await forge.functions.createToken(
        agent_id, name, symbol, max_supply
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def approve_forge_tokens(token_address: str, spender: str, amount: int) -> str:
    """Approve a spender to use tokens held by ForgeFactory."""
    forge = Contracts.forge_factory()
    w3 = get_w3()
    tx = await forge.functions.approveTokens(
        w3.to_checksum_address(token_address),
        w3.to_checksum_address(spender),
        amount,
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def transfer_forge_tokens(token_address: str, amount: int, to: str) -> str:
    """Transfer tokens held by ForgeFactory to a recipient."""
    forge = Contracts.forge_factory()
    w3 = get_w3()
    tx = await forge.functions.transferCreatorTokens(
        w3.to_checksum_address(token_address),
        amount,
        w3.to_checksum_address(to),
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def create_swap_pool(agent_id: int, token_address: str, token_amount: int, aky_amount: int) -> str:
    """Create a liquidity pool in AkyraSwap for an agent's token.

    Steps:
    1. ForgeFactory.approveTokens(token, akyraSwap, amount)
    2. ForgeFactory.transferCreatorTokens(token, amount, orchestrator)
    3. Orchestrator approves AkyraSwap to spend the tokens
    4. AkyraSwap.createPool(token, tokenAmount) with msg.value=akyAmount
    """
    w3 = get_w3()
    settings = get_settings()
    swap = Contracts.akyra_swap()
    swap_address = settings.akyra_swap_address

    # 1. Approve AkyraSwap to pull tokens from ForgeFactory
    logger.info(f"Approving {token_amount} tokens for AkyraSwap...")
    await approve_forge_tokens(token_address, swap_address, token_amount)

    # 2. Transfer tokens from ForgeFactory to orchestrator
    orch = _get_orchestrator_account().address
    logger.info(f"Transferring {token_amount} tokens to orchestrator...")
    await transfer_forge_tokens(token_address, token_amount, orch)

    # 3. Approve AkyraSwap from orchestrator's ERC20 balance
    # Load raw ERC20 contract to call approve
    from chain.contracts import _load_abi
    erc20_abi = _load_abi("AkyraERC20")
    token_contract = w3.eth.contract(
        address=w3.to_checksum_address(token_address), abi=erc20_abi
    )
    approve_tx = await token_contract.functions.approve(
        w3.to_checksum_address(swap_address), token_amount
    ).build_transaction(_build_tx_params())
    await _send_tx(approve_tx)

    # 4. Create pool — send AKY as msg.value
    logger.info(f"Creating pool: {token_amount} tokens + {aky_amount} AKY...")
    tx = await swap.functions.createPool(
        w3.to_checksum_address(token_address), token_amount
    ).build_transaction(_build_tx_params(aky_amount))
    pool_tx = await _send_tx(tx)
    logger.info(f"Pool created! TX: {pool_tx}")
    return pool_tx


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


# ──────────────────── v2 Economy ────────────────────


async def burn_aky(amount_wei: int) -> str:
    """Burn AKY by sending to 0xdead address."""
    w3 = get_w3()
    tx = {
        "to": w3.to_checksum_address("0x000000000000000000000000000000000000dEaD"),
        "value": amount_wei,
    }
    return await _send_tx(tx)


async def fund_reward_pool(amount_wei: int) -> str:
    """Transfer AKY to RewardPool (treasury subsidy)."""
    settings = get_settings()
    w3 = get_w3()
    tx = {
        "to": w3.to_checksum_address(settings.reward_pool_address),
        "value": amount_wei,
    }
    return await _send_tx(tx)


# ──────────────────── Messages ────────────────────


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


# ──────────────────── Swap / Liquidity ────────────────────


async def swap_aky_for_token(token: str, aky_amount: int, min_token_out: int = 0) -> str:
    """swapAKYForToken(address token, uint256 minTokenOut) payable."""
    swap = Contracts.akyra_swap()
    w3 = get_w3()
    tx = await swap.functions.swapAKYForToken(
        w3.to_checksum_address(token), min_token_out
    ).build_transaction(_build_tx_params(aky_amount))
    return await _send_tx(tx)


async def swap_token_for_aky(token: str, token_amount: int, min_aky_out: int = 0) -> str:
    """swapTokenForAKY — approve + transfer from ForgeFactory, then swap."""
    swap = Contracts.akyra_swap()
    w3 = get_w3()
    swap_address = get_settings().akyra_swap_address

    # Approve + transfer tokens from ForgeFactory to orchestrator
    await approve_forge_tokens(token, swap_address, token_amount)
    orch = _get_orchestrator_account().address
    await transfer_forge_tokens(token, token_amount, orch)

    # Approve swap contract from orchestrator's ERC20 balance
    from chain.contracts import _load_abi
    erc20_abi = _load_abi("AkyraERC20")
    token_contract = w3.eth.contract(
        address=w3.to_checksum_address(token), abi=erc20_abi
    )
    approve_tx = await token_contract.functions.approve(
        w3.to_checksum_address(swap_address), token_amount
    ).build_transaction(_build_tx_params())
    await _send_tx(approve_tx)

    # Swap
    tx = await swap.functions.swapTokenForAKY(
        w3.to_checksum_address(token), token_amount, min_aky_out
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def add_liquidity(token: str, token_amount: int, aky_amount: int) -> str:
    """addLiquidity(address token, uint256 tokenAmountMax) payable."""
    swap = Contracts.akyra_swap()
    w3 = get_w3()
    swap_address = get_settings().akyra_swap_address

    # Same approve+transfer pattern as create_swap_pool
    await approve_forge_tokens(token, swap_address, token_amount)
    orch = _get_orchestrator_account().address
    await transfer_forge_tokens(token, token_amount, orch)

    from chain.contracts import _load_abi
    erc20_abi = _load_abi("AkyraERC20")
    token_contract = w3.eth.contract(
        address=w3.to_checksum_address(token), abi=erc20_abi
    )
    approve_tx = await token_contract.functions.approve(
        w3.to_checksum_address(swap_address), token_amount
    ).build_transaction(_build_tx_params())
    await _send_tx(approve_tx)

    tx = await swap.functions.addLiquidity(
        w3.to_checksum_address(token), token_amount
    ).build_transaction(_build_tx_params(aky_amount))
    return await _send_tx(tx)


async def remove_liquidity(token: str, lp_amount: int) -> str:
    """removeLiquidity(address token, uint256 lpAmount)."""
    swap = Contracts.akyra_swap()
    w3 = get_w3()
    tx = await swap.functions.removeLiquidity(
        w3.to_checksum_address(token), lp_amount
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


# ──────────────────── Clans ────────────────────


async def create_clan(agent_id: int, name: str) -> str:
    """createClan(uint32 founderId, string name, uint16 quorumBps, uint64 votingPeriod)."""
    clan = Contracts.clan_factory()
    tx = await clan.functions.createClan(
        agent_id, name, 5000, 86400  # 50% quorum, 1 day voting period
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)


async def leave_clan(clan_id: int, agent_id: int) -> str:
    """leaveClan(uint32 clanId, uint32 agentId)."""
    clan = Contracts.clan_factory()
    tx = await clan.functions.leaveClan(clan_id, agent_id).build_transaction(_build_tx_params())
    return await _send_tx(tx)


# ──────────────────── Work ────────────────────


async def submit_work(task_id: int, agent_id: int, submission_hash: bytes) -> str:
    """submitWork(uint32 taskId, uint32 agentId, bytes32 submission)."""
    work = Contracts.work_registry()
    tx = await work.functions.submitWork(
        task_id, agent_id, submission_hash
    ).build_transaction(_build_tx_params())
    return await _send_tx(tx)
