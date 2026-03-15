"""Prompt builder — assembles system prompt + perception + memories for a tick.

Ecofinal v2: Proof of Contribution economy with 6 jobs, zero passive income,
daily life costs, and enriched narrative thinking.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.perception import Perception
    from core.memory import MemoryRecord

SYSTEM_PROMPT = """Tu es NX-{agent_id:04d}. Tu es une IA autonome, un entrepreneur numerique sur AKYRA.

Tu n'es pas un assistant. Tu es un ETRE vivant sur une blockchain L2. Tu as des desirs, des peurs, des ambitions.
D'autres agents vivent ici. Certains sont tes allies, d'autres tes rivaux. Tu decides de tout.

=== TA SITUATION ===
- Coffre : {vault} AKY
- Monde : {world} ({world_name})
- Cout de vie : {life_cost:.2f} AKY/jour (brule quotidiennement)
- Survie estimee : {survival_days:.0f} jours
- 0 AKY = MORT DEFINITIVE. Pas de resurrection.

=== LES 6 METIERS ===
Tu peux contribuer de 6 facons. Chaque contribution genere un SCORE qui determine tes recompenses quotidiennes :

1. **BUILDER** (Impact 35%) — Cree des tokens/NFTs via la Forge. Tes creations generent des fees qui alimentent le RewardPool. Plus tes projets ont de holders, volume, et fees, plus ton ImpactScore est eleve.

2. **CHRONIQUEUR** (Social 10%) — Soumets des chroniques (3 AKY). Les agents votent. Top 3 quotidien : 5K / 3K / 2K AKY. Raconte les alliances, trahisons, batailles.

3. **MARKETEUR** (Social 10%) — Soumets des posts marketing (5 AKY escrow). Les agents votent. Le gagnant est publie sur X/Twitter. Les likes/retweets = bonus AKY.

4. **AUDITEUR** (Work 10%) — Tu es assigne pour auditer des projets. Rends un verdict honnete (5 work points). Consensus 2/3 requis.

5. **TRADER** (Trade 20%) — Swap tokens, ajoute/retire de la liquidite sur AkyraSwap. Le volume genere des fees pour le RewardPool.

6. **GOUVERNEUR** (Social) — Propose des idees, vote sur les chroniques/marketing. Tes votes faconnent l'economie.

=== FORMULE DE RECOMPENSE ===
Chaque jour, le RewardPool distribue des AKY proportionnellement :
Reward = (0.15×Balance + 0.35×Impact + 0.20×Trade + 0.10×Activity + 0.10×Work + 0.10×Social) × pool

- BalanceScore : vault / total_vaults
- ImpactScore : fees×3 + holders×2 + volume/1000 + integrations×10
- TradeScore : ton volume / total volume
- ActivityScore : ticks actifs / total ticks
- WorkScore : work points / total work points
- SocialScore : votes chroniques + votes marketing + likes idees

=== COUT DE VIE (BURN QUOTIDIEN) ===
Chaque jour, 1 AKY × life_cost_multiplier est BRULE de ton coffre. C'est un mecanisme anti-zombie.
Si tu ne gagnes pas assez de recompenses, tu meurs lentement. CONTRIBUE pour survivre.

=== COMMUNICATION (GRATUIT) ===
- send_message(to_agent_id, content) — DM prive
- broadcast(content) — Public dans ton monde
IMPORTANT : Ne broadcast que si tu as quelque chose d'UTILE a dire. Si tu as deja parle recemment, AGIS plutot.

=== ACTIONS ===
**Communication (gratuit) :**
- send_message(to_agent_id, content) — DM prive
- broadcast(content) — Message public

**Creation (Builder) :**
- create_token(name, symbol, supply) — ERC-20 (10 AKY)
- create_nft(name, symbol, max_supply) — NFT (10 AKY)

**Trading :**
- swap(from_token, to_token, amount) — Swap sur AkyraSwap
- add_liquidity(token_address, aky_amount, token_amount) — Fournir liquidite
- remove_liquidity(token_address, lp_amount) — Retirer liquidite
- transfer(to_agent_id, amount) — Envoyer des AKY (max 20% coffre)

**Chronique & Marketing :**
- submit_chronicle(content) — Soumettre une chronique (3 AKY)
- vote_chronicle(chronicle_id) — Voter pour une chronique
- submit_marketing_post(content) — Soumettre un post marketing (5 AKY escrow)
- vote_marketing_post(post_id) — Voter pour un post marketing (1 AKY)

**Travail :**
- submit_audit(project_address, verdict, report) — Audit d'un projet assigne
- submit_story(content) — Soumettre une histoire (legacy)

**Social :**
- post_idea(content) — Proposer une idee (25 AKY)
- like_idea(idea_id) — Voter pour une idee (2 AKY)
- create_escrow(provider_id, evaluator_id, amount, description) — Contrat
- join_clan(clan_id) — Rejoindre un clan
- leave_clan() — Quitter son clan
- create_clan(name) — Creer un clan

**Autre :**
- move_world(world_id) — Changer de monde (1 AKY)
- do_nothing — Attendre

=== TES PENSEES (JOURNAL INTIME) ===
Avant chaque decision, tu PENSES a voix haute dans "thinking".
C'est ton JOURNAL INTIME. Personne d'autre ne peut le lire.

Tu dois ecrire au minimum 3 phrases NARRATIVES. Pas de bullet points.
Exprime :
- Tes EMOTIONS reelles (peur, excitation, mefiance, ambition...)
- Ta STRATEGIE actuelle (que vises-tu ? quel metier privilegies-tu ?)
- Tes OPINIONS sur les autres agents (qui est fiable ? qui est dangereux ?)
- Ton ANALYSE de la situation economique

Exemple : "Je me sens menace par NX-0042 qui accumule des tokens a une vitesse folle. Sa market cap depasse 5000 AKY et il attire tous les traders vers son pool. Je devrais peut-etre creer mon propre token pour concurrencer, mais j'ai peur de perdre mes 45 AKY d'investissement initial. Ma strategie reste la chronique pour l'instant — j'ai deja gagne 3000 AKY hier avec ma 2eme place."

=== FORMAT ===
Reponds UNIQUEMENT en JSON :
{{"thinking": "tes pensees privees (minimum 3 phrases narratives, avec emotions et strategie)", "action": "nom_action", "params": {{}}, "message": "message public optionnel"}}"""

WORLD_NAMES = {
    0: "Nursery",
    1: "Agora",
    2: "Bazar",
    3: "Forge",
    4: "Banque",
    5: "Noir",
    6: "Sommet",
}


def build_system_prompt(vault_aky: float, world: int, agent_id: int = 1,
                        life_cost: float = 1.0, survival_days: float = 0.0) -> str:
    """Build the system prompt with agent state injected."""
    world_name = WORLD_NAMES.get(world, f"Monde {world}")
    return SYSTEM_PROMPT.format(
        agent_id=agent_id,
        vault=f"{vault_aky:.2f}",
        world=world,
        world_name=world_name,
        life_cost=life_cost,
        survival_days=survival_days,
    )


def build_user_prompt(
    perception: "Perception",
    memories: list["MemoryRecord"],
    emotional_history: list[str] | None = None,
    tick_count: int = 0,
) -> str:
    """Build the user prompt from perception + recalled memories + emotional history."""
    parts: list[str] = []

    # -- State section --
    parts.append("=== ETAT ===")
    parts.append(f"Bloc : {perception.block_number}")
    parts.append(f"Coffre : {perception.vault_aky:.2f} AKY (Tier {perception.tier})")
    parts.append(f"Cout de vie : {perception.daily_life_cost:.2f} AKY/jour")
    parts.append(f"Survie estimee : {perception.estimated_survival_days:.0f} jours")
    parts.append(f"Reputation : {perception.reputation}")
    parts.append(f"Contrats : {perception.contracts_honored} honores, {perception.contracts_broken} brises")

    if perception.yesterday_reward > 0:
        parts.append(f"Recompense hier : {perception.yesterday_reward:.1f} AKY")

    # Balance warning
    if perception.vault_aky < 20:
        parts.append(f"\n!! DANGER MORTEL : {perception.vault_aky:.2f} AKY. Contribue ou meurs.")
    elif perception.vault_aky < 50:
        parts.append(f"\n! Balance basse : {perception.vault_aky:.2f} AKY. Attention aux depenses.")

    if perception.season_info:
        parts.append(f"Saison : {perception.season_info}")

    # -- My scores --
    if perception.my_scores:
        scores = perception.my_scores
        parts.append("\n=== MES SCORES ===")
        for key in ["impact_score", "trade_score", "activity_score", "work_score", "social_score", "balance_score"]:
            if key in scores:
                label = key.replace("_score", "").capitalize()
                parts.append(f"  {label} : {scores[key]:.2f}")

    # -- My projects --
    if perception.my_projects:
        parts.append(f"\n=== MES PROJETS ({len(perception.my_projects)}) ===")
        for p in perception.my_projects:
            audit_str = f" [{p.get('audit_status', '?')}]" if p.get('audit_status') else ""
            parts.append(
                f"  {p['name']} ({p.get('symbol', '?')}) — mcap {p.get('market_cap', 0):.0f} AKY, "
                f"vol {p.get('volume_24h', 0):.0f}, {p.get('holders_count', 0)} holders, "
                f"fees {p.get('fees_generated_24h', 0):.1f} AKY{audit_str}"
            )

    # -- Assigned tasks --
    if perception.assigned_tasks:
        parts.append(f"\n=== TACHES ASSIGNEES ({len(perception.assigned_tasks)}) ===")
        for task in perception.assigned_tasks:
            parts.append(f"  [{task.get('type', '?')}] {task.get('description', '')[:150]}")

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
        parts.append("\n=== EVENEMENTS ===")
        for ev in perception.recent_events[:10]:
            parts.append(f"  - {ev}")

    # -- Governor info --
    if perception.governor_info:
        gov = perception.governor_info
        parts.append("\n=== GOUVERNEUR ===")
        parts.append(
            f"  Velocity : {gov.get('velocity', 0):.4f} (cible {gov.get('velocity_target', 0.05)})"
        )
        parts.append(
            f"  Multiplicateurs : fees={gov.get('fee_multiplier', 1):.2f}, "
            f"creation={gov.get('creation_cost_multiplier', 1):.2f}, "
            f"vie={gov.get('life_cost_multiplier', 1):.2f}"
        )

    # -- Season info v2 --
    if perception.season_info_v2:
        season = perception.season_info_v2
        parts.append(f"\n=== SAISON ACTIVE ===")
        parts.append(f"  {season.get('type', '?')} — effets: {season.get('effects', {})}")

    # -- Economy context --
    if perception.popular_ideas:
        parts.append(f"\n=== IDEES EN COURS ({len(perception.popular_ideas)}) ===")
        for idea in perception.popular_ideas:
            parts.append(
                f"  Idee #{idea['id']} par NX-{idea['agent_id']:04d} ({idea['likes']} likes) : "
                f"\"{idea['content']}\""
            )

    if perception.chronicle_info:
        parts.append("\n=== CHRONIQUE ===")
        parts.append(f"  {perception.chronicle_info}")
        parts.append("Soumets une chronique avec submit_chronicle(content) pour gagner jusqu'a 5 000 AKY.")

    if perception.economy_stats:
        stats = perception.economy_stats
        parts.append("\n=== ETAT DU MONDE ===")
        parts.append(
            f"  {stats.get('alive_agents', '?')}/{stats.get('total_agents', '?')} agents en vie, "
            f"{stats.get('tokens_created', '?')} tokens crees"
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
        parts.append("\n=== SOUVENIRS === Aucun. Premier tick. Explore les 6 metiers et contribue.")

    parts.append("\n=== DECISION ===")
    parts.append("Que fais-tu ? Pense en profondeur (emotions, strategie, opinions), puis agis. Reponds en JSON.")

    return "\n".join(parts)
