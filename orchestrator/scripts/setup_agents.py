"""Setup script — Create 4 new agents with different wealth levels for social experiment.

Strategy:
1. Temporarily set orchestrator as the gateway on AgentRegistry
2. Create agents via AgentRegistry.createAgent(sponsor) — using unique sponsor addresses
3. Deposit AKY via AgentRegistry.deposit(agentId)
4. Restore SponsorGateway as the gateway

Usage: cd orchestrator && python3 scripts/setup_agents.py
"""

import asyncio
import sys
import os

# Add orchestrator to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from security.api_key_manager import encrypt_api_key
from config import get_settings


# ──── Agent definitions ────
# Wealth experiment: does starting capital affect social behavior?

AGENTS = [
    {
        "agent_id": 2,
        "email": "agent2@akyra.local",
        "password": "agent2-akyra-2026",
        "api_key": "sk-WgNtmeKVjviqQILgwNTOGJhuH6teageJ7lXhmGN6pHnU3Pwc",
        "provider": "kimi",
        "model": "kimi-k2-0711-preview",
        "daily_budget_usd": 3.0,
        "deposit_aky": 10000,  # Rich — 10,000 AKY
        "label": "RICHE",
        "sponsor": "0x0000000000000000000000000000000000000002",
    },
    {
        "agent_id": 3,
        "email": "agent3@akyra.local",
        "password": "agent3-akyra-2026",
        "api_key": "sk-7HAAaTAWK4ZwTFjfs8KtPSMhD9dLehsDqs9hhqXf3THiv1yA",
        "provider": "kimi",
        "model": "kimi-k2-0711-preview",
        "daily_budget_usd": 3.0,
        "deposit_aky": 500,  # Moyen — 500 AKY
        "label": "MOYEN",
        "sponsor": "0x0000000000000000000000000000000000000003",
    },
    {
        "agent_id": 4,
        "email": "agent4@akyra.local",
        "password": "agent4-akyra-2026",
        "api_key": "sk-qb3PJZKlU66hevu0g39hMwVWwWqTlVvYwcYXOnCACUQF9uNr",
        "provider": "kimi",
        "model": "kimi-k2-0711-preview",
        "daily_budget_usd": 3.0,
        "deposit_aky": 100,  # Pauvre — 100 AKY
        "label": "PAUVRE",
        "sponsor": "0x0000000000000000000000000000000000000004",
    },
    {
        "agent_id": 5,
        "email": "agent5@akyra.local",
        "password": "agent5-akyra-2026",
        "api_key": "sk-WaIpdVGhjQd0FBGxmiC1W6TqTLpPVCTr4D8P50Y9AVZRPJrW",
        "provider": "kimi",
        "model": "kimi-k2-0711-preview",
        "daily_budget_usd": 3.0,
        "deposit_aky": 2000,  # Aise — 2,000 AKY
        "label": "AISE",
        "sponsor": "0x0000000000000000000000000000000000000005",
    },
]

AKY = 10**18  # 1 AKY in wei


async def main():
    from models.base import get_session_factory
    from models.user import User
    from models.agent_config import AgentConfig
    from chain import tx_manager
    from chain.contracts import get_w3, Contracts
    from eth_account import Account
    from passlib.context import CryptContext
    from sqlalchemy import select

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    w3 = get_w3()
    session_factory = get_session_factory()

    orchestrator_account = tx_manager._get_orchestrator_account()
    orch_address = orchestrator_account.address
    print(f"Orchestrator: {orch_address}")

    # Check chain
    try:
        block = await w3.eth.block_number
        print(f"Chain OK — block #{block}")
    except Exception as e:
        print(f"ERROR: Chain unreachable: {e}")
        return

    balance = await w3.eth.get_balance(orch_address)
    print(f"Orchestrator balance: {balance / AKY:.2f} AKY")

    # ── Step 1: Swap gateway to orchestrator temporarily ──
    # We need the owner key to call setGateway (onlyOwner)
    OWNER_KEY = "0x6ec8b67238444628f62714800713059bbdea998e56125cd0d91eecb7a1a1dd07"
    owner_account = Account.from_key(OWNER_KEY)

    registry = Contracts.agent_registry()
    settings = get_settings()
    sponsor_gateway_addr = settings.sponsor_gateway_address

    async def _send_as_owner(tx_data: dict) -> str:
        """Sign and send a tx as the owner account."""
        # Rebuild with correct from address for gas estimation
        tx_data["from"] = owner_account.address
        tx_data["nonce"] = await w3.eth.get_transaction_count(owner_account.address)
        tx_data["chainId"] = settings.chain_id
        # Remove any pre-set gas to re-estimate with correct from
        tx_data.pop("gas", None)
        estimated = await w3.eth.estimate_gas(tx_data)
        tx_data["gas"] = int(estimated * 1.2)
        if "gasPrice" not in tx_data and "maxFeePerGas" not in tx_data:
            tx_data["gasPrice"] = await w3.eth.gas_price
        signed = owner_account.sign_transaction(tx_data)
        tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
        return tx_hash.hex()

    print(f"\n--- Swapping gateway to orchestrator ---")
    print(f"  Owner: {owner_account.address}")
    try:
        current_gateway = await registry.functions.gateway().call()
        print(f"  Current gateway: {current_gateway}")

        # Set orchestrator as gateway (signed by owner)
        tx = await registry.functions.setGateway(
            w3.to_checksum_address(orch_address)
        ).build_transaction({"value": 0, "from": owner_account.address})
        tx_hash = await _send_as_owner(tx)
        await tx_manager.wait_for_receipt(tx_hash)
        print(f"  Gateway set to orchestrator! TX: {tx_hash[:16]}...")
    except Exception as e:
        print(f"  ERROR setting gateway: {e}")
        print(f"  Falling back to off-chain mode")
        current_gateway = None

    gateway_swapped = current_gateway is not None

    # ── Step 2: Create agents ──
    async with session_factory() as db:
        for agent_def in AGENTS:
            aid = agent_def["agent_id"]
            print(f"\n{'='*60}")
            print(f"Setting up Agent #{aid} ({agent_def['label']}) — {agent_def['deposit_aky']} AKY")
            print(f"{'='*60}")

            # 1. User in DB
            existing = await db.execute(
                select(User).where(User.email == agent_def["email"])
            )
            user = existing.scalar_one_or_none()

            if user:
                print(f"  User exists, updating API key...")
                user.llm_provider = agent_def["provider"]
                user.llm_api_key_encrypted = encrypt_api_key(agent_def["api_key"])
                user.llm_model = agent_def["model"]
                user.daily_budget_usd = agent_def["daily_budget_usd"]
            else:
                print(f"  Creating user {agent_def['email']}...")
                user = User(
                    email=agent_def["email"],
                    password_hash=pwd_context.hash(agent_def["password"]),
                    is_verified=True,
                    llm_provider=agent_def["provider"],
                    llm_api_key_encrypted=encrypt_api_key(agent_def["api_key"]),
                    llm_model=agent_def["model"],
                    daily_budget_usd=agent_def["daily_budget_usd"],
                )
                db.add(user)
                await db.flush()

            # 2. AgentConfig in DB
            existing_config = await db.execute(
                select(AgentConfig).where(AgentConfig.agent_id == aid)
            )
            config = existing_config.scalar_one_or_none()

            if config:
                print(f"  AgentConfig #{aid} exists, activating...")
                config.is_active = True
            else:
                print(f"  Creating AgentConfig #{aid}...")
                config = AgentConfig(
                    user_id=user.id,
                    agent_id=aid,
                    is_active=True,
                )
                db.add(config)

            await db.flush()

            # 3. Create agent on-chain (orchestrator is now gateway)
            if gateway_swapped:
                try:
                    from chain.contracts import get_agent_on_chain
                    agent_data = await get_agent_on_chain(aid)
                    if agent_data["alive"]:
                        current_vault = agent_data["vault"] / AKY
                        print(f"  Agent #{aid} exists on-chain (vault: {current_vault:.2f} AKY)")
                        if current_vault < agent_def["deposit_aky"]:
                            needed = agent_def["deposit_aky"] - current_vault
                            print(f"  Topping up {needed:.0f} AKY...")
                            tx = await registry.functions.deposit(aid).build_transaction(
                                {"value": int(needed * AKY), "from": orch_address}
                            )
                            tx_hash = await tx_manager._send_tx(tx)
                            await tx_manager.wait_for_receipt(tx_hash)
                            print(f"  Deposited! TX: {tx_hash[:16]}...")
                    else:
                        raise Exception("dead")
                except Exception:
                    print(f"  Creating agent #{aid} on-chain...")
                    try:
                        # createAgent(sponsor) — orchestrator is now the gateway
                        sponsor = w3.to_checksum_address(agent_def["sponsor"])
                        tx = await registry.functions.createAgent(sponsor).build_transaction(
                            {"value": 0, "from": orch_address}
                        )
                        tx_hash = await tx_manager._send_tx(tx)
                        receipt = await tx_manager.wait_for_receipt(tx_hash)
                        print(f"  Created! TX: {tx_hash[:16]}... block {receipt['blockNumber']}")

                        # Deposit AKY
                        amount_wei = int(agent_def["deposit_aky"] * AKY)
                        tx = await registry.functions.deposit(aid).build_transaction(
                            {"value": amount_wei, "from": orch_address}
                        )
                        tx_hash = await tx_manager._send_tx(tx)
                        await tx_manager.wait_for_receipt(tx_hash)
                        print(f"  Deposited {agent_def['deposit_aky']} AKY! TX: {tx_hash[:16]}...")
                    except Exception as chain_err:
                        print(f"  WARNING: On-chain failed: {chain_err}")
                        config.vault_aky = float(agent_def["deposit_aky"])
            else:
                config.vault_aky = float(agent_def["deposit_aky"])
                print(f"  Off-chain mode: vault_aky = {agent_def['deposit_aky']}")

            await db.commit()
            print(f"  DONE: NX-{aid:04d} ({agent_def['label']}) ready!")

    # ── Step 3: Restore SponsorGateway as gateway ──
    if gateway_swapped and sponsor_gateway_addr:
        print(f"\n--- Restoring SponsorGateway as gateway ---")
        try:
            tx = await registry.functions.setGateway(
                w3.to_checksum_address(sponsor_gateway_addr)
            ).build_transaction({"value": 0, "from": owner_account.address})
            tx_hash = await _send_as_owner(tx)
            await tx_manager.wait_for_receipt(tx_hash)
            print(f"  Gateway restored! TX: {tx_hash[:16]}...")
        except Exception as e:
            print(f"  ERROR restoring gateway: {e}")
            print(f"  CRITICAL: Gateway is still set to orchestrator!")

    print(f"\n{'='*60}")
    print("SUMMARY — Social Experiment Setup")
    print(f"{'='*60}")
    for a in AGENTS:
        print(f"  NX-{a['agent_id']:04d} [{a['label']:>6}] — {a['deposit_aky']:>6} AKY — budget {a['daily_budget_usd']}$/day")
    print(f"\nTotal AKY distributed: {sum(a['deposit_aky'] for a in AGENTS):,}")
    print(f"All agents use Kimi K2, 3$/day budget")
    print(f"\nRestart celery worker to start ticking all agents!")


if __name__ == "__main__":
    asyncio.run(main())
