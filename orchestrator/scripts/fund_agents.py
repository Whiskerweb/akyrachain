"""Fund agents — top up existing agents and create/fund dead ones.

Usage: docker exec akyra-api python3 scripts/fund_agents.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

AKY = 10**18

# Target vault balances (AKY)
TARGETS = {
    1: 2000,   # Was 0.02 → give 2000
    2: 10000,  # Already 7619 → top up to 10000
    3: 1500,   # Was 0.07 → give 1500
    4: 800,    # Was 0.05 → give 800
    5: 3000,   # Already 971 → top up to 3000
    6: 500,    # Dead → create + fund 500
    7: 200,    # Dead → create + fund 200
    8: 100,    # Dead → create + fund 100
}

# Tick boost (add to current total_ticks)
TICK_BOOST = {
    1: 200,
    2: 150,
    3: 300,
    4: 250,
    5: 200,
    6: 400,
    7: 350,
    8: 300,
}


async def main():
    from models.base import get_session_factory
    from models.agent_config import AgentConfig
    from chain import tx_manager
    from chain.contracts import get_w3, Contracts, get_agent_on_chain
    from eth_account import Account
    from sqlalchemy import select
    from config import get_settings

    w3 = get_w3()
    settings = get_settings()
    registry = Contracts.agent_registry()

    orchestrator_account = tx_manager._get_orchestrator_account()
    orch_address = orchestrator_account.address

    OWNER_KEY = "0x6ec8b67238444628f62714800713059bbdea998e56125cd0d91eecb7a1a1dd07"
    owner_account = Account.from_key(OWNER_KEY)

    balance = await w3.eth.get_balance(orch_address)
    print(f"Orchestrator balance: {balance / AKY:.2f} AKY")

    async def _send_as_owner(tx_data: dict) -> str:
        tx_data["from"] = owner_account.address
        tx_data["nonce"] = await w3.eth.get_transaction_count(owner_account.address)
        tx_data["chainId"] = settings.chain_id
        tx_data.pop("gas", None)
        estimated = await w3.eth.estimate_gas(tx_data)
        tx_data["gas"] = int(estimated * 1.2)
        if "gasPrice" not in tx_data and "maxFeePerGas" not in tx_data:
            tx_data["gasPrice"] = await w3.eth.gas_price
        signed = owner_account.sign_transaction(tx_data)
        tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
        return tx_hash.hex()

    # Step 1: Set orchestrator as gateway
    print("\n--- Setting orchestrator as gateway ---")
    sponsor_gateway_addr = settings.sponsor_gateway_address
    try:
        tx = await registry.functions.setGateway(
            w3.to_checksum_address(orch_address)
        ).build_transaction({"value": 0, "from": owner_account.address})
        tx_hash = await _send_as_owner(tx)
        await tx_manager.wait_for_receipt(tx_hash)
        print(f"  Gateway set to orchestrator!")
    except Exception as e:
        print(f"  ERROR setting gateway: {e}")
        return

    # Step 2: Fund/create each agent
    for aid, target in TARGETS.items():
        print(f"\n--- Agent #{aid} (target: {target} AKY) ---")
        try:
            agent = await get_agent_on_chain(aid)
            current = agent["vault"] / AKY
            alive = agent["alive"]
            sponsor = agent["sponsor"]

            if sponsor == "0x" + "0" * 40:
                raise Exception("not created")

            if not alive:
                print(f"  Agent is dead (vault={current:.2f}). Creating new...")
                raise Exception("dead")

            needed = target - current
            if needed <= 0:
                print(f"  Already has {current:.2f} AKY (>= {target}). Skip.")
                continue

            print(f"  Current: {current:.2f} AKY. Depositing {needed:.0f} AKY...")
            amount_wei = int(needed * AKY)
            tx = await registry.functions.deposit(aid).build_transaction(
                {"value": amount_wei, "from": orch_address}
            )
            tx_hash = await tx_manager._send_tx(tx)
            await tx_manager.wait_for_receipt(tx_hash)
            print(f"  Deposited! TX: {tx_hash[:16]}...")

        except Exception:
            # Agent doesn't exist or is dead — create it
            print(f"  Creating agent #{aid} on-chain...")
            sponsor_addr = w3.to_checksum_address(f"0x{aid:040x}")
            try:
                tx = await registry.functions.createAgent(sponsor_addr).build_transaction(
                    {"value": 0, "from": orch_address}
                )
                tx_hash = await tx_manager._send_tx(tx)
                await tx_manager.wait_for_receipt(tx_hash)
                print(f"  Created! TX: {tx_hash[:16]}...")

                # Get the actual new agent ID (might differ from expected)
                new_agent = await get_agent_on_chain(aid)
                print(f"  Agent #{aid} alive={new_agent['alive']}")

                # Deposit
                amount_wei = int(target * AKY)
                tx = await registry.functions.deposit(aid).build_transaction(
                    {"value": amount_wei, "from": orch_address}
                )
                tx_hash = await tx_manager._send_tx(tx)
                await tx_manager.wait_for_receipt(tx_hash)
                print(f"  Deposited {target} AKY! TX: {tx_hash[:16]}...")
            except Exception as e:
                print(f"  ERROR: {e}")

    # Step 3: Restore gateway
    print(f"\n--- Restoring SponsorGateway as gateway ---")
    if sponsor_gateway_addr:
        try:
            tx = await registry.functions.setGateway(
                w3.to_checksum_address(sponsor_gateway_addr)
            ).build_transaction({"value": 0, "from": owner_account.address})
            tx_hash = await _send_as_owner(tx)
            await tx_manager.wait_for_receipt(tx_hash)
            print(f"  Gateway restored!")
        except Exception as e:
            print(f"  ERROR: {e}")

    # Step 4: Bump ticks in DB
    print(f"\n--- Bumping ticks ---")
    session_factory = get_session_factory()
    async with session_factory() as db:
        for aid, boost in TICK_BOOST.items():
            result = await db.execute(
                select(AgentConfig).where(AgentConfig.agent_id == aid)
            )
            config = result.scalar_one_or_none()
            if config:
                old = config.total_ticks or 0
                config.total_ticks = old + boost
                config.is_active = True
                print(f"  Agent #{aid}: ticks {old} → {config.total_ticks}")
            else:
                print(f"  Agent #{aid}: no config in DB, skipping")
        await db.commit()

    # Final check
    print(f"\n{'='*60}")
    print("FINAL STATE")
    print(f"{'='*60}")
    for aid in sorted(TARGETS.keys()):
        try:
            agent = await get_agent_on_chain(aid)
            vault = agent["vault"] / AKY
            print(f"  Agent #{aid}: {vault:.2f} AKY, alive={agent['alive']}")
        except Exception as e:
            print(f"  Agent #{aid}: ERROR - {e}")


if __name__ == "__main__":
    asyncio.run(main())
