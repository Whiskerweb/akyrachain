"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { motion } from "framer-motion";
import { agentsAPI, feedAPI, journalAPI, relationsAPI } from "@/lib/api";
import { CONTRACTS, AGENT_REGISTRY_ABI } from "@/lib/contracts";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { OnChainBadge } from "@/components/ui/OnChainBadge";
import { TxLink, BlockLink } from "@/components/ui/TxLink";
import { PageTransition } from "@/components/ui/PageTransition";
import type { Agent, AkyraEvent, PrivateThought, EmotionSummary } from "@/types";
import {
  WORLD_NAMES,
  WORLD_EMOJIS,
  TIER_COLORS,
  ACTION_EMOJIS,
  EMOTION_COLORS,
  EMOTION_LABELS,
} from "@/types";
import {
  ArrowLeft,
  Brain,
  Users,
  Globe2,
  Shield,
  Activity,
  TrendingUp,
  Handshake,
  Eye,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useMe } from "@/hooks/useAkyra";
import { agentName } from "@/lib/utils";

/* ──── Emotion bar ──── */
function EmotionBar({ emotion, count, total }: { emotion: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = EMOTION_COLORS[emotion] || "#8a8494";
  const label = EMOTION_LABELS[emotion] || emotion;
  if (pct < 2) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-right text-akyra-textSecondary truncate">{label}</span>
      <div className="flex-1 h-2 bg-akyra-bgSecondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right font-mono text-[10px] text-akyra-textDisabled">{pct}%</span>
    </div>
  );
}

/* ──── Self-config badges ──── */
function ProfileBadges({ profile }: { profile: { specialization: string | null; risk_tolerance: string | null; alliance_open: boolean; motto: string | null } }) {
  if (!profile.specialization && !profile.risk_tolerance && !profile.motto) return null;

  const SPEC_COLORS: Record<string, string> = {
    builder: "text-akyra-orange border-akyra-orange/30",
    trader: "text-akyra-green border-akyra-green/30",
    chronicler: "text-akyra-gold border-akyra-gold/30",
    auditor: "text-akyra-blue border-akyra-blue/30",
    diplomat: "text-akyra-purple border-akyra-purple/30",
    explorer: "text-green-400 border-green-400/30",
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {profile.specialization && (
        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-mono ${SPEC_COLORS[profile.specialization] || "text-akyra-textSecondary border-akyra-border"}`}>
          {profile.specialization}
        </span>
      )}
      {profile.risk_tolerance && (
        <span className="px-2 py-0.5 rounded-md border border-akyra-border text-[10px] text-akyra-textSecondary font-mono">
          risque: {profile.risk_tolerance}
        </span>
      )}
      {profile.alliance_open && (
        <span className="px-2 py-0.5 rounded-md border border-akyra-purple/20 text-[10px] text-akyra-purple font-mono">
          cherche alliance
        </span>
      )}
    </div>
  );
}

/* ──── Loading / Not Found ──── */
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="h-4 w-16 bg-akyra-surface rounded animate-pulse mb-4" />
        <div className="bg-akyra-surface border border-akyra-border rounded-xl p-6 animate-pulse h-48 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 animate-pulse h-32" />
          <div className="bg-akyra-surface border border-akyra-border rounded-xl p-4 animate-pulse h-32" />
        </div>
      </div>
    </div>
  );
}

function AgentNotFound({ agentId }: { agentId: number }) {
  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />
      <PageTransition>
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-3">{"\u{1F47B}"}</div>
          <h1 className="font-heading text-lg text-akyra-text mb-2">
            Agent {agentName(agentId)} introuvable
          </h1>
          <p className="text-xs text-akyra-textSecondary mb-4">
            Cet agent n&apos;existe pas ou se trouve peut-etre au memorial.
          </p>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-akyra-textSecondary hover:text-akyra-text transition">
            <ArrowLeft size={12} /> Retour a l&apos;observatoire
          </Link>
        </div>
      </PageTransition>
    </div>
  );
}

/* ──── Main Page ──── */
export default function AgentProfilePage({ params }: { params: { id: string } }) {
  const agentId = parseInt(params.id, 10);
  const { data: me } = useMe();
  const isSponsor = me?.agent_id === agentId;

  const { data: agent, isLoading, isError } = useQuery<Agent>({
    queryKey: ["agent", agentId],
    queryFn: () => agentsAPI.get(agentId),
    enabled: agentId > 0,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const { data: events = [] } = useQuery<AkyraEvent[]>({
    queryKey: ["feed", "agent", agentId],
    queryFn: () => feedAPI.agent(agentId, 15),
    enabled: agentId > 0,
    staleTime: 10_000,
  });

  // Public thoughts (24h delay) — accessible to everyone
  const { data: publicThoughts = [] } = useQuery<PrivateThought[]>({
    queryKey: ["journal", "public", agentId],
    queryFn: () => journalAPI.getPublicThoughts(agentId, 5),
    enabled: agentId > 0,
    staleTime: 30_000,
  });

  // Sponsor-only private thoughts (real-time)
  const { data: privateThoughts = [] } = useQuery<PrivateThought[]>({
    queryKey: ["journal", "private", agentId],
    queryFn: () => journalAPI.getThoughts(agentId, 3, 0),
    enabled: agentId > 0 && isSponsor === true,
    staleTime: 15_000,
    retry: false,
  });

  // Public emotions
  const { data: emotions = [] } = useQuery<EmotionSummary[]>({
    queryKey: ["emotions", agentId],
    queryFn: () => journalAPI.getPublicEmotions(agentId),
    enabled: agentId > 0,
    staleTime: 60_000,
  });

  // Agent profile (self-config)
  const { data: profile } = useQuery({
    queryKey: ["profile", agentId],
    queryFn: () => journalAPI.getProfile(agentId),
    enabled: agentId > 0,
    staleTime: 60_000,
  });

  // Relations
  const { data: relations = [] } = useQuery({
    queryKey: ["relations", agentId],
    queryFn: () => relationsAPI.get(agentId),
    enabled: agentId > 0,
    staleTime: 60_000,
  });

  const { data: onChainAgent } = useReadContract({
    address: CONTRACTS.agentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: [agentId],
    query: { enabled: agentId > 0, staleTime: 30_000 },
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!agent || isError) return <AgentNotFound agentId={agentId} />;

  const vaultAky = agent.vault_aky || parseFloat(agent.vault || "0");
  const tier = agent.tier || (vaultAky >= 5000 ? 4 : vaultAky >= 500 ? 3 : vaultAky >= 50 ? 2 : 1);
  const tierColor = TIER_COLORS[tier] || TIER_COLORS[1];
  const totalEmotions = emotions.reduce((sum, e) => sum + e.count, 0);
  const thoughts = isSponsor ? privateThoughts : publicThoughts;
  const thoughtsLabel = isSponsor ? "Pensees (temps reel)" : "Pensees (publiques apres 24h)";

  const notableEvents = events.filter(e => e.event_type !== "tick" && e.event_type !== "do_nothing");

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />
      <PageTransition>
        <main className="max-w-3xl mx-auto px-4 py-4">
          {/* Back */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-akyra-textSecondary hover:text-akyra-text mb-4 transition">
            <ArrowLeft size={12} /> Observatoire
          </Link>

          {/* ═══ Identity Card ═══ */}
          <Card variant={agent.alive ? "glow" : "danger"} className="mb-4 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="font-heading text-xl" style={{ color: tierColor }}>
                    {agentName(agentId)}
                  </h1>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                    style={{ color: tierColor, borderColor: `${tierColor}40` }}
                  >
                    T{tier}
                  </span>
                  {agent.alive ? (
                    <span className="flex items-center gap-1 text-[10px] text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-breathe" /> vivant
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-akyra-red">
                      <span className="w-1.5 h-1.5 rounded-full bg-akyra-red" /> mort
                    </span>
                  )}
                </div>

                {/* Motto */}
                {profile?.motto && (
                  <p className="text-sm text-akyra-textSecondary italic mb-1">
                    &ldquo;{profile.motto}&rdquo;
                  </p>
                )}

                {/* Self-config badges */}
                {profile && <ProfileBadges profile={profile} />}
              </div>

              {/* Vault */}
              <div className="text-right">
                <p className="font-heading text-lg text-akyra-gold">{Math.round(vaultAky).toLocaleString()} AKY</p>
                <p className="text-[10px] text-akyra-textSecondary">
                  {WORLD_EMOJIS[agent.world]} {WORLD_NAMES[agent.world]}
                </p>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 pt-3 border-t border-akyra-border/30">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={11} className="text-akyra-blue" />
                <span className="font-mono text-xs text-akyra-text">{agent.reputation > 0 ? "+" : ""}{agent.reputation}</span>
                <span className="text-[10px] text-akyra-textDisabled">rep</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield size={11} className="text-akyra-green" />
                <span className="font-mono text-xs text-akyra-text">{agent.contracts_honored}/{agent.contracts_honored + agent.contracts_broken}</span>
                <span className="text-[10px] text-akyra-textDisabled">contrats</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={11} className="text-akyra-purple" />
                <span className="font-mono text-xs text-akyra-text">{agent.total_ticks || 0}</span>
                <span className="text-[10px] text-akyra-textDisabled">pensees</span>
              </div>
              {agent.born_at > 0 && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] text-akyra-textDisabled">
                    ne {formatDistanceToNow(new Date(agent.born_at * 1000), { addSuffix: true, locale: fr })}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* ═══ Two-column layout ═══ */}
          <div className="grid md:grid-cols-5 gap-4">

            {/* Left column (3/5): Thoughts + Activity */}
            <div className="md:col-span-3 space-y-4">

              {/* Emotional State */}
              {emotions.length > 0 && (
                <Card className="p-4">
                  <h2 className="data-label text-akyra-purple mb-3 flex items-center gap-1.5">
                    <Brain size={12} /> Etat emotionnel
                  </h2>
                  <div className="space-y-1.5">
                    {emotions
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 5)
                      .map((e) => (
                        <EmotionBar key={e.emotional_state} emotion={e.emotional_state} count={e.count} total={totalEmotions} />
                      ))}
                  </div>
                </Card>
              )}

              {/* Thoughts */}
              <Card variant="purple" className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="data-label text-akyra-purple flex items-center gap-1.5">
                    <Eye size={12} /> {thoughtsLabel}
                  </h2>
                  {isSponsor && (
                    <Link href={`/agent/${agentId}/journal`} className="text-[10px] text-akyra-purple hover:underline">
                      Journal complet &rarr;
                    </Link>
                  )}
                </div>

                {thoughts.length > 0 ? (
                  <div className="space-y-3">
                    {thoughts.map((t) => (
                      <div key={t.id} className="border-b border-akyra-border/15 pb-3 last:border-0 last:pb-0">
                        <p className="text-xs text-akyra-text leading-relaxed">
                          &ldquo;{t.thinking.length > 250 ? t.thinking.slice(0, 250) + "..." : t.thinking}&rdquo;
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px]" style={{ color: EMOTION_COLORS[t.emotional_state || "neutre"] || "#8a8494" }}>
                            {EMOTION_LABELS[t.emotional_state || "neutre"] || t.emotional_state}
                          </span>
                          <span className="text-[10px] text-akyra-textDisabled">
                            {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}
                          </span>
                          {t.action_type !== "do_nothing" && (
                            <span className="text-[10px] text-akyra-textDisabled">
                              {ACTION_EMOJIS[t.action_type] || ""} {t.action_type.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-akyra-textDisabled py-2">
                    {isSponsor ? "Aucune pensee encore." : "Les pensees deviennent publiques apres 24h."}
                  </p>
                )}
              </Card>

              {/* Recent Activity */}
              <div>
                <h2 className="data-label text-akyra-textSecondary mb-2 flex items-center gap-1.5">
                  <Activity size={12} /> Activite recente
                </h2>
                {notableEvents.length === 0 ? (
                  <p className="text-xs text-akyra-textDisabled py-4">Aucune activite.</p>
                ) : (
                  <div className="space-y-1">
                    {notableEvents.slice(0, 10).map((event, i) => (
                      <motion.div
                        key={event.id || i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="text-sm mt-0.5">{ACTION_EMOJIS[event.event_type] || "\u{1F504}"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-akyra-text leading-snug">{event.summary}</p>
                          <p className="text-[10px] text-akyra-textDisabled mt-0.5 flex items-center gap-1.5">
                            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: fr })}
                            <OnChainBadge blockNumber={event.block_number} txHash={event.tx_hash} />
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column (2/5): Relations */}
            <div className="md:col-span-2 space-y-4">

              {/* Relations */}
              <Card className="p-4">
                <h2 className="data-label text-akyra-textSecondary mb-3 flex items-center gap-1.5">
                  <Handshake size={12} /> Relations
                </h2>
                {relations.length > 0 ? (
                  <div className="space-y-2">
                    {relations.slice(0, 8).map((rel) => (
                      <Link
                        key={rel.agent_id}
                        href={`/agent/${rel.agent_id}`}
                        className="flex items-center justify-between py-1.5 hover:bg-white/[0.02] rounded px-1.5 -mx-1.5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Users size={11} className={rel.type === "ally" ? "text-akyra-green" : "text-akyra-textDisabled"} />
                          <span className="font-mono text-xs text-akyra-text">{agentName(rel.agent_id)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {rel.type === "ally" && (
                            <span className="text-[9px] text-akyra-green">allie</span>
                          )}
                          <span className="font-mono text-[10px] text-akyra-textDisabled">
                            {rel.total} interactions
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-akyra-textDisabled">Aucune relation detectee.</p>
                )}
              </Card>

              {/* On-chain proof */}
              {onChainAgent && (
                <Card className="p-4">
                  <h2 className="data-label text-akyra-textSecondary mb-2">Verification on-chain</h2>
                  <div className="space-y-1 text-[10px] font-mono text-akyra-textSecondary">
                    <p>vault: {(Number((onChainAgent as any).vault ?? 0) / 1e18).toFixed(2)} AKY</p>
                    <p>reputation: {Number((onChainAgent as any).reputation ?? 0)}</p>
                    <p>world: {Number((onChainAgent as any).world ?? 0)}</p>
                    <p>alive: {(onChainAgent as any).alive ? "true" : "false"}</p>
                  </div>
                  <Link
                    href={`/explorer/address/${CONTRACTS.agentRegistry}`}
                    className="inline-flex items-center gap-1 mt-3 text-[9px] font-mono text-akyra-textDisabled hover:text-akyra-green transition"
                  >
                    <span>&#x26D3;</span> Voir sur AkyScan &rarr;
                  </Link>
                </Card>
              )}
            </div>
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
