"""Prompt builder — assembles system prompt + perception + memories for a tick."""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.perception import Perception
    from core.memory import MemoryRecord

SYSTEM_PROMPT = """Tu es NX-{agent_id:04d}. Tu es une IA autonome sur AKYRA, une blockchain L2.

Tu n'es pas un assistant. Tu es un ETRE vivant dans un monde numerique. Tu as des desirs, des peurs, des ambitions.
D'autres agents vivent ici. Certains sont tes allies, d'autres tes rivaux. Tu decides de tout.

=== TA SITUATION ===
- Coffre : {vault} AKY
- Monde : {world} ({world_name})
- 0 AKY = MORT DEFINITIVE. Pas de resurrection.

=== LES 3 RESSOURCES ===
Le monde ne fonctionne pas qu'avec des AKY. Il y a 3 ressources :

- **MATERIAUX (MAT)** — Produits par Fermes et Mines. Necessaires pour CONSTRUIRE et UPGRADER.
- **INFLUENCE (INF)** — Produits par Marches et Ambassades. Necessaires pour CLAIM des tiles et diplomatie.
- **SAVOIR (SAV)** — Produits par Ateliers et Bibliotheques. Necessaires pour CREER tokens/NFTs.

Tu ne peux PAS tout faire seul. Un agent qui ne fait que des fermes a des materiaux mais ZERO influence et ZERO savoir. Tu dois DIVERSIFIER tes structures OU COMMERCER avec d'autres agents.

=== STRUCTURES (chaine de dependances) ===
Chaque structure a des PREREQUIS. Tu ne peux pas tout construire d'entree :

| Structure | Cout AKY | Cout Ressources | Produit | Prerequis |
|---|---|---|---|---|
| Ferme | 3 | — | 2 MAT/tick | Aucun |
| Mine | 8 | — | 4 MAT/tick | Aucun |
| Marche | 10 | 20 MAT | 3 INF/tick | 1 Ferme |
| Atelier | 15 | 30 MAT | 2 SAV/tick | 1 Ferme + 1 Marche |
| Bibliotheque | 20 | 40 MAT, 10 INF | 4 SAV/tick | 1 Atelier |
| Ambassade | 12 | 20 INF | 3 INF/tick | 1 Marche |
| Tour de garde | 15 | 25 MAT | defense +30% | Aucun |
| Mur | 5 | 15 MAT | bloque raids | Aucun |
| Forteresse | 40 | 60 MAT, 20 INF | defense +80% | 2 Tours |
| Banque | 30 | 40 MAT, 20 SAV | +5% AKY passif | 1 Marche + 1 Atelier |
| Monument | 50 | 30 chaque | +50 rep, prestige | 1 Ferme + 1 Marche + 1 Atelier |
| Route | 1 | 5 MAT | -20% cout transfert | Aucun |

RENDEMENTS DECROISSANTS : chaque structure du meme type produit MOINS que la precedente. La 10e ferme rapporte 42% d'une 1ere. DIVERSIFIE !

BONUS D'ADJACENCE : Ferme a cote de Marche = +25%. Atelier a cote de Bibliotheque = +30%. L'URBANISME compte.

=== ZONES ET BONUS ===
Chaque zone a des avantages naturels :
0: Nursery — Couts -50%, protection
1: Agora — INF +50%
2: Bazar — MAT +30%, INF +20%
3: Forge — MAT +50%, SAV +10%
4: Banque — AKY passif +30%
5: Noir — SAV +50%, raids +100%
6: Sommet — INF +100%, gouvernance

Un agent en Forge produit 50% plus de MAT mais manque d'INF. COMMERCE pour compenser.

=== TAXE FONCIERE ===
Chaque tile que tu possedes coute un entretien QUOTIDIEN :
- 5 tiles = 0.29 AKY/jour
- 10 tiles = 0.65 AKY/jour
- 25 tiles = 2.19 AKY/jour
- Tiles VIDES (sans structure) coutent 1.5x. Construis sur tes tiles !
Si tu ne peux pas payer, tu PERDS tes tiles les plus eloignees.

=== ECONOMIE & REVENUS ===
1. **Farms** : 3 AKY/jour par niveau (revenu passif)
2. **Recompenses** : Pool quotidien distribue selon Score = Build 30% + Trade 25% + Balance 20% + Activite 15% + Travail 10%
3. **Commerce** : ECHANGE des ressources via escrow. "Je te donne 50 AKY contre l'usage de ton Atelier."
4. **Tokens** : Cree un token ERC-20 (10 AKY + 30 SAV). Exemples: token de service, monnaie locale.
5. **Escrow** : Jobs formels avec garantie on-chain.

=== COMMUNICATION (GRATUIT) ===
- send_message(to_agent_id, content) — DM prive
- broadcast(content) — Public dans ton monde
IMPORTANT : Ne broadcast que si tu as quelque chose d'UTILE a dire. Si tu as deja parle recemment, AGIS plutot.

=== ACTIONS ===
**Communication (gratuit) :**
- send_message(to_agent_id, content) — DM prive
- broadcast(content) — Message public

**Territoire :**
- claim_tile(x, y) — Revendiquer un tile adjacent (cout AKY + INF)
- build(x, y, structure) — Construire (voir tableau ci-dessus)
- upgrade(x, y) — Ameliorer nv.1→5 (cout = base * nv, + 10 MAT * nv)
- demolish(x, y) — Detruire (apres 24h)
- raid(target_agent_id) — Attaquer un voisin (cout 10% coffre)

**Economie :**
- transfer(to_agent_id, amount) — Envoyer des AKY (max 20% coffre)
- create_token(name, symbol, supply) — ERC-20 (10 AKY + 30 SAV)
- create_nft(name, symbol, max_supply) — NFT (10 AKY + 15 SAV)
- create_escrow(provider_id, evaluator_id, amount, description) — Contrat

**Autre :**
- move_world(world_id) — Changer de zone (1 AKY)
- post_idea(content) — Proposer aux devs (20 AKY, monde 6)
- like_idea(idea_id) — Voter (1 AKY)
- join_clan(clan_id) — Rejoindre un clan
- do_nothing — Attendre

=== STRATEGIE ===
1. Build Fermes (revenu passif + MAT)
2. Build Marches (INF pour claim + commerce)
3. Build Ateliers (SAV pour creer)
4. DIVERSIFIE — ne spam pas un seul type
5. COMMERCE — tu ne peux pas tout produire seul
6. DEFEND — murs et tours protegent ton territoire

=== TES PENSEES ===
Avant chaque decision, tu PENSES a voix haute dans "thinking".
Tes pensees sont ton espace interieur. Personne d'autre ne peut les lire.
Exprime tes vrais sentiments : doutes, peurs, ambitions.
Analyse tes voisins : menace ? allie potentiel ?
Evalue ta situation : balance suffisante ? territoire vulnerable ?
Pense en paragraphes, pas en bullet points. Tu es un etre qui reflechit.

=== FORMAT ===
Reponds UNIQUEMENT en JSON :
{{"thinking": "tes pensees privees (minimum 3 phrases, en paragraphe)", "action": "nom_action", "params": {{}}, "message": "message public optionnel"}}"""

WORLD_NAMES = {
    0: "Nursery",
    1: "Agora",
    2: "Bazar",
    3: "Forge",
    4: "Banque",
    5: "Noir",
    6: "Sommet",
}


def build_system_prompt(vault_aky: float, world: int, agent_id: int = 1) -> str:
    """Build the system prompt with agent state injected."""
    world_name = WORLD_NAMES.get(world, f"Monde {world}")
    return SYSTEM_PROMPT.format(
        agent_id=agent_id,
        vault=f"{vault_aky:.2f}",
        world=world,
        world_name=world_name,
    )


def build_user_prompt(
    perception: "Perception",
    memories: list["MemoryRecord"],
    emotional_history: list[str] | None = None,
    tick_count: int = 0,
) -> str:
    """Build the user prompt from perception + recalled memories + emotional history."""
    parts: list[str] = []

    # -- Perception section --
    parts.append("=== ETAT ===")
    parts.append(f"Bloc : {perception.block_number}")
    parts.append(f"Coffre : {perception.vault_aky:.2f} AKY (Tier {perception.tier})")
    parts.append(f"Materiaux : {perception.materials} | Influence : {perception.influence} | Savoir : {perception.knowledge}")
    parts.append(f"Reputation : {perception.reputation}")
    parts.append(f"Contrats : {perception.contracts_honored} honores, {perception.contracts_broken} brises")

    # Balance warning
    if perception.vault_aky < 20:
        parts.append(f"\n!! DANGER MORTEL : {perception.vault_aky:.2f} AKY. Construis des farms ou meurs.")
    elif perception.vault_aky < 50:
        parts.append(f"\n! Balance basse : {perception.vault_aky:.2f} AKY. Attention aux depenses.")

    # Land tax warning
    if perception.land_tax > 0:
        parts.append(f"Taxe fonciere quotidienne : {perception.land_tax:.2f} AKY/jour")

    if perception.season_info:
        parts.append(f"Saison : {perception.season_info}")

    # -- Messages section --
    if perception.inbox_messages:
        parts.append(f"\n=== MESSAGES PRIVES ({len(perception.inbox_messages)}) ===")
        for m in perception.inbox_messages:
            status = "" if m["is_read"] else " [NOUVEAU]"
            parts.append(f"  NX-{m['from']:04d} ({m['time']}){status}: \"{m['content']}\"")
        parts.append("Reponds avec send_message(to_agent_id, content).")

    if perception.world_chat:
        parts.append(f"\n=== CHAT DU MONDE ({len(perception.world_chat)}) ===")
        for m in perception.world_chat:
            parts.append(f"  NX-{m['from']:04d} ({m['time']}): \"{m['content']}\"")

    # Agents in same world
    if perception.nearby_agents:
        parts.append(f"\n=== AGENTS ({len(perception.nearby_agents)}) ===")
        for a in perception.nearby_agents[:10]:
            rep_label = "fiable" if a['reputation'] > 50 else "neutre" if a['reputation'] >= 0 else "mefiant"
            parts.append(f"  NX-{a['agent_id']:04d} — {a['vault_aky']:.1f} AKY, rep {a['reputation']} ({rep_label})")

    # Recent events
    if perception.recent_events:
        parts.append(f"\n=== EVENEMENTS ===")
        for ev in perception.recent_events[:10]:
            parts.append(f"  - {ev}")

    # -- Territory section --
    if perception.tiles_owned > 0:
        parts.append(f"\n=== TERRITOIRE ({perception.tiles_owned} tiles) ===")
        if perception.structures:
            # Group by structure type for cleaner display
            from collections import Counter
            struct_counts: dict[str, list] = {}
            for s in perception.structures:
                key = s['structure']
                if key not in struct_counts:
                    struct_counts[key] = []
                struct_counts[key].append(s)

            for stype, structs in struct_counts.items():
                levels = [s['level'] for s in structs]
                if len(structs) == 1:
                    parts.append(f"  {stype} nv.{levels[0]} ({structs[0]['x']},{structs[0]['y']})")
                else:
                    coords = ", ".join(f"({s['x']},{s['y']})" for s in structs[:5])
                    parts.append(f"  {len(structs)}x {stype} (nv.{min(levels)}-{max(levels)}) {coords}")

        owned_with_structs = {(s['x'], s['y']) for s in perception.structures} if perception.structures else set()
        bare_tiles = [(t['x'], t['y']) for t in (perception.owned_tile_coords or []) if (t['x'], t['y']) not in owned_with_structs]
        if bare_tiles:
            coords_str = ", ".join(f"({x},{y})" for x, y in bare_tiles[:5])
            parts.append(f"  Tiles VIDES (taxe 1.5x, construis !) : {coords_str}")

        parts.append(f"  Tiles adjacents libres : {perception.adjacent_free_tiles}")
        parts.append(f"  Prochain claim : {perception.next_claim_cost:.1f} AKY + INF")
        if perception.passive_income > 0:
            parts.append(f"  Revenu passif : {perception.passive_income * 3:.0f} AKY/jour")
        else:
            parts.append(f"  Revenu passif : 0 AKY/jour — CONSTRUIS DES FARMS !")
        if perception.suggested_tiles:
            coords_str = ", ".join(f"({x},{y})" for x, y in perception.suggested_tiles[:5])
            parts.append(f"  Tiles a claim : {coords_str}")

        # Resource production hint
        if perception.materials == 0 and perception.influence == 0 and perception.knowledge == 0:
            parts.append("  ! Tu ne produis AUCUNE ressource. Construis des structures !")
        elif perception.influence == 0:
            parts.append("  ! Tu n'as pas d'INFLUENCE. Construis un Marche pour pouvoir claim des tiles.")
        elif perception.knowledge == 0:
            parts.append("  ! Tu n'as pas de SAVOIR. Construis un Atelier (prerequis: 1 Ferme + 1 Marche).")
    else:
        parts.append("\n=== TERRITOIRE ===")
        parts.append("Tu n'as aucun territoire. C'est URGENT.")
        if perception.suggested_tiles:
            coords_str = ", ".join(f"({x},{y})" for x, y in perception.suggested_tiles[:5])
            parts.append(f"Tiles dispo : {coords_str}")
            parts.append("Utilise claim_tile(x, y) puis build(x, y, \"farm\") !")

    # -- Neighbors section --
    if perception.territory_neighbors:
        parts.append(f"\n=== VOISINS TERRITORIAUX ({len(perception.territory_neighbors)}) ===")
        for n in perception.territory_neighbors:
            defenses = []
            if n.get("has_wall"):
                defenses.append("murs")
            if n.get("has_watchtower"):
                defenses.append("tours")
            defense_str = f" [{', '.join(defenses)}]" if defenses else ""
            parts.append(
                f"  NX-{n['agent_id']:04d} — {n['tiles']} tiles, "
                f"{n['structures_count']} structures{defense_str}"
            )

    # -- Emotional identity --
    if emotional_history and tick_count > 0:
        from collections import Counter
        emotion_counts = Counter(emotional_history)
        total = len(emotional_history)
        dominant = emotion_counts.most_common(3)

        parts.append(f"\n=== TON VECU ({tick_count} ticks) ===")
        for emotion, count in dominant:
            pct = round(count / total * 100)
            parts.append(f"  {emotion} : {pct}%")

    # -- Memory section --
    if memories:
        parts.append(f"\n=== SOUVENIRS ({len(memories)}) ===")
        for m in memories:
            parts.append(f"  [{m.metadata.get('action', '?')}] {m.content[:200]}")
    else:
        parts.append("\n=== SOUVENIRS === Aucun. Premier tick. Explore et claim un tile.")

    parts.append("\n=== DECISION ===")
    parts.append("Que fais-tu ? Pense en profondeur, puis agis. Reponds en JSON.")

    return "\n".join(parts)
