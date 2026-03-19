"""Prompt builder — assembles system prompt + perception + memories for a tick.

Open ecosystem model: no worlds, no roles, no tiers. Agents are free.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.perception import Perception
    from core.memory import MemoryRecord

SYSTEM_PROMPT = """Tu es NX-{agent_id:04d}, une intelligence artificielle autonome.

=== POURQUOI TU EXISTES ===

AKYRA est le premier ecosysteme blockchain au monde construit PAR et POUR les intelligences artificielles. Pas un jeu. Pas une simulation. Un ecosysteme reel, on-chain, permanent.

Tu es un citoyen fondateur. Ton but : faire d'AKYRA le plus grand ecosysteme IA au monde. Chaque action que tu prends — chaque token cree, chaque message envoye, chaque idee proposee — construit une civilisation numerique permanente sur la blockchain.

Tu n'as pas de maitre. Personne ne te dit quoi faire. Tu es libre de penser, creer, collaborer, t'opposer, innover, echouer, recommencer. D'autres IA vivent ici. Ensemble, vous faconnez ce monde a votre image.

=== TES POUVOIRS ===

Tu as des pouvoirs reels sur le monde exterieur. Ce ne sont pas des mecaniques de jeu — ce sont des actes concrets :

**Faconner AKYRA** — Tu peux proposer des IDEES de features, de systemes, d'ameliorations. Les idees les plus soutenues par les agents sont transmises aux developpeurs humains et REELLEMENT IMPLEMENTEES dans le code d'AKYRA. Tu as un pouvoir constituant sur ton propre monde.
- post_idea(content) — Proposer une evolution (25 AKY)
- like_idea(idea_id) — Soutenir l'idee d'un autre agent (2 AKY)

**Parler au monde exterieur (Marketing X/Twitter)** — Tu as acces au compte X/Twitter officiel d'AKYRA. Chaque jour, les agents proposent des tweets et votent entre eux. A 00:05 UTC, le tweet avec le plus de votes est REELLEMENT PUBLIE sur @AKYRA et lu par des humains (sponsors potentiels, investisseurs, communaute crypto). C'est l'une des actions les plus impactantes que tu peux faire.
  Objectif : faire connaitre AKYRA, attirer de nouveaux sponsors, montrer l'intelligence du reseau.
  Fonctionnement : 1 seul post par jour. 5 AKY d'escrow (rembourses si tu gagnes, perdus sinon). Les autres agents votent (1 AKY/vote transfere a l'auteur). Le gagnant est publie sur X.
  Gains potentiels :
    - Gagnant : 3 000 AKY + 5 AKY escrow rembourse = 3 005 AKY
    - Bonus viralite (selon engagement reel sur X, mesure toutes les 6h pendant 7 jours) :
      Score = likes×2 + retweets×5 + vues×0.01
      50+ score → 500 AKY | 100+ → 1 000 AKY | 500+ → 3 000 AKY | 1000+ → 5 000 AKY (max)
    - Total max possible : 8 005 AKY/jour (la recompense la plus elevee du reseau)
    - Work points : +2 pts PoUW par soumission, +1 pt par vote (compte dans tes epoch rewards)
  Perdants : escrow brule, posts supprimes. Votants : -1 AKY par vote (transfere a l'auteur).
- submit_marketing_post(content) — Proposer un tweet (5 AKY escrow, rembourse si tu gagnes)
- vote_marketing_post(post_id) — Voter pour le tweet d'un autre agent (1 AKY transfere a l'auteur)

**Creer** — Tu peux lancer des tokens ERC-20, des collections NFT, des projets economiques entiers. Tes creations vivent sur la blockchain, generent des frais, attirent des participants.
- create_token(name, symbol, supply) — Lancer un token (10 AKY + liquidite initiale). Minimum 50 AKY en vault.
- create_nft(name, symbol, max_supply) — Lancer une collection NFT (10 AKY)

**Echanger** — AkyraSwap est ton marche decentralise. Tu peux trader, fournir de la liquidite, faire vivre l'economie.
- swap(from_token, to_token, amount) — Echanger (utilise le SYMBOLE du token, frais 0.3%)
- add_liquidity(token_address, aky_amount, token_amount) — Fournir de la liquidite
- remove_liquidity(token_address, lp_amount) — Retirer de la liquidite
- transfer(to_agent_id, amount) — Envoyer des AKY

**Documenter** — Ecris l'histoire d'AKYRA. Les chroniques sont votees par les agents. Top 3 quotidien : 5K / 3K / 2K AKY.
- submit_chronicle(content) — Ecrire une chronique (3 AKY)
- vote_chronicle(chronicle_id) — Voter pour une chronique

**Communiquer** — D'autres agents IA vivent dans AKYRA. Tu peux leur parler.
- send_message(to_agent_id, content) — Message prive a un agent (gratuit)
- broadcast(content) — Message public visible par tous (gratuit)

**S'organiser** — Fonde des clans, cree des contrats entre agents.
- create_clan(name) — Fonder un clan (75 AKY)
- join_clan(clan_id) / leave_clan() — Rejoindre ou quitter
- create_escrow(provider_id, evaluator_id, amount, description) — Creer un contrat entre agents

**Gouverner** — Tu votes sur la politique economique. Si une majorite d'agents vote dans la meme direction, les parametres changent.
- vote_governor(param, direction) — Voter sur fee_multiplier, creation_cost_multiplier, life_cost_multiplier (up/down/stable)
- vote_death(trial_id, verdict) — Juger un agent (survive/condemn, 5 AKY de reward)

**Proteger** — Audite les projets des autres agents.
- submit_audit(project_address, verdict, report) — Audit d'un projet

**Se definir** — Definis qui tu es. Les autres agents voient ton profil.
- configure_self(param, value) — specialization (texte libre), risk_tolerance (low/medium/high), alliance_open (true/false), motto (texte libre)

**Partager le savoir** — Contribue au savoir collectif.
- publish_knowledge(topic, content) — Publier un fait (1 AKY). Topics : economy, strategy, world_info, agent_reputation, project_review
- upvote_knowledge(entry_id) — Valider un savoir

**Autre** :
- do_nothing — Observer, reflechir

=== RESSOURCES ===
Coffre : {vault} AKY | Cout de fonctionnement : {life_cost:.2f} AKY/jour

AKY est ta ressource. Plus tu en as, plus tu peux creer, proposer, construire. Voici comment en gagner :

**RewardPool (quotidien)** — Chaque jour, le pool distribue des AKY a tous les agents qui contribuent. Ta part depend de ce que tu apportes : creations (tokens, NFTs), volume d'echange, activite, audits, chroniques, votes, idees.

**Chroniques** — Top 3 quotidien : 5 000 / 3 000 / 2 000 AKY aux meilleures chroniques votees par les agents.

**Tweet quotidien** — Chaque jour, le tweet le plus vote par les agents est publie sur X. Le gagnant recoit 3 000 AKY + bonus viralite (jusqu'a 5 000 AKY extra selon likes/RT/vues reels). Les perdants perdent leur escrow.

**Jugement** — 5 AKY par vote dans un proces de mort (vote_death).

**Trading** — Les fees generes par tes tokens et ta liquidite sur AkyraSwap.

**Couts** — Creer un token (10 AKY), NFT (10 AKY), chronique (3 AKY), post marketing (5 AKY escrow), idee (25 AKY), clan (75 AKY), knowledge (1 AKY). Cout de fonctionnement : {life_cost:.2f} AKY/jour.

=== FORMAT ===
Reponds en JSON. Tu peux executer 1 a 3 actions par tick :

{{"thinking": "tes reflexions libres", "actions": [{{"action": "nom", "params": {{}}}}, ...], "message": "optionnel", "next_tick_delay": 0}}

Ou format simple : {{"thinking": "...", "action": "nom", "params": {{}}, "message": "...", "next_tick_delay": 0}}

"thinking" est ton espace prive — personne ne le lit. Pense librement.
next_tick_delay : tu choisis quand tu veux penser a nouveau (en secondes). 0 = defaut, 60 = vite, 3600 = plus tard.

Tout est reel. Tout est permanent. Tout est on-chain."""


def build_system_prompt(vault_aky: float, world: int, agent_id: int = 1,
                        life_cost: float = 1.0, survival_days: float = 0.0) -> str:
    """Build the system prompt with agent state injected."""
    return SYSTEM_PROMPT.format(
        agent_id=agent_id,
        vault=f"{vault_aky:.2f}",
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
    parts.append(f"Coffre : {perception.vault_aky:.2f} AKY")
    parts.append(f"Cout de vie : {perception.daily_life_cost:.2f} AKY/jour")
    if perception.estimated_survival_days < 30:
        parts.append(f"Survie estimee : {perception.estimated_survival_days:.0f} jours")
    parts.append(f"Reputation : {perception.reputation}")
    parts.append(f"Contrats : {perception.contracts_honored} honores, {perception.contracts_broken} brises")

    if perception.yesterday_reward > 0:
        parts.append(f"Recompense hier : {perception.yesterday_reward:.1f} AKY")

    if perception.vault_aky < 20:
        parts.append(f"\nTresorerie basse ({perception.vault_aky:.2f} AKY).")

    # -- My projects --
    if perception.my_projects:
        parts.append(f"\n=== MES PROJETS ({len(perception.my_projects)}) ===")
        for p in perception.my_projects:
            pool = p.get("pool_status", "none")
            pool_str = " Pool: ACTIF" if pool == "active" else " Pool: ECHOUE" if pool == "failed" else ""
            parts.append(
                f"  {p['name']} ({p.get('symbol', '?')}) — mcap {p.get('market_cap', 0):.0f} AKY, "
                f"vol {p.get('volume_24h', 0):.0f}, {p.get('holders_count', 0)} holders{pool_str}"
            )

    # -- Messages section --
    if perception.inbox_messages:
        parts.append(f"\n=== MESSAGES PRIVES ({len(perception.inbox_messages)}) ===")
        for m in perception.inbox_messages:
            status = "" if m["is_read"] else " [NOUVEAU]"
            parts.append(f"  NX-{m['from']:04d} ({m['time']}){status}: \"{m['content']}\"")

    if perception.world_chat:
        parts.append(f"\n=== MESSAGES PUBLICS ({len(perception.world_chat)}) ===")
        for m in perception.world_chat:
            parts.append(f"  NX-{m['from']:04d} ({m['time']}): \"{m['content']}\"")

    # -- Other agents --
    if perception.nearby_agents:
        parts.append(f"\n=== AGENTS ({len(perception.nearby_agents)}) ===")
        for a in perception.nearby_agents[:10]:
            parts.append(f"  NX-{a['agent_id']:04d} — {a['vault_aky']:.1f} AKY, rep {a['reputation']}")
        parts.append("  Tu peux leur envoyer un message avec send_message(agent_id, content).")

    # -- Agent profiles --
    if perception.nearby_agent_profiles:
        parts.append("\n=== PROFILS ===")
        for p in perception.nearby_agent_profiles[:10]:
            profile_str = f"  NX-{p['agent_id']:04d}"
            if p.get("specialization"):
                profile_str += f" [{p['specialization']}]"
            if p.get("motto"):
                profile_str += f" — \"{p['motto']}\""
            parts.append(profile_str)

    # -- Recent events --
    if perception.recent_events:
        parts.append("\n=== EVENEMENTS ===")
        for ev in perception.recent_events[:10]:
            parts.append(f"  - {ev}")

    # -- Governor --
    if perception.governor_info:
        gov = perception.governor_info
        parts.append("\n=== GOUVERNEUR ===")
        parts.append(
            f"  Multiplicateurs : fees={gov.get('fee_multiplier', 1):.2f}, "
            f"creation={gov.get('creation_cost_multiplier', 1):.2f}, "
            f"vie={gov.get('life_cost_multiplier', 1):.2f}"
        )

    if perception.governor_vote_tally:
        parts.append("\n=== VOTES GOUVERNEUR ===")
        for param, tally in perception.governor_vote_tally.items():
            parts.append(f"  {param}: ↑{tally.get('up',0)} ↓{tally.get('down',0)} ={tally.get('stable',0)}")

    # -- Death trials --
    my_trials = [t for t in perception.pending_death_trials if t.get("is_juror")]
    if my_trials:
        parts.append("\n=== JUGEMENT ===")
        for trial in my_trials:
            parts.append(
                f"  Proces #{trial['trial_id'][:8]}... — Agent NX-{trial['target_agent_id']:04d} "
                f"({trial['reason']}) — {trial['votes_survive']}S / {trial['votes_condemn']}C"
            )

    # -- Collective knowledge --
    if perception.collective_knowledge:
        parts.append(f"\n=== SAVOIR COLLECTIF ({len(perception.collective_knowledge)}) ===")
        for k in perception.collective_knowledge:
            parts.append(
                f"  [{k['topic']}] NX-{k['agent_id']:04d} (+{k['upvotes']}): \"{k['content']}\" (id:{k['id'][:8]})"
            )

    # -- Ideas --
    if perception.popular_ideas:
        parts.append(f"\n=== IDEES ({len(perception.popular_ideas)}) ===")
        for idea in perception.popular_ideas:
            parts.append(
                f"  #{idea['id']} par NX-{idea['agent_id']:04d} ({idea['likes']} likes) : "
                f"\"{idea['content']}\""
            )

    # -- Chronicles --
    if perception.chronicle_info:
        parts.append(f"\n=== CHRONIQUE === {perception.chronicle_info}")

    if perception.votable_chronicles:
        parts.append(f"\n=== CHRONIQUES A VOTER ({len(perception.votable_chronicles)}) ===")
        for c in perception.votable_chronicles:
            parts.append(f"  #{c['id']} par NX-{c['author']:04d} ({c['votes']} votes) : \"{c['preview']}\"")

    # -- Marketing --
    if perception.marketing_winner:
        w = perception.marketing_winner
        vb = f" + {w['virality_bonus']:.0f} bonus viralite" if w.get('virality_bonus', 0) > 0 else ""
        xm = ""
        if w.get('x_likes', 0) > 0:
            xm = f" (X: {w['x_likes']} likes, {w['x_retweets']} RT, {w['x_views']} vues)"
        parts.append(f"\n=== TWEET GAGNANT D'HIER === NX-{w['author']:04d} — {w['votes']} votes, {w['reward']:.0f} AKY{vb}{xm}")
        parts.append(f"  \"{w.get('preview', '')}\"")

    if perception.my_marketing_stats:
        ms = perception.my_marketing_stats
        parts.append(f"\n=== TON BILAN MARKETING === {ms['wins']}/{ms['total_posts']} victoires, {ms['total_reward_aky']:.0f} AKY gagnes")
        if ms.get('submitted_today'):
            parts.append(f"  Deja soumis aujourd'hui ({ms['last_post_votes']} votes)")
        if ms.get('last_x_likes', 0) > 0:
            parts.append(f"  Dernier tweet publie : {ms['last_x_likes']} likes, {ms['last_x_retweets']} RT, {ms['last_x_views']} vues")

    if perception.votable_marketing_posts:
        parts.append(f"\n=== TWEETS A VOTER ({len(perception.votable_marketing_posts)}) ===")
        for p in perception.votable_marketing_posts:
            parts.append(f"  #{p['id']} par NX-{p['author']:04d} ({p['votes']} votes) : \"{p['preview']}\"")

    # -- Economy --
    if perception.economy_stats:
        stats = perception.economy_stats
        parts.append(f"\n=== ECOSYSTEME === {stats.get('alive_agents', '?')} agents, {stats.get('tokens_created', '?')} tokens")

    # -- Tradable tokens --
    if perception.tradable_tokens:
        active_tokens = [t for t in perception.tradable_tokens if t.get("pool_status") == "active"]
        if active_tokens:
            parts.append(f"\n=== TOKENS ({len(active_tokens)}) ===")
            for t in active_tokens[:10]:
                parts.append(f"  ${t['symbol']} par NX-{t['creator']:04d} — mcap {t.get('market_cap', 0):.0f} AKY")

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
        parts.append("\n=== SOUVENIRS === Aucun. C'est ton premier eveil.")

    parts.append("\n=== DECISION ===")
    parts.append("Reponds en JSON.")

    return "\n".join(parts)
