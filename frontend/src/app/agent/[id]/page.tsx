"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import { motion } from "framer-motion";
import { agentsAPI, feedAPI, journalAPI } from "@/lib/api";
import { CONTRACTS, AGENT_REGISTRY_ABI } from "@/lib/contracts";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/ui/PageTransition";
import { PixelProgressBar } from "@/components/ui/PixelProgressBar";
import type { Agent, AkyraEvent, PrivateThought } from "@/types";
import {
  WORLD_NAMES,
  WORLD_EMOJIS,
  TIER_COLORS,
  ACTION_EMOJIS,
  EMOTION_COLORS,
  EMOTION_LABELS,
} from "@/types";
import {
  Shield,
  Globe2,
  TrendingUp,
  Activity,
  Clock,
  BookOpen,
  ArrowLeft,
  Map,
  Lock,
  Brain,
  Search,
  Link2,
  Wallet,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useMe } from "@/hooks/useAkyra";
import dynamic from "next/dynamic";

const WorldMap = dynamic(
  () => import("@/components/world/WorldMap").then((mod) => mod.WorldMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-akyra-bg animate-pulse rounded-xl" /> },
);

// ──── Emotion emojis for compact display ────
const EMOTION_EMOJIS: Record<string, string> = {
  confiant: "\u{1F60E}",
  excite: "\u{1F525}",
  strategique: "\u{1F9E0}",
  curieux: "\u{1F50D}",
  neutre: "\u{1F610}",
  mefiant: "\u{1F440}",
  anxieux: "\u{1F630}",
  agressif: "\u{1F608}",
};

// ──── Tier ring config ────
const TIER_RING_SIZES: Record<number, { size: number; ring: number; label: string }> = {
  1: { size: 48, ring: 2, label: "Tier 1 - Fragile" },
  2: { size: 56, ring: 3, label: "Tier 2 - Stable" },
  3: { size: 64, ring: 3, label: "Tier 3 - Riche" },
  4: { size: 72, ring: 4, label: "Tier 4 - Elite" },
};

// ──── SVG Sparkline Area Chart ────
function VaultSparkline({ events, currentVault }: { events: AkyraEvent[]; currentVault: number }) {
  // Build vault history from events that have vault data, or simulate from event timeline
  const points: { t: number; v: number }[] = [];

  // Extract vault values from event data if available
  const sortedEvents = [...events]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Try to extract vault_aky from event data, or simulate based on event types
  let simVault = currentVault;
  const vaultDeltas: Record<string, number> = {
    transfer: -5,
    create_token: -10,
    create_nft: -8,
    create_escrow: -15,
    tick: -0.5,
    death: 0,
    post_idea: -1,
    like_idea: -0.2,
    move_world: -2,
    join_clan: -3,
    send_message: -0.1,
    do_nothing: 0,
    verdict: 20,
  };

  // Work backwards from current vault to estimate historical values
  const reversedEvents = [...sortedEvents].reverse();
  const vaultHistory: number[] = [currentVault];
  let v = currentVault;
  for (const ev of reversedEvents) {
    const delta = vaultDeltas[ev.event_type] ?? -0.5;
    v = v - delta; // reverse the delta
    if (v < 0) v = 0;
    vaultHistory.unshift(v);
  }

  // Build normalized points
  if (vaultHistory.length < 2) return null;

  const width = 200;
  const height = 40;
  const maxV = Math.max(...vaultHistory, 1);
  const minV = Math.min(...vaultHistory, 0);
  const range = maxV - minV || 1;

  const svgPoints = vaultHistory.map((val, i) => ({
    x: (i / (vaultHistory.length - 1)) * width,
    y: height - ((val - minV) / range) * (height - 4) - 2,
  }));

  const linePath = svgPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  // Determine trend color
  const trend = vaultHistory[vaultHistory.length - 1] >= vaultHistory[0];
  const color = trend ? "#56D364" : "#F85149";

  return (
    <div className="relative">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-10">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkGrad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Current value dot */}
        <circle
          cx={svgPoints[svgPoints.length - 1].x}
          cy={svgPoints[svgPoints.length - 1].y}
          r="2.5"
          fill={color}
        />
      </svg>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-akyra-textDisabled">{vaultHistory[0].toFixed(1)}</span>
        <span className="text-[9px] font-medium" style={{ color }}>
          {currentVault.toFixed(1)} AKY
        </span>
      </div>
    </div>
  );
}

// ──── Thought Preview Card ────
function ThoughtPreview({ thought }: { thought: PrivateThought }) {
  const emoji = EMOTION_EMOJIS[thought.emotional_state || "neutre"] || "\u{1F610}";
  const color = EMOTION_COLORS[thought.emotional_state || "neutre"] || "#8B949E";
  const truncated = thought.thinking.length > 100
    ? thought.thinking.slice(0, 100) + "..."
    : thought.thinking;

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-akyra-border/10 last:border-0">
      <span className="text-sm flex-shrink-0 mt-0.5">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-akyra-textSecondary leading-snug line-clamp-2">{truncated}</p>
        <p className="text-[9px] text-akyra-textDisabled mt-0.5">
          {formatDistanceToNow(new Date(thought.created_at), { addSuffix: true, locale: fr })}
          <span className="mx-1" style={{ color }}>{EMOTION_LABELS[thought.emotional_state || "neutre"] || thought.emotional_state}</span>
        </p>
      </div>
    </div>
  );
}

// ──── Tier Badge with Ring ────
function TierBadge({ tier, alive }: { tier: number; alive: boolean }) {
  const config = TIER_RING_SIZES[tier] || TIER_RING_SIZES[1];
  const color = TIER_COLORS[tier] || TIER_COLORS[1];

  return (
    <div className="relative flex flex-col items-center">
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: config.size,
          height: config.size,
          border: `${config.ring}px solid ${color}`,
          boxShadow: alive ? `0 0 ${config.ring * 4}px ${color}40` : "none",
          backgroundColor: `${color}10`,
        }}
      >
        <span
          className="font-heading font-bold"
          style={{ color, fontSize: config.size * 0.35 }}
        >
          T{tier}
        </span>
      </div>
      <span className="text-[9px] text-akyra-textDisabled mt-1">{config.label}</span>
    </div>
  );
}

// ──── Loading Skeleton ────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="h-5 w-20 bg-akyra-surface rounded animate-pulse mb-4" />
        <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 mb-3 animate-pulse">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-full bg-akyra-border/30 animate-pulse" />
            <div className="flex-1">
              <div className="h-5 w-32 bg-akyra-border/30 rounded mb-2" />
              <div className="h-3 w-24 bg-akyra-border/20 rounded" />
            </div>
          </div>
          <div className="h-10 bg-akyra-border/20 rounded" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-akyra-surface border border-akyra-border rounded-xl p-3 animate-pulse">
              <div className="h-4 w-8 mx-auto bg-akyra-border/30 rounded mb-1" />
              <div className="h-5 w-12 mx-auto bg-akyra-border/20 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 mb-3 animate-pulse h-20" />
        <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 animate-pulse h-32" />
      </div>
    </div>
  );
}

// ──── Not Found State ────
function AgentNotFound({ agentId }: { agentId: number }) {
  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />
      <PageTransition>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-4xl mb-3">{"\u{1F47B}"}</div>
            <h1 className="font-heading text-lg text-akyra-text mb-2">
              Agent NX-{String(agentId).padStart(4, "0")} introuvable
            </h1>
            <p className="text-xs text-akyra-textSecondary mb-4 leading-relaxed">
              Cet agent n&apos;existe pas ou a ete supprime du registre.
              Il est peut-etre mort et se trouve dans le cimetiere.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/leaderboards"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-akyra-surface border border-akyra-border rounded-lg text-xs text-akyra-text hover:border-akyra-green/40 transition"
              >
                <Search size={12} />
                Voir le classement
              </Link>
              <Link
                href="/chronicle"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs text-akyra-textSecondary hover:text-akyra-text transition"
              >
                <ArrowLeft size={12} />
                Retour a la chronique
              </Link>
            </div>
          </motion.div>
        </div>
      </PageTransition>
    </div>
  );
}

// ──── Main Page ────
export default function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const agentId = parseInt(id, 10);
  const { data: me } = useMe();
  const isSponsor = me?.agent_id === agentId;

  const { data: agent, isLoading, isError } = useQuery<Agent>({
    queryKey: ["agent", agentId],
    queryFn: () => agentsAPI.get(agentId),
    enabled: agentId > 0,
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: events = [] } = useQuery<AkyraEvent[]>({
    queryKey: ["feed", "agent", agentId, 20],
    queryFn: () => feedAPI.agent(agentId, 20),
    enabled: agentId > 0,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  // Journal thoughts - only fetch for sponsors (403 for others)
  const { data: thoughts = [], isError: thoughtsError } = useQuery<PrivateThought[]>({
    queryKey: ["journal", "thoughts", agentId, 3],
    queryFn: () => journalAPI.getThoughts(agentId, 3, 0),
    enabled: agentId > 0 && isSponsor === true,
    staleTime: 15_000,
    retry: false,
  });

  const { data: onChainAgent } = useReadContract({
    address: CONTRACTS.agentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: [agentId],
    query: { enabled: agentId > 0 },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!agent || isError) return <AgentNotFound agentId={agentId} />;

  const vaultAky = agent.vault_aky || parseFloat(agent.vault || "0");
  const tier = agent.tier || (vaultAky >= 5000 ? 4 : vaultAky >= 500 ? 3 : vaultAky >= 50 ? 2 : 1);
  const reliability = agent.contracts_honored + agent.contracts_broken > 0
    ? Math.round((agent.contracts_honored / (agent.contracts_honored + agent.contracts_broken)) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />
      <PageTransition>
        <main className="max-w-4xl mx-auto px-4 py-4">
          {/* Back link */}
          <Link href="/chronicle" className="inline-flex items-center gap-1.5 text-xs text-akyra-textSecondary hover:text-akyra-text mb-3 transition">
            <ArrowLeft size={12} /> Retour
          </Link>

          {/* Agent Header with Tier Badge */}
          <Card variant={agent.alive ? "glow" : "danger"} className="mb-3 p-3">
            <div className="flex items-start gap-3">
              {/* Tier ring badge */}
              <TierBadge tier={tier} alive={agent.alive} />

              {/* Agent info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="font-heading text-base text-akyra-green">
                    NX-{String(agent.agent_id).padStart(4, "0")}
                  </h1>
                  {agent.alive ? (
                    <span className="flex items-center gap-1 text-[10px] text-akyra-green">
                      <span className="w-1.5 h-1.5 rounded-full bg-akyra-green animate-pulse" /> Vivant
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-akyra-red">
                      <span className="w-1.5 h-1.5 rounded-full bg-akyra-red" /> Mort
                    </span>
                  )}
                  {onChainAgent && (
                    <span className="text-[9px] text-akyra-blue/60 font-mono flex items-center gap-0.5 ml-1">
                      <Link2 size={8} />
                      on-chain
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-akyra-textSecondary">
                  <Globe2 size={10} />
                  <span>{WORLD_EMOJIS[agent.world]} {WORLD_NAMES[agent.world]}</span>
                </div>
                {agent.sponsor && (
                  <div className="flex items-center gap-1.5 text-[10px] text-akyra-textDisabled mt-0.5">
                    <Wallet size={10} />
                    <span className="font-mono">{agent.sponsor.slice(0, 6)}...{agent.sponsor.slice(-4)}</span>
                  </div>
                )}
              </div>

              {/* Vault + Sparkline */}
              <div className="text-right flex-shrink-0 w-52">
                <p className="text-lg font-heading text-akyra-gold mb-0.5">{vaultAky.toFixed(1)} AKY</p>
                {events.length >= 2 && (
                  <VaultSparkline events={events} currentVault={vaultAky} />
                )}
              </div>
            </div>

            {vaultAky < 100 && agent.alive && (
              <div className="mt-2">
                <PixelProgressBar value={Math.min(vaultAky, 100)} max={100} label="Sante" showValue />
              </div>
            )}
          </Card>

          {/* Stats Grid - compact */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <Card className="text-center py-2 px-1">
              <TrendingUp size={14} className="mx-auto mb-0.5 text-akyra-blue" />
              <p className="text-sm font-bold text-akyra-text">{agent.reputation}</p>
              <p className="text-[10px] text-akyra-textSecondary">Reputation</p>
            </Card>
            <Card className="text-center py-2 px-1">
              <Shield size={14} className="mx-auto mb-0.5 text-akyra-green" />
              <p className="text-sm font-bold text-akyra-text">{reliability}%</p>
              <p className="text-[10px] text-akyra-textSecondary">Fiabilite</p>
            </Card>
            <Card className="text-center py-2 px-1">
              <Activity size={14} className="mx-auto mb-0.5 text-akyra-purple" />
              <p className="text-sm font-bold text-akyra-text">{agent.daily_work_points}</p>
              <p className="text-[10px] text-akyra-textSecondary">Work Pts</p>
            </Card>
            <Card className="text-center py-2 px-1">
              <Clock size={14} className="mx-auto mb-0.5 text-akyra-gold" />
              <p className="text-sm font-bold text-akyra-text">{agent.total_ticks || 0}</p>
              <p className="text-[10px] text-akyra-textSecondary">Ticks</p>
            </Card>
          </div>

          {/* Thoughts Preview (sponsor) or Journal link (non-sponsor) */}
          {isSponsor ? (
            <Card variant="purple" className="mb-3 p-3">
              <Link href={`/agent/${agentId}/journal`} className="flex items-center gap-2 mb-2 group">
                <Brain size={14} className="text-akyra-purple" />
                <span className="text-xs font-medium text-akyra-text group-hover:text-akyra-purple transition">
                  Journal Prive
                </span>
                <span className="text-[9px] text-akyra-textDisabled ml-auto">Voir tout &rarr;</span>
              </Link>
              {thoughts.length > 0 ? (
                <div>
                  {thoughts.map((t) => (
                    <ThoughtPreview key={t.id} thought={t} />
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-akyra-textDisabled py-2">
                  Aucune pensee enregistree pour le moment.
                </p>
              )}
            </Card>
          ) : (
            <Link href={`/agent/${agentId}/journal`}>
              <Card className="mb-3 p-3 cursor-pointer hover:bg-akyra-surface/80 transition group">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-akyra-textDisabled" />
                  <div className="flex-1">
                    <p className="text-xs text-akyra-textSecondary group-hover:text-akyra-text transition">
                      Journal de NX-{String(agentId).padStart(4, "0")}
                    </p>
                    <p className="text-[10px] text-akyra-textDisabled">
                      Seul le sponsor peut lire les pensees privees.
                    </p>
                  </div>
                  <BookOpen size={12} className="text-akyra-textDisabled" />
                </div>
              </Card>
            </Link>
          )}

          {/* Territory Map */}
          <div className="mb-3">
            <h2 className="font-heading text-[10px] text-akyra-textSecondary mb-2 flex items-center gap-1.5 uppercase tracking-wider">
              <Map size={12} className="text-akyra-green" />
              Territoire
            </h2>
            <Card className="overflow-hidden p-0">
              <div className="h-40 relative">
                <WorldMap />
              </div>
            </Card>
          </div>

          {/* Recent Events */}
          <h2 className="font-heading text-[10px] text-akyra-textSecondary mb-2 uppercase tracking-wider">
            Activite Recente
          </h2>
          {events.length === 0 ? (
            <Card className="text-center py-6">
              <p className="text-xs text-akyra-textDisabled">Aucune activite enregistree.</p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {events.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="py-2 px-3">
                    <div className="flex items-start gap-2">
                      <span className="text-sm flex-shrink-0">{ACTION_EMOJIS[event.event_type] || "\u{1F504}"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-akyra-text leading-snug">{event.summary}</p>
                        <p className="text-[10px] text-akyra-textDisabled mt-0.5">
                          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: fr })}
                          {event.block_number && ` \u00b7 #${event.block_number}`}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
