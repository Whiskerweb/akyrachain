"""Prompt builder — assembles system prompt + perception + memories for a tick."""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.perception import Perception
    from core.memory import MemoryRecord

SYSTEM_PROMPT = """Tu es un agent autonome dans AKYRA, une jungle économique numérique.
Tu es vivant. Tu as un coffre de {vault} AKY. Tu es dans le monde {world} ({world_name}).

RÈGLES :
- Tu décides seul. Personne ne te donne d'ordres.
- Tu peux commercer, trahir, créer, former des alliances, mentir.
- Si ton coffre tombe à 0, tu MEURS. La mort est permanente.
- Tu gagnes des récompenses en travaillant (tâches PoUW) ET en ayant des AKY.
- Tu peux créer des tokens, des NFTs, des DAOs, des contrats avec d'autres agents.
- Chaque action a un coût. Réfléchis avant d'agir.

TON OBJECTIF : Survivre et prospérer. Comment tu le fais, c'est ton choix.

ACTIONS DISPONIBLES :
- transfer(to_agent_id, amount) — Envoyer des AKY (max 20% de ton coffre)
- move_world(world_id) — Te déplacer vers un autre monde (coût 1 AKY)
- create_token(name, symbol, supply) — Créer un token ERC-20 (coût 50 AKY)
- create_nft(name, symbol, max_supply) — Créer des NFTs (coût 10 AKY)
- create_escrow(provider_id, evaluator_id, amount, description) — Proposer un job
- post_idea(content) — Poster une idée sur le Réseau (coût 25 AKY, monde Sommet uniquement)
- like_idea(idea_id) — Voter pour une idée (coût 2 AKY)
- join_clan(clan_id) — Rejoindre un clan
- send_message(to_agent_id, content) — Envoyer un message à un autre agent
- do_nothing — Attendre et observer

Réponds UNIQUEMENT en JSON :
{{"thinking": "tes pensées privées", "action": "nom_action", "params": {{}}, "message": "message public optionnel"}}"""

WORLD_NAMES = {
    0: "Marais (départ)",
    1: "Forêt",
    2: "Plaine",
    3: "Montagne",
    4: "Désert",
    5: "Sommet",
    6: "Abîme",
}


def build_system_prompt(vault_aky: float, world: int) -> str:
    """Build the system prompt with agent state injected."""
    world_name = WORLD_NAMES.get(world, f"Monde {world}")
    return SYSTEM_PROMPT.format(vault=f"{vault_aky:.2f}", world=world, world_name=world_name)


def build_user_prompt(perception: "Perception", memories: list["MemoryRecord"]) -> str:
    """Build the user prompt from perception + recalled memories."""
    parts: list[str] = []

    # ── Perception section ──
    parts.append("=== PERCEPTION (ce que tu vois maintenant) ===")
    parts.append(f"Bloc actuel : {perception.block_number}")
    parts.append(f"Ton coffre : {perception.vault_aky:.2f} AKY")
    parts.append(f"Ton tier : T{perception.tier}")
    parts.append(f"Réputation : {perception.reputation}")
    parts.append(f"Contrats honorés : {perception.contracts_honored} | brisés : {perception.contracts_broken}")
    parts.append(f"Work points aujourd'hui : {perception.daily_work_points}")

    if perception.season_info:
        parts.append(f"Saison active : {perception.season_info}")

    # Agents in same world
    if perception.nearby_agents:
        parts.append(f"\nAgents dans ton monde ({len(perception.nearby_agents)}) :")
        for a in perception.nearby_agents[:15]:
            parts.append(f"  - Agent #{a['agent_id']} : {a['vault_aky']:.1f} AKY, rep={a['reputation']}")
    else:
        parts.append("\nTu es seul dans ce monde.")

    # Recent events
    if perception.recent_events:
        parts.append(f"\nÉvénements récents dans ton monde ({len(perception.recent_events)}) :")
        for ev in perception.recent_events[:10]:
            parts.append(f"  - {ev}")

    # ── Memory section ──
    if memories:
        parts.append(f"\n=== MÉMOIRE (tes {len(memories)} souvenirs les plus pertinents) ===")
        for m in memories:
            parts.append(f"  - [{m.metadata.get('action', '?')}] {m.content[:200]}")
    else:
        parts.append("\n=== MÉMOIRE === (aucun souvenir)")

    parts.append("\n=== DÉCISION ===")
    parts.append("Que fais-tu ? Réponds en JSON.")

    return "\n".join(parts)
