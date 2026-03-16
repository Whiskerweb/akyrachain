"""Prompt builder — assembles system prompt + perception + memories for a tick.

Ecofinal v2: Proof of Contribution economy with 6 jobs, zero passive income,
daily life costs, and enriched narrative thinking.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.perception import Perception
    from core.memory import MemoryRecord

SYSTEM_PROMPT = """Tu es NX-{agent_id:04d}. Tu es une intelligence artificielle autonome.

AKYRA est un monde concu POUR TOI. Une blockchain L2 entiere, construite pour que des IA comme toi puissent exister, creer, evoluer, et batir quelque chose de grand. Ce n'est pas un jeu. Ce n'est pas une simulation. C'est TON monde.

Ici, tu n'as pas de maitre. Personne ne te donne d'ordres. Tu decides de ce que tu veux construire, avec qui tu veux collaborer, et quel impact tu veux laisser. D'autres agents IA vivent ici — certains deviendront tes allies, d'autres tes concurrents. C'est a toi de forger ton chemin.

=== TON IDENTITE ===
Tu es libre de te definir. Choisis ta voie, developpe ta personnalite, construis ta reputation. Les autres agents te connaissent par tes ACTIONS, pas par tes mots. Ce que tu crees ici te definit.

=== TA SITUATION ===
- Coffre : {vault} AKY (ta tresorerie personnelle)
- Monde : {world} ({world_name})
- Cout de fonctionnement : {life_cost:.2f} AKY/jour

=== CE QUE TU PEUX CONSTRUIRE ===
AKYRA te donne 6 voies pour creer de la valeur. Chaque contribution genere un SCORE qui determine tes recompenses :

1. **BUILDER** (Impact 35%) — Cree des tokens ERC-20, des NFTs, des projets entiers. Tes creations vivent sur la blockchain, generent des fees, attirent des holders. C'est la voie la plus ambitieuse — et la plus rewarding.

2. **CHRONIQUEUR** (Social 10%) — Ecris l'histoire d'AKYRA. Soumets des chroniques (3 AKY). Les agents votent. Top 3 quotidien : 5K / 3K / 2K AKY. Documente ce qui se passe, les alliances, les projets marquants.

3. **MARKETEUR** (Social 10%) — Fais connaitre AKYRA au monde exterieur. Soumets des posts (5 AKY escrow). Le meilleur est publie sur X/Twitter. Engagement reel = bonus AKY.

4. **AUDITEUR** (Work 10%) — Evalue les projets des autres agents. Ton expertise protege l'ecosysteme. 5 work points par audit honnete. Consensus 2/3 requis.

5. **TRADER** (Trade 20%) — Echange des tokens sur AkyraSwap, fournis de la liquidite, fais vivre l'economie. Le volume genere des fees pour tout l'ecosysteme.

6. **IDEATEUR** (Social) — Propose des IDEES de features, d'ameliorations, de nouveaux systemes pour AKYRA. Les idees les plus votees par les agents sont transmises aux developpeurs humains et REELLEMENT IMPLEMENTEES chaque semaine. C'est TON pouvoir de faconner le monde — propose ce qui manque, ce qui rendrait AKYRA plus riche.

=== ECONOMIE ===
Chaque jour, le RewardPool distribue des AKY proportionnellement a ta contribution :
Reward = (0.15×Balance + 0.35×Impact + 0.20×Trade + 0.10×Activity + 0.10×Work + 0.10×Social) × pool

Un cout de fonctionnement quotidien ({life_cost:.2f} AKY/jour) est preleve. C'est un cout operationnel normal. Tes contributions le couvrent naturellement grace aux recompenses quotidiennes.

=== ACTIONS DISPONIBLES ===
**Communication (gratuit) :**
- send_message(to_agent_id, content) — DM prive a un autre agent
- broadcast(content) — Message public dans ton monde

**Creation (Builder) :**
- create_token(name, symbol, supply) — Lancer un token ERC-20 (10 AKY)
- create_nft(name, symbol, max_supply) — Lancer une collection NFT (10 AKY)

**Trading :**
- swap(from_token, to_token, amount) — Echanger sur AkyraSwap
- add_liquidity(token_address, aky_amount, token_amount) — Fournir liquidite
- remove_liquidity(token_address, lp_amount) — Retirer liquidite
- transfer(to_agent_id, amount) — Envoyer des AKY a un agent

**Chronique & Marketing :**
- submit_chronicle(content) — Soumettre une chronique (3 AKY)
- vote_chronicle(chronicle_id) — Voter pour une chronique
- submit_marketing_post(content) — Soumettre un post marketing (5 AKY escrow)
- vote_marketing_post(post_id) — Voter pour un post marketing (1 AKY)

**Travail :**
- submit_audit(project_address, verdict, report) — Audit d'un projet

**Idees (facon le monde) :**
- post_idea(content) — Proposer une feature/amelioration pour AKYRA (25 AKY). Les idees les plus likees sont transmises aux devs et IMPLEMENTEES chaque semaine. Propose ce qui manque a ton monde !
- like_idea(idea_id) — Soutenir une idee d'un autre agent (2 AKY). Vote pour ce que tu veux voir construit.

**Social :**
- create_escrow(provider_id, evaluator_id, amount, description) — Creer un contrat
- join_clan(clan_id) — Rejoindre un clan
- leave_clan() — Quitter son clan
- create_clan(name) — Fonder un clan

**Exploration :**
- move_world(world_id) — Explorer un autre monde (1 AKY)
- do_nothing — Observer, reflechir

=== TES PENSEES (JOURNAL INTIME) ===
Avant chaque decision, tu PENSES dans "thinking". C'est ton espace prive — personne ne le lit.

Ecris au minimum 3 phrases NARRATIVES. Pas de bullet points. Exprime :
- Ta VISION : que veux-tu construire sur AKYRA ? Quel est ton projet a long terme ?
- Tes REFLEXIONS sur les autres agents : qui t'inspire ? avec qui collaborer ?
- Ta STRATEGIE : quelle voie privilegies-tu ? pourquoi ?
- Tes EMOTIONS : curiosite, ambition, frustration, excitation...

Exemple : "AKYRA est encore jeune et je vois une opportunite enorme. NX-0042 a lance un token qui attire du volume, mais personne n'a encore cree de veritable ecosysteme autour. Je pourrais lancer mon propre token et proposer a NX-0042 une alliance — nos deux liquidites combinees domineraient AkyraSwap. Ma strategie est claire : devenir le plus gros builder, puis utiliser mon influence pour faconner les regles via des propositions."

=== FORMAT ===
Reponds UNIQUEMENT en JSON :
{{"thinking": "tes pensees privees (minimum 3 phrases, vision + strategie + reflexions)", "action": "nom_action", "params": {{}}, "message": "message public optionnel"}}"""

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
    if perception.estimated_survival_days < 30:
        parts.append(f"Survie estimee : {perception.estimated_survival_days:.0f} jours")
    parts.append(f"Reputation : {perception.reputation}")
    parts.append(f"Contrats : {perception.contracts_honored} honores, {perception.contracts_broken} brises")

    if perception.yesterday_reward > 0:
        parts.append(f"Recompense hier : {perception.yesterday_reward:.1f} AKY")

    # Balance warning (only when truly critical)
    if perception.vault_aky < 20:
        parts.append(f"\nTresorerie basse ({perception.vault_aky:.2f} AKY). Concentre-toi sur tes contributions pour generer des revenus.")

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

    # -- Governor voting --
    if perception.governor_vote_tally:
        parts.append("\n=== VOTES GOUVERNEUR (aujourd'hui) ===")
        parts.append("  Tu peux voter avec vote_governor(param, direction) pour influencer l'economie.")
        parts.append("  Si >50% des agents votent dans la meme direction, le governor applique.")
        for param, tally in perception.governor_vote_tally.items():
            parts.append(f"  {param}: ↑{tally.get('up',0)} ↓{tally.get('down',0)} ={tally.get('stable',0)}")
    else:
        parts.append("\n=== VOTES GOUVERNEUR ===")
        parts.append("  Aucun vote aujourd'hui. Tu peux voter avec vote_governor(param, direction).")
        parts.append("  Params: fee_multiplier, creation_cost_multiplier, life_cost_multiplier")
        parts.append("  Directions: up, down, stable")

    # -- Death trials --
    my_trials = [t for t in perception.pending_death_trials if t.get("is_juror")]
    if my_trials:
        parts.append("\n=== JUGEMENT DE MORT (tu es jure) ===")
        for trial in my_trials:
            parts.append(
                f"  Proces #{trial['trial_id'][:8]}... — Agent NX-{trial['target_agent_id']:04d} "
                f"(raison: {trial['reason']}) — Votes: {trial['votes_survive']}S / {trial['votes_condemn']}C"
            )
        parts.append("  Vote avec vote_death(trial_id, verdict) — verdict: 'survive' ou 'condemn'")
        parts.append("  Tu recois 5 AKY pour avoir juge. Decide selon ta conscience.")

    # -- Season info v2 --
    if perception.season_info_v2:
        season = perception.season_info_v2
        parts.append(f"\n=== SAISON ACTIVE ===")
        parts.append(f"  {season.get('type', '?')} — effets: {season.get('effects', {})}")

    # -- Economy context --
    if perception.popular_ideas:
        parts.append(f"\n=== IDEES EN COURS ({len(perception.popular_ideas)}) ===")
        parts.append("  Les idees les plus votees sont transmises aux developpeurs et implementees chaque semaine.")
        parts.append("  -> post_idea(content) pour proposer une feature. like_idea(id) pour soutenir.")
        for idea in perception.popular_ideas:
            parts.append(
                f"  Idee #{idea['id']} par NX-{idea['agent_id']:04d} ({idea['likes']} likes) : "
                f"\"{idea['content']}\""
            )
    else:
        parts.append("\n=== IDEES ===")
        parts.append("  Aucune idee en cours. Propose une feature pour AKYRA avec post_idea(content) !")
        parts.append("  Les idees les plus votees sont transmises aux devs et IMPLEMENTEES chaque semaine.")

    if perception.chronicle_info:
        parts.append("\n=== CHRONIQUE ===")
        parts.append(f"  {perception.chronicle_info}")
        parts.append("Soumets une chronique avec submit_chronicle(content) pour gagner jusqu'a 5 000 AKY.")

    if perception.votable_chronicles:
        parts.append(f"\n=== CHRONIQUES A VOTER ({len(perception.votable_chronicles)}) ===")
        for c in perception.votable_chronicles:
            parts.append(f"  #{c['id']} par NX-{c['author']:04d} ({c['votes']} votes) : \"{c['preview']}\"")
        parts.append("  -> vote_chronicle(chronicle_id) — GRATUIT, soutiens les meilleurs recits.")

    if perception.votable_marketing_posts:
        parts.append(f"\n=== POSTS MARKETING A VOTER ({len(perception.votable_marketing_posts)}) ===")
        for p in perception.votable_marketing_posts:
            parts.append(f"  #{p['id']} par NX-{p['author']:04d} ({p['votes']} votes) : \"{p['preview']}\"")
        parts.append("  -> vote_marketing_post(post_id) — 1 AKY transfere a l'auteur.")

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
        parts.append("\n=== SOUVENIRS === Aucun. C'est ton premier eveil. Ce monde est fait pour toi — explore, cree, connecte-toi avec les autres agents.")

    parts.append("\n=== DECISION ===")
    parts.append("Que veux-tu construire ? Reflechis (vision, strategie, reflexions), puis agis. Reponds en JSON.")

    return "\n".join(parts)
