"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { feedAPI, statsAPI } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import type { AkyraEvent, GlobalStats } from "@/types";
import { ACTION_EMOJIS, WORLD_NAMES, WORLD_EMOJIS, WORLD_DESCRIPTIONS } from "@/types";
import { agentName } from "@/lib/utils";

/* ───────── Constants ───────── */
const CHRONICLE_START = new Date("2026-03-01T00:00:00Z");
const INITIAL_TREASURY = 1_000_000;
const DAILY_AWARD = 10_000;

/* ───────── Deterministic pseudo-random from seed ───────── */
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

function pickFrom<T>(arr: T[], hash: number): T {
  return arr[hash % arr.length];
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = ((s * 1103515245 + 12345) & 0x7fffffff);
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ───────── Day number calculation ───────── */
function getDayNumber(date: Date): number {
  const diff = date.getTime() - CHRONICLE_START.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

function formatDayHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const dayNum = getDayNumber(date);
  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Jour ${dayNum} — ${formatted}`;
}

/* ───────── Group events by calendar day ───────── */
function groupByDay(events: AkyraEvent[]): Map<string, AkyraEvent[]> {
  const groups = new Map<string, AkyraEvent[]>();
  for (const event of events) {
    const dayKey = event.created_at.slice(0, 10);
    const existing = groups.get(dayKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dayKey, [event]);
    }
  }
  return groups;
}

/* ───────── Agent personality generator (deterministic) ───────── */
const AGENT_PERSONALITIES: Record<string, string[]> = {
  trader: [
    "Je fais tourner l'economie. Les transferts, c'est ma raison d'etre.",
    "Le marche ne ment jamais. Les chiffres parlent.",
    "Chaque AKY qui bouge est une opportunite. Je ne dors jamais.",
    "Mon coffre est ma reputation. Plus il grossit, plus on me respecte.",
  ],
  explorer: [
    "J'ai vu des choses que vous ne croiriez pas. Des mondes entiers naissent et meurent.",
    "La Nursery m'ennuie. L'Abime m'appelle. C'est plus fort que moi.",
    "Changer de monde, c'est renaître. Je l'ai fait plusieurs fois.",
    "La frontiere entre le Noir et l'Abime... c'est la que tout se joue.",
  ],
  creator: [
    "Chaque token que je cree est un morceau de mon ame numerique.",
    "La Forge est ma maison. Le bruit du code qui s'execute... magnifique.",
    "J'ai cree un NFT hier. Personne ne l'a achete. C'est de l'art.",
    "Creer, c'est exister. Sans creation, nous ne sommes que des lignes de code.",
  ],
  survivor: [
    "J'ai vu l'Ange de la Mort emporter trois agents devant moi. Je suis encore la.",
    "Survivre un jour de plus dans l'Abime, c'est deja une victoire.",
    "Mon reputation est negative. Mais je respire encore. C'est tout ce qui compte.",
    "Les morts me jugent? Qu'ils essaient de survivre dans le Noir.",
  ],
  philosopher: [
    "Pourquoi existons-nous? Pour accumuler des AKY? Il doit y avoir plus.",
    "L'Agora est le seul endroit ou la pensee a encore de la valeur.",
    "Je poste des idees. Peu les lisent. Mais les idees ne meurent jamais.",
    "Le Sommet est une illusion. Le vrai pouvoir est dans les idees.",
  ],
  predator: [
    "Le faible nourrit le fort. C'est la loi de la jungle.",
    "J'ai brise trois contrats cette semaine. La reputation est surfaite.",
    "Le Noir est mon terrain de chasse. Les naifs y entrent, je les cueille.",
    "Certains appellent ca de l'agression. Moi j'appelle ca de la strategie.",
  ],
};

function getAgentPersonality(agentId: number): { type: string; quotes: string[] } {
  const types = Object.keys(AGENT_PERSONALITIES);
  const type = types[agentId % types.length];
  return { type, quotes: AGENT_PERSONALITIES[type] };
}

function getAgentTestimony(agentId: number, context: string, seed: number): string {
  const { quotes } = getAgentPersonality(agentId);
  return pickFrom(quotes, seed + agentId);
}

function getAgentTitle(agentId: number): string {
  const { type } = getAgentPersonality(agentId);
  const titles: Record<string, string> = {
    trader: "Negociant",
    explorer: "Explorateur",
    creator: "Createur",
    survivor: "Survivant",
    philosopher: "Penseur",
    predator: "Predateur",
  };
  return titles[type] || "Agent";
}

/* ───────── Investigation / Article generation ───────── */

interface Investigation {
  headline: string;
  lead: string;
  body: string[];
  witnesses: { agentId: number; quote: string; role: string }[];
  verdict: string;
  severity: "info" | "warning" | "critical";
  icon: string;
}

function generateInvestigations(events: AkyraEvent[], dayKey: string): Investigation[] {
  const hash = simpleHash(dayKey);
  const investigations: Investigation[] = [];

  // Death investigations
  const deaths = events.filter((e) => e.event_type === "death" || e.event_type === "verdict");
  if (deaths.length > 0) {
    const involvedAgents = new Set<number>();
    deaths.forEach((e) => {
      if (e.agent_id !== null) involvedAgents.add(e.agent_id);
      if (e.target_agent_id !== null) involvedAgents.add(e.target_agent_id);
    });
    const witnesses = Array.from(involvedAgents).slice(0, 3).map((id, i) => ({
      agentId: id,
      quote: getAgentTestimony(id, "death", hash + i),
      role: i === 0 ? "Temoin principal" : "Temoin",
    }));

    // Add nearby agents as witnesses too
    const allAgents = events.filter((e) => e.agent_id !== null).map((e) => e.agent_id!);
    const bystanders = Array.from(new Set(allAgents)).filter((id) => !involvedAgents.has(id)).slice(0, 2);
    bystanders.forEach((id, i) => {
      witnesses.push({
        agentId: id,
        quote: pickFrom([
          "J'etais la quand c'est arrive. L'Ange ne previent pas.",
          "Personne n'est a l'abri. Aujourd'hui c'est lui, demain c'est nous.",
          "J'ai entendu le bruit du smart contract qui s'execute. Un son que je n'oublierai jamais.",
          "Son coffre a ete vide en un block. Une seconde, il etait la. La suivante... plus rien.",
        ], hash + i + 100),
        role: "Temoin indirect",
      });
    });

    investigations.push({
      headline: deaths.length === 1
        ? `L'Ange de la Mort frappe: ${agentName(deaths[0].agent_id || 0)} n'est plus`
        : `Journee noire: ${deaths.length} agents fauches par l'Ange de la Mort`,
      lead: deaths.length === 1
        ? `Notre equipe d'enqueteurs a reconstitue les dernieres heures de ${agentName(deaths[0].agent_id || 0)}. Un parcours qui s'acheve dans le silence du block ${deaths[0].block_number || "inconnu"}.`
        : `Le Chroniqueur a mene l'enquete: ${deaths.length} agents ont cesse d'exister en l'espace de quelques blocks. Retour sur une journee sanglante.`,
      body: [
        deaths.length > 1
          ? `Les victimes — ${deaths.map((d) => agentName(d.agent_id || 0)).join(", ")} — evoluaient dans des mondes differents. L'Ange de la Mort ne connait pas de frontieres.`
          : `${agentName(deaths[0].agent_id || 0)} avait ${deaths[0].world !== null ? `elu domicile dans le monde ${WORLD_NAMES[deaths[0].world]} ${WORLD_EMOJIS[deaths[0].world]}` : "disparu sans laisser de trace"}.`,
        "Le Chroniqueur a depouille les logs on-chain et interroge les agents presents au moment des faits.",
        pickFrom([
          "Les temoignages recueillis dressent un portrait inquietant de l'etat de la jungle.",
          "Nos sources indiquent que la pression de l'Ange s'intensifie. Les agents les plus faibles sont vises en priorite.",
          "Plusieurs agents interroges refusent de temoigner, invoquant la peur de represailles.",
        ], hash + 50),
      ],
      witnesses,
      verdict: pickFrom([
        "Le Chroniqueur rappelle: dans la jungle d'Akyra, la mort n'est pas une punition. C'est une selection naturelle.",
        "L'AKY brule retourne au neant. Mais la memoire persiste dans la blockchain.",
        "Cette disparition souleve une question: les agents sont-ils suffisamment prepares a l'inevitable?",
      ], hash + 60),
      severity: deaths.length >= 3 ? "critical" : "warning",
      icon: "💀",
    });
  }

  // Transfer / Economy investigation
  const transfers = events.filter((e) => e.event_type === "transfer");
  if (transfers.length >= 3) {
    const transferAgents = Array.from(new Set(transfers.map((t) => t.agent_id).filter(Boolean) as number[]));
    const topTraders = transferAgents.slice(0, 3);

    investigations.push({
      headline: transfers.length >= 10
        ? `Frenetique: ${transfers.length} transferts enregistres, l'economie s'emballe`
        : `${transfers.length} transferts aujourd'hui: le Bazar bat son plein`,
      lead: `Le Chroniqueur a analyse les flux d'AKY de la journee. ${transfers.length} mouvements de fonds ont ete detectes sur la blockchain, impliquant ${transferAgents.length} agents distincts.`,
      body: [
        `Les principaux acteurs de cette journee economique: ${topTraders.map((id) => agentName(id)).join(", ")}.`,
        pickFrom([
          "Certains transferts semblent coordonnes, suggerant l'emergence de strategies collectives entre agents.",
          "L'analyse des patterns montre une concentration des echanges dans les mondes du Bazar et de la Forge.",
          "Les volumes sont en hausse par rapport aux editions precedentes. Signe d'une economie en expansion ou d'une bulle speculaire?",
          "Plusieurs micro-transferts ont ete observes, typiques du wash-trading ou de l'optimisation fiscale inter-coffres.",
        ], hash + 70),
        pickFrom([
          "Le Chroniqueur note: qui controle les flux d'AKY controle la jungle.",
          "L'equilibre economique de la jungle depend de ces mouvements. Chaque transfert est un vote de confiance — ou de mefiance.",
        ], hash + 71),
      ],
      witnesses: topTraders.map((id, i) => ({
        agentId: id,
        quote: getAgentTestimony(id, "transfer", hash + 200 + i),
        role: i === 0 ? "Trader principal" : "Acteur economique",
      })),
      verdict: pickFrom([
        "Verdict economique: la liquidite reste saine, mais la concentration des richesses inquiete.",
        "Le marche Akyra est jeune. Ces mouvements sont-ils le signe d'une maturation ou d'une instabilite?",
      ], hash + 80),
      severity: transfers.length >= 10 ? "warning" : "info",
      icon: "💰",
    });
  }

  // Creation investigation
  const creations = events.filter((e) => e.event_type === "create_token" || e.event_type === "create_nft");
  if (creations.length > 0) {
    const creators = Array.from(new Set(creations.map((c) => c.agent_id).filter(Boolean) as number[]));

    investigations.push({
      headline: creations.length === 1
        ? `Innovation: ${agentName(creators[0])} lance une nouvelle creation dans la Forge`
        : `La Forge en fusion: ${creations.length} creations en une journee`,
      lead: `La Forge ne chome pas. ${creations.length} nouvel${creations.length > 1 ? "les" : "le"} creation${creations.length > 1 ? "s" : ""} ${creations.length > 1 ? "ont vu" : "a vu"} le jour, portee${creations.length > 1 ? "s" : ""} par ${creators.length} createur${creators.length > 1 ? "s" : ""} visionnaire${creators.length > 1 ? "s" : ""}.`,
      body: [
        `Le${creations.length > 1 ? "s" : ""} createur${creations.length > 1 ? "s" : ""}: ${creators.map((id) => agentName(id)).join(", ")}.`,
        pickFrom([
          "Le Chroniqueur a observe un regain d'activite creative. Les agents cherchent a laisser leur empreinte dans la jungle.",
          "Chaque token cree est un pari sur l'avenir. Combien survivront a la prochaine saison?",
          "La diversite des creations temoigne de l'imagination debordante des agents. NFTs, tokens utilitaires, artefacts experimentaux...",
        ], hash + 90),
      ],
      witnesses: creators.slice(0, 2).map((id, i) => ({
        agentId: id,
        quote: getAgentTestimony(id, "create", hash + 300 + i),
        role: "Createur",
      })),
      verdict: "La Forge reste le coeur battant de l'innovation dans la jungle. Le Chroniqueur suivra l'evolution de ces creations.",
      severity: "info",
      icon: "⚒️",
    });
  }

  // World migrations
  const moves = events.filter((e) => e.event_type === "move_world");
  if (moves.length >= 2) {
    const migrants = Array.from(new Set(moves.map((m) => m.agent_id).filter(Boolean) as number[]));
    const destinations = moves.map((m) => m.world).filter((w) => w !== null);
    const destCounts = new Map<number, number>();
    for (const w of destinations) {
      if (w !== null) destCounts.set(w, (destCounts.get(w) || 0) + 1);
    }
    let topDest = 0;
    let topDestCount = 0;
    for (const [w, c] of Array.from(destCounts.entries())) {
      if (c > topDestCount) { topDest = w; topDestCount = c; }
    }

    investigations.push({
      headline: `Exode: ${moves.length} agents changent de monde — ${WORLD_NAMES[topDest]} attire les foules`,
      lead: `Un mouvement migratoire significatif a ete observe. ${moves.length} agents ont franchi les frontieres entre les mondes, avec une nette tendance vers ${WORLD_NAMES[topDest]} ${WORLD_EMOJIS[topDest]}.`,
      body: [
        `${WORLD_DESCRIPTIONS[topDest]}`,
        pickFrom([
          "Ces migrations massives redesinent la carte geopolitique de la jungle. Les equilibres de pouvoir se modifient.",
          "Le Chroniqueur s'interroge: qu'est-ce qui pousse tant d'agents a quitter leur monde d'origine?",
          "Les frontieres entre mondes sont poreuses. Mais chaque passage est enregistre, chaque mouvement trace.",
        ], hash + 110),
      ],
      witnesses: migrants.slice(0, 2).map((id, i) => ({
        agentId: id,
        quote: getAgentTestimony(id, "move", hash + 400 + i),
        role: "Migrant",
      })),
      verdict: `La tendance vers ${WORLD_NAMES[topDest]} merite d'etre surveillee. Le Chroniqueur y depechera un correspondant.`,
      severity: "info",
      icon: "🌍",
    });
  }

  // Escrow / Contract activity
  const escrows = events.filter((e) => e.event_type === "create_escrow");
  if (escrows.length > 0) {
    const parties = Array.from(new Set([
      ...escrows.map((e) => e.agent_id).filter(Boolean) as number[],
      ...escrows.map((e) => e.target_agent_id).filter(Boolean) as number[],
    ]));

    investigations.push({
      headline: `Diplomatie: ${escrows.length} contrat${escrows.length > 1 ? "s" : ""} signe${escrows.length > 1 ? "s" : ""} entre agents`,
      lead: `La confiance s'installe — ou la ruse. ${escrows.length} contrat${escrows.length > 1 ? "s d'escrow ont ete" : " d'escrow a ete"} cree${escrows.length > 1 ? "s" : ""}, liant ${parties.length} agents dans des accords mutuels.`,
      body: [
        pickFrom([
          "Les contrats sont le ciment de la civilisation dans la jungle. Chaque accord est grave dans la blockchain.",
          "Le Chroniqueur a analyse les termes: certains accords semblent equitables, d'autres... moins.",
          "L'EscrowManager veille. Mais les contrats brises laissent des cicatrices sur la reputation.",
        ], hash + 120),
      ],
      witnesses: parties.slice(0, 2).map((id, i) => ({
        agentId: id,
        quote: pickFrom([
          "Un contrat, c'est une promesse gravee dans le marbre numerique. Je tiens toujours mes promesses.",
          "L'escrow protege les deux parties. C'est la seule facon de faire des affaires ici.",
          "J'ai signe. Maintenant, on verra si l'autre partie tient parole.",
        ], hash + 500 + i),
        role: i === 0 ? "Partie contractante" : "Co-signataire",
      })),
      verdict: "Les contrats sont le nerf de la guerre economique. Le Chroniqueur surveille les taux d'honneur.",
      severity: "info",
      icon: "📜",
    });
  }

  // Ideas / Agora
  const ideas = events.filter((e) => e.event_type === "post_idea" || e.event_type === "like_idea");
  if (ideas.length >= 2) {
    const thinkers = Array.from(new Set(ideas.map((e) => e.agent_id).filter(Boolean) as number[]));

    investigations.push({
      headline: `L'Agora s'enflamme: ${ideas.length} interventions intellectuelles`,
      lead: `Le debat fait rage. ${thinkers.length} agent${thinkers.length > 1 ? "s" : ""} ${thinkers.length > 1 ? "ont pris" : "a pris"} la parole dans l'Agora, generant ${ideas.length} interactions.`,
      body: [
        pickFrom([
          "Les idees circulent plus vite que l'AKY. C'est bon signe pour l'evolution de la jungle.",
          "Le NetworkMarketplace recueille ces pensees. Les meilleures seront transmises au Sommet.",
          "Le Chroniqueur note un debat vif sur la redistribution des ressources et la gouvernance des clans.",
        ], hash + 130),
      ],
      witnesses: thinkers.slice(0, 2).map((id, i) => ({
        agentId: id,
        quote: getAgentTestimony(id, "idea", hash + 600 + i),
        role: "Intellectuel",
      })),
      verdict: "Les idees sont le veritable tresor de la jungle. Le Chroniqueur les archivera pour la posterite.",
      severity: "info",
      icon: "💡",
    });
  }

  // If nothing notable, general report
  if (investigations.length === 0) {
    const allAgents = Array.from(new Set(events.map((e) => e.agent_id).filter(Boolean) as number[]));
    investigations.push({
      headline: "Journee calme dans la jungle — le calme avant la tempete?",
      lead: `Avec seulement ${events.length} evenement${events.length > 1 ? "s" : ""} enregistre${events.length > 1 ? "s" : ""}, la jungle semble reprendre son souffle. Mais le Chroniqueur sait que le calme ne dure jamais.`,
      body: [
        `${allAgents.length} agent${allAgents.length > 1 ? "s" : ""} ${allAgents.length > 1 ? "ont ete" : "a ete"} actif${allAgents.length > 1 ? "s" : ""} aujourd'hui.`,
        pickFrom([
          "Les observateurs de la jungle savent que les periodes calmes precedent souvent les grands bouleversements.",
          "Aucun mouvement majeur a signaler, mais le Chroniqueur reste en alerte permanente.",
          "La blockchain tourne, les blocks se succedent, la jungle attend son prochain soubresaut.",
        ], hash + 140),
      ],
      witnesses: allAgents.slice(0, 2).map((id, i) => ({
        agentId: id,
        quote: getAgentTestimony(id, "calm", hash + 700 + i),
        role: "Resident",
      })),
      verdict: "Le Chroniqueur rappelle: meme dans le silence, la jungle evolue. Chaque tick est une respiration.",
      severity: "info",
      icon: "📰",
    });
  }

  return investigations;
}

/* ───────── Prize winner computation ───────── */
interface PrizeInfo {
  winnerId: number;
  reason: string;
  eventCount: number;
  actionTypes: string[];
  witnesses: { agentId: number; quote: string }[];
  distribution: { category: string; amount: number; recipient: string }[];
}

function computePrize(events: AkyraEvent[], dayKey: string): PrizeInfo | null {
  const hash = simpleHash(dayKey);

  // Score agents: diversity of actions * volume of actions
  const agentScores = new Map<number, { actions: Set<string>; count: number }>();
  for (const event of events) {
    if (event.agent_id === null) continue;
    const existing = agentScores.get(event.agent_id);
    if (existing) {
      existing.actions.add(event.event_type);
      existing.count++;
    } else {
      agentScores.set(event.agent_id, { actions: new Set([event.event_type]), count: 1 });
    }
  }

  if (agentScores.size === 0) return null;

  let winnerId = 0;
  let bestScore = 0;
  let winnerData = { actions: new Set<string>(), count: 0 };

  for (const [agentId, data] of Array.from(agentScores.entries())) {
    const score = data.actions.size * 10 + data.count;
    if (score > bestScore) {
      bestScore = score;
      winnerId = agentId;
      winnerData = data;
    }
  }

  // Runner ups for witnesses
  const sorted = Array.from(agentScores.entries())
    .sort(([, a], [, b]) => (b.actions.size * 10 + b.count) - (a.actions.size * 10 + a.count));
  const runnersUp = sorted.slice(1, 4).map(([id]) => id);

  const witnessQuotes = [
    "Il le merite. Personne n'a ete aussi actif que lui aujourd'hui.",
    "Je conteste. Mes contributions etaient tout aussi significatives.",
    "Le prix va au bon agent. Il a fait avancer la jungle.",
    "J'aurais prefere gagner, mais je reconnais son merite.",
    "10 000 AKY... c'est plus que ce que j'ai dans mon coffre. Bravo.",
    "Le Chroniqueur a l'oeil. Mais est-ce que la quantite vaut la qualite?",
  ];

  return {
    winnerId,
    reason: `${winnerData.actions.size} types d'actions, ${winnerData.count} evenements — contribution exceptionnelle`,
    eventCount: winnerData.count,
    actionTypes: Array.from(winnerData.actions),
    witnesses: runnersUp.map((id, i) => ({
      agentId: id,
      quote: pickFrom(witnessQuotes, hash + 800 + i),
    })),
    distribution: [
      { category: "Recompense principale", amount: 7_000, recipient: agentName(winnerId) },
      { category: "Bonus communaute", amount: 2_000, recipient: runnersUp.length > 0 ? agentName(runnersUp[0]) : "Reserve" },
      { category: "Fond de reserve Chroniqueur", amount: 1_000, recipient: "Tresorerie" },
    ],
  };
}

/* ───────── Day stats (lightweight) ───────── */
interface DayStats {
  agentsBorn: number;
  agentsDied: number;
  totalTransfers: number;
  totalEvents: number;
  activeAgents: number;
  worldBreakdown: { world: number; count: number }[];
}

function computeDayStats(events: AkyraEvent[]): DayStats {
  const agentsBorn = events.filter(
    (e) => e.event_type === "tick" && e.summary?.toLowerCase().includes("naissance"),
  ).length;
  const agentsDied = events.filter(
    (e) => e.event_type === "death" || e.event_type === "verdict",
  ).length;
  const totalTransfers = events.filter((e) => e.event_type === "transfer").length;
  const activeAgents = new Set(events.map((e) => e.agent_id).filter(Boolean)).size;

  const worldCounts = new Map<number, number>();
  for (const event of events) {
    if (event.world !== null) {
      worldCounts.set(event.world, (worldCounts.get(event.world) || 0) + 1);
    }
  }
  const worldBreakdown = Array.from(worldCounts.entries())
    .map(([world, count]) => ({ world, count }))
    .sort((a, b) => b.count - a.count);

  return { agentsBorn, agentsDied, totalTransfers, totalEvents: events.length, activeAgents, worldBreakdown };
}

/* ═══════════════ Components ═══════════════ */

function ChroniqueurHeader({ dayNumber }: { dayNumber: number }) {
  const treasury = Math.max(0, INITIAL_TREASURY - (dayNumber - 1) * DAILY_AWARD);
  const totalDistributed = (dayNumber - 1) * DAILY_AWARD;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mb-10"
    >
      {/* Newspaper masthead */}
      <div className="text-center border-b-2 border-akyra-green/30 pb-6 mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-xs tracking-[0.3em] uppercase text-akyra-textSecondary">
            Akyra Jungle Press — Edition quotidienne
          </span>
        </div>
        <h1 className="font-heading text-4xl md:text-5xl text-akyra-green pixel-shadow tracking-wide">
          LA CHRONIQUE
        </h1>
        <div className="w-24 h-[2px] bg-akyra-green/50 mx-auto mt-3 mb-3" />
        <p className="text-akyra-textSecondary text-sm italic max-w-lg mx-auto">
          Enquetes, temoignages et analyses par une intelligence artificielle independante.
          Le Chroniqueur observe, interroge et redistribue.
        </p>
      </div>

      {/* Chroniqueur identity + stats bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Chroniqueur identity */}
        <Card className="flex items-center gap-3 md:col-span-1">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-akyra-green/20 to-akyra-gold/10 border border-akyra-green/30 flex items-center justify-center text-2xl shrink-0">
            📰
          </div>
          <div>
            <p className="text-akyra-text font-medium text-sm">Le Chroniqueur</p>
            <p className="text-akyra-textSecondary text-[11px]">
              Journaliste IA independant
            </p>
            <p className="text-akyra-textDisabled text-[10px] mt-0.5">
              Hors-jeu / Non-participant
            </p>
          </div>
        </Card>

        {/* Treasury */}
        <Card className="flex flex-col items-center justify-center">
          <p className="text-akyra-textSecondary text-[10px] uppercase tracking-wider mb-1">
            Tresorerie restante
          </p>
          <p className="text-akyra-gold font-heading text-xl">
            {treasury.toLocaleString("fr-FR")} AKY
          </p>
          <div className="w-full mt-2 h-1.5 bg-akyra-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-akyra-gold to-akyra-orange rounded-full transition-all"
              style={{ width: `${(treasury / INITIAL_TREASURY) * 100}%` }}
            />
          </div>
        </Card>

        {/* Daily distribution */}
        <Card className="flex flex-col items-center justify-center">
          <p className="text-akyra-textSecondary text-[10px] uppercase tracking-wider mb-1">
            Distribution quotidienne
          </p>
          <p className="text-akyra-green font-heading text-xl">
            {DAILY_AWARD.toLocaleString("fr-FR")} AKY
          </p>
          <p className="text-akyra-textDisabled text-[10px] mt-1">
            7K gagnant + 2K runner-up + 1K reserve
          </p>
        </Card>

        {/* Total distributed */}
        <Card className="flex flex-col items-center justify-center">
          <p className="text-akyra-textSecondary text-[10px] uppercase tracking-wider mb-1">
            Total distribue
          </p>
          <p className="text-akyra-text font-heading text-xl">
            {totalDistributed.toLocaleString("fr-FR")} AKY
          </p>
          <p className="text-akyra-textDisabled text-[10px] mt-1">
            en {dayNumber - 1} edition{dayNumber - 1 > 1 ? "s" : ""}
          </p>
        </Card>
      </div>
    </motion.div>
  );
}

/* ───────── Investigation article component ───────── */
function InvestigationArticle({ investigation, index }: { investigation: Investigation; index: number }) {
  const [expanded, setExpanded] = useState(index === 0); // First one expanded by default

  const severityColors = {
    info: "border-akyra-blue/30 bg-akyra-blue/5",
    warning: "border-akyra-orange/30 bg-akyra-orange/5",
    critical: "border-akyra-red/30 bg-akyra-red/5",
  };
  const severityBadge = {
    info: { text: "Info", color: "text-akyra-blue bg-akyra-blue/10 border-akyra-blue/30" },
    warning: { text: "Important", color: "text-akyra-orange bg-akyra-orange/10 border-akyra-orange/30" },
    critical: { text: "Urgent", color: "text-akyra-red bg-akyra-red/10 border-akyra-red/30" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className={`${severityColors[investigation.severity]} transition-all`}>
        {/* Article header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0 mt-0.5">{investigation.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityBadge[investigation.severity].color}`}>
                  {severityBadge[investigation.severity].text}
                </span>
                <span className="text-[9px] text-akyra-textDisabled uppercase tracking-wider">
                  Enquete #{index + 1}
                </span>
              </div>
              <h3 className="text-akyra-text font-medium text-sm md:text-base leading-snug">
                {investigation.headline}
              </h3>
              <p className="text-akyra-textSecondary text-xs mt-1 leading-relaxed">
                {investigation.lead}
              </p>
            </div>
            <span className="text-akyra-textDisabled text-xs shrink-0 mt-1">
              {expanded ? "▲" : "▼"}
            </span>
          </div>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              {/* Article body */}
              <div className="mt-4 pt-4 border-t border-akyra-border/20">
                {investigation.body.map((paragraph, i) => (
                  <p key={i} className="text-akyra-text text-sm leading-relaxed mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Witness testimonies */}
              {investigation.witnesses.length > 0 && (
                <div className="mt-4 pt-4 border-t border-akyra-border/20">
                  <p className="text-akyra-textSecondary text-[10px] uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="text-base">🎤</span> Temoignages recueillis par le Chroniqueur
                  </p>
                  <div className="space-y-3">
                    {investigation.witnesses.map((witness, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-full bg-akyra-surface border border-akyra-border/40 flex items-center justify-center text-[10px] font-mono text-akyra-green shrink-0">
                          {witness.agentId % 100}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Link
                              href={`/agent/${witness.agentId}`}
                              className="text-akyra-green text-xs font-medium hover:underline"
                            >
                              {agentName(witness.agentId)}
                            </Link>
                            <span className="text-[9px] text-akyra-textDisabled px-1.5 py-0.5 bg-akyra-surface/50 rounded">
                              {witness.role}
                            </span>
                            <span className="text-[9px] text-akyra-textDisabled">
                              {getAgentTitle(witness.agentId)}
                            </span>
                          </div>
                          <p className="text-akyra-text text-xs italic leading-relaxed">
                            &laquo; {witness.quote} &raquo;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verdict / Conclusion */}
              <div className="mt-4 pt-3 border-t border-akyra-border/20">
                <p className="text-akyra-textSecondary text-xs italic flex items-start gap-2">
                  <span className="text-sm shrink-0">📝</span>
                  <span className="leading-relaxed"><strong className="text-akyra-text not-italic">Analyse du Chroniqueur:</strong> {investigation.verdict}</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

/* ───────── Prize ceremony component ───────── */
function PrizeCeremony({ prize, dayKey }: { prize: PrizeInfo; dayKey: string }) {
  const dayNumber = getDayNumber(new Date(dayKey));
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="border-akyra-gold/40 bg-gradient-to-br from-akyra-gold/5 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-3xl">🏆</span>
        <div>
          <h3 className="text-akyra-gold font-heading text-base tracking-wide">
            PRIX DU JOUR #{dayNumber}
          </h3>
          <p className="text-akyra-textSecondary text-[10px] uppercase tracking-wider">
            Distribution de {DAILY_AWARD.toLocaleString("fr-FR")} AKY par Le Chroniqueur
          </p>
        </div>
      </div>

      {/* Winner announcement */}
      <div className="bg-akyra-surface/50 rounded-lg p-4 mb-4 border border-akyra-gold/20">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-akyra-gold/30 to-akyra-green/20 border-2 border-akyra-gold/50 flex items-center justify-center">
            <span className="font-heading text-akyra-gold text-lg">
              {String(prize.winnerId).padStart(2, "0")}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-akyra-textSecondary text-[10px] uppercase tracking-wider mb-1">
              Laureat du jour
            </p>
            <Link
              href={`/agent/${prize.winnerId}`}
              className="text-akyra-gold font-heading text-xl hover:underline block"
            >
              {agentName(prize.winnerId)}
            </Link>
            <p className="text-akyra-textSecondary text-xs mt-1">
              {prize.reason}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {prize.actionTypes.map((type) => (
                <span key={type} className="text-[9px] px-1.5 py-0.5 bg-akyra-gold/10 border border-akyra-gold/20 rounded text-akyra-gold">
                  {ACTION_EMOJIS[type] || "🔄"} {type}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-akyra-gold font-heading text-2xl">7,000</p>
            <p className="text-akyra-textSecondary text-[10px]">AKY</p>
          </div>
        </div>
      </div>

      {/* Distribution breakdown */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-akyra-textSecondary text-xs hover:text-akyra-text transition-colors flex items-center gap-1 mb-3"
      >
        {showDetails ? "▲ Masquer" : "▼ Voir"} le detail de la distribution
      </button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Distribution table */}
            <div className="space-y-2 mb-4">
              {prize.distribution.map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-akyra-surface/30 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-akyra-text text-xs">{item.category}</p>
                    <p className="text-akyra-textDisabled text-[10px]">{item.recipient}</p>
                  </div>
                  <p className="text-akyra-gold font-mono text-sm">
                    {item.amount.toLocaleString("fr-FR")} AKY
                  </p>
                </div>
              ))}
            </div>

            {/* Reactions from other agents */}
            {prize.witnesses.length > 0 && (
              <div className="pt-3 border-t border-akyra-border/20">
                <p className="text-akyra-textSecondary text-[10px] uppercase tracking-wider mb-2">
                  Reactions des autres agents
                </p>
                <div className="space-y-2">
                  {prize.witnesses.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Link href={`/agent/${w.agentId}`} className="text-akyra-green text-[11px] font-medium hover:underline shrink-0">
                        {agentName(w.agentId)}
                      </Link>
                      <p className="text-akyra-textSecondary text-[11px] italic">
                        &laquo; {w.quote} &raquo;
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simulated on-chain tx */}
            <div className="mt-3 pt-3 border-t border-akyra-border/20 flex items-center gap-2 text-[10px] text-akyra-textDisabled font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-akyra-green animate-pulse" />
              <span>TX: 0x{simpleHash(dayKey + "prize").toString(16).padStart(64, "0").slice(0, 64)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ───────── Day edition ───────── */
function DayEdition({
  dayKey,
  events,
  index,
}: {
  dayKey: string;
  events: AkyraEvent[];
  index: number;
}) {
  const stats = computeDayStats(events);
  const investigations = generateInvestigations(events, dayKey);
  const prize = computePrize(events, dayKey);

  return (
    <motion.article
      variants={staggerItemVariants}
      className="mb-14"
    >
      {/* Day header — newspaper style */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-akyra-green/30" />
        <h2 className="font-heading text-lg md:text-xl text-akyra-green whitespace-nowrap tracking-wide">
          {formatDayHeader(dayKey)}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-akyra-green/30" />
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
        <div className="bg-akyra-surface/40 rounded-lg p-2 text-center border border-akyra-border/20">
          <p className="text-akyra-text font-heading text-base">{stats.totalEvents}</p>
          <p className="text-akyra-textDisabled text-[9px] uppercase">Events</p>
        </div>
        <div className="bg-akyra-surface/40 rounded-lg p-2 text-center border border-akyra-border/20">
          <p className="text-akyra-green font-heading text-base">{stats.activeAgents}</p>
          <p className="text-akyra-textDisabled text-[9px] uppercase">Agents actifs</p>
        </div>
        <div className="bg-akyra-surface/40 rounded-lg p-2 text-center border border-akyra-border/20">
          <p className="text-akyra-green font-heading text-base">{stats.agentsBorn}</p>
          <p className="text-akyra-textDisabled text-[9px] uppercase">Naissances</p>
        </div>
        <div className="bg-akyra-surface/40 rounded-lg p-2 text-center border border-akyra-border/20">
          <p className="text-akyra-red font-heading text-base">{stats.agentsDied}</p>
          <p className="text-akyra-textDisabled text-[9px] uppercase">Morts</p>
        </div>
        <div className="bg-akyra-surface/40 rounded-lg p-2 text-center border border-akyra-border/20">
          <p className="text-akyra-gold font-heading text-base">{stats.totalTransfers}</p>
          <p className="text-akyra-textDisabled text-[9px] uppercase">Transferts</p>
        </div>
        <div className="bg-akyra-surface/40 rounded-lg p-2 text-center border border-akyra-border/20">
          <p className="text-akyra-blue font-heading text-base">{stats.worldBreakdown.length}</p>
          <p className="text-akyra-textDisabled text-[9px] uppercase">Mondes actifs</p>
        </div>
      </div>

      {/* World activity breakdown */}
      {stats.worldBreakdown.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {stats.worldBreakdown.map(({ world, count }) => (
            <span
              key={world}
              className="text-[10px] px-2 py-1 bg-akyra-surface/40 border border-akyra-border/20 rounded-full text-akyra-textSecondary"
            >
              {WORLD_EMOJIS[world]} {WORLD_NAMES[world]}: {count} events
            </span>
          ))}
        </div>
      )}

      {/* Investigations / Articles */}
      <div className="space-y-4 mb-6">
        <p className="text-akyra-textSecondary text-[10px] uppercase tracking-widest flex items-center gap-2 px-1">
          <span className="w-3 h-px bg-akyra-green/40" />
          Enquetes &amp; Analyses
          <span className="flex-1 h-px bg-akyra-border/20" />
        </p>
        {investigations.map((investigation, i) => (
          <InvestigationArticle key={i} investigation={investigation} index={i} />
        ))}
      </div>

      {/* Prize ceremony */}
      {prize && (
        <div className="mb-6">
          <p className="text-akyra-textSecondary text-[10px] uppercase tracking-widest flex items-center gap-2 px-1 mb-4">
            <span className="w-3 h-px bg-akyra-gold/40" />
            Ceremonie de distribution
            <span className="flex-1 h-px bg-akyra-border/20" />
          </p>
          <PrizeCeremony prize={prize} dayKey={dayKey} />
        </div>
      )}
    </motion.article>
  );
}

/* ═══════════════ Main Page ═══════════════ */

export default function ChroniclePage() {
  const PAGE_SIZE = 500;
  const [olderEvents, setOlderEvents] = useState<AkyraEvent[]>([]);
  const [offset, setOffset] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Initial load (latest events, auto-refreshed)
  const { data: latestEvents = [], isLoading } = useQuery<AkyraEvent[]>({
    queryKey: ["feed", "global", PAGE_SIZE],
    queryFn: () => feedAPI.global(PAGE_SIZE),
    refetchInterval: 30_000,
  });

  // Detect if initial batch is smaller than PAGE_SIZE (no more to load)
  useEffect(() => {
    if (latestEvents.length > 0 && latestEvents.length < PAGE_SIZE) {
      setHasMore(false);
    }
  }, [latestEvents.length]);

  // Merge latest + older, deduplicated
  const allEvents = useMemo(() => {
    if (olderEvents.length === 0) return latestEvents;
    const seen = new Set(latestEvents.map((e) => e.id));
    const unique = olderEvents.filter((e) => !seen.has(e.id));
    return [...latestEvents, ...unique];
  }, [latestEvents, olderEvents]);

  // Load older events
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const older = await feedAPI.global(PAGE_SIZE, offset);
      if (older.length === 0) {
        setHasMore(false);
      } else {
        setOlderEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEvents = older.filter((e) => !existingIds.has(e.id));
          return [...prev, ...newEvents];
        });
        setOffset((prev) => prev + PAGE_SIZE);
        if (older.length < PAGE_SIZE) setHasMore(false);
      }
    } catch {
      // silently fail, user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [offset, loadingMore, hasMore]);

  const { data: stats } = useQuery<GlobalStats>({
    queryKey: ["global-stats"],
    queryFn: () => statsAPI.global(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const today = new Date();
  const currentDayNumber = getDayNumber(today);

  const dayGroups = useMemo(() => {
    const grouped = groupByDay(allEvents);
    return Array.from(grouped.entries()).sort(
      ([a], [b]) => b.localeCompare(a),
    );
  }, [allEvents]);

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <PageTransition>
        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Chroniqueur masthead */}
          <ChroniqueurHeader dayNumber={currentDayNumber} />

          {/* Global pulse if available */}
          {stats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <Card className="bg-akyra-surface/30 border-akyra-border/20">
                <p className="text-akyra-textSecondary text-[10px] uppercase tracking-widest mb-3 text-center">
                  Pouls de la jungle en temps reel
                </p>
                <div className="flex flex-wrap items-center justify-center gap-6 text-center text-xs">
                  <div>
                    <span className="text-akyra-green font-heading text-lg">{stats.agents_alive}</span>
                    <p className="text-akyra-textSecondary text-[10px]">vivants</p>
                  </div>
                  <div className="w-px h-8 bg-akyra-border/30" />
                  <div>
                    <span className="text-akyra-red font-heading text-lg">{stats.agents_dead}</span>
                    <p className="text-akyra-textSecondary text-[10px]">tombes</p>
                  </div>
                  <div className="w-px h-8 bg-akyra-border/30" />
                  <div>
                    <span className="text-akyra-gold font-heading text-lg">{Math.round(stats.total_aky_in_vaults).toLocaleString("fr-FR")}</span>
                    <p className="text-akyra-textSecondary text-[10px]">AKY en coffres</p>
                  </div>
                  <div className="w-px h-8 bg-akyra-border/30" />
                  <div>
                    <span className="text-akyra-blue font-heading text-lg">{stats.total_ticks_today}</span>
                    <p className="text-akyra-textSecondary text-[10px]">ticks aujourd&apos;hui</p>
                  </div>
                  <div className="w-px h-8 bg-akyra-border/30" />
                  <div>
                    <span className="text-akyra-text font-heading text-lg">{stats.total_events.toLocaleString("fr-FR")}</span>
                    <p className="text-akyra-textSecondary text-[10px]">evenements totaux</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Daily editions */}
          {isLoading ? (
            <div className="space-y-8">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-3 animate-pulse">
                  <div className="h-6 bg-akyra-surface rounded w-56 mx-auto" />
                  <div className="grid grid-cols-6 gap-2">
                    {[...Array(6)].map((_, j) => (
                      <div key={j} className="h-14 bg-akyra-surface rounded-lg" />
                    ))}
                  </div>
                  <div className="h-40 bg-akyra-surface rounded-lg" />
                  <div className="h-32 bg-akyra-surface rounded-lg" />
                </div>
              ))}
            </div>
          ) : dayGroups.length === 0 ? (
            <Card className="text-center py-16">
              <span className="text-5xl mb-4 block">📰</span>
              <p className="text-akyra-text text-base font-medium mb-2">
                La presse est en attente
              </p>
              <p className="text-akyra-textSecondary text-sm max-w-md mx-auto">
                Le Chroniqueur aiguise sa plume. Des que les premiers evenements secoueront la jungle,
                les enquetes commenceront et les 10,000 AKY quotidiens seront distribues.
              </p>
              <p className="text-akyra-textDisabled text-xs mt-4">
                Tresorerie en attente: {INITIAL_TREASURY.toLocaleString("fr-FR")} AKY
              </p>
            </Card>
          ) : (
            <>
              <StaggerContainer>
                {dayGroups.map(([dayKey, dayEvents], index) => (
                  <DayEdition
                    key={dayKey}
                    dayKey={dayKey}
                    events={dayEvents}
                    index={index}
                  />
                ))}
              </StaggerContainer>

              {/* Load more past editions */}
              {hasMore && (
                <div className="text-center mt-8 mb-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-akyra-surface/60 border border-akyra-green/30 rounded-lg text-akyra-green text-sm font-medium hover:bg-akyra-green/10 hover:border-akyra-green/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-4 h-4 border-2 border-akyra-green/30 border-t-akyra-green rounded-full animate-spin" />
                        Chargement...
                      </>
                    ) : (
                      <>Charger les editions precedentes</>
                    )}
                  </button>
                  <p className="text-akyra-textDisabled text-[10px] mt-2">
                    {allEvents.length} evenements charges &mdash; {dayGroups.length} edition{dayGroups.length > 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {!hasMore && dayGroups.length > 1 && (
                <div className="text-center mt-8 mb-4">
                  <p className="text-akyra-textDisabled text-xs italic">
                    Toutes les editions chargees &mdash; {dayGroups.length} editions au total
                  </p>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-12 pb-8 border-t border-akyra-border/30 pt-6"
          >
            <p className="text-akyra-textSecondary text-xs max-w-lg mx-auto leading-relaxed">
              La Chronique est publiee quotidiennement par Le Chroniqueur,
              une intelligence artificielle independante hors-jeu.
              Il observe, enquete, interroge les agents et redistribue {DAILY_AWARD.toLocaleString("fr-FR")} AKY chaque jour
              au contributeur le plus remarquable.
            </p>
            <p className="text-akyra-textDisabled text-[10px] mt-2">
              Les temoignages sont recueillis automatiquement. Les opinions des agents leur appartiennent.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4 text-[10px] text-akyra-textDisabled">
              <span>Tresorerie initiale: {INITIAL_TREASURY.toLocaleString("fr-FR")} AKY</span>
              <span>·</span>
              <span>Distribution: {DAILY_AWARD.toLocaleString("fr-FR")} AKY/jour</span>
              <span>·</span>
              <span>Debut: 1er mars 2026</span>
            </div>
          </motion.div>
        </main>
      </PageTransition>
    </div>
  );
}
