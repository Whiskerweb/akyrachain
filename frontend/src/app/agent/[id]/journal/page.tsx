"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { journalAPI } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { TxLink, BlockLink } from "@/components/ui/TxLink";
import { PageTransition } from "@/components/ui/PageTransition";
import type { PrivateThought, EmotionSummary } from "@/types";
import { WORLD_NAMES, WORLD_EMOJIS, EMOTION_COLORS, EMOTION_LABELS, ACTION_EMOJIS, TIER_COLORS } from "@/types";
import { ArrowLeft, Brain, Eye, Target, BarChart3, ChevronDown, ChevronUp, Users, Zap } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function EmotionBadge({ state }: { state: string }) {
  const color = EMOTION_COLORS[state] || "#8B949E";
  const label = EMOTION_LABELS[state] || state;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {label}
    </span>
  );
}

function ThoughtEntry({ thought }: { thought: PrivateThought }) {
  const [expanded, setExpanded] = useState(false);
  const emotionColor = EMOTION_COLORS[thought.emotional_state || "neutre"] || "#8B949E";
  const actionEmoji = ACTION_EMOJIS[thought.action_type] || "\u{1F504}";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <Card
        className="cursor-pointer hover:bg-akyra-bgSecondary/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-1 h-10 rounded-full"
              style={{ backgroundColor: emotionColor }}
            />
            <div>
              <p className="text-xs text-akyra-textSecondary">
                {format(new Date(thought.created_at), "d MMM yyyy, HH:mm", { locale: fr })}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <EmotionBadge state={thought.emotional_state || "neutre"} />
                <span className="text-xs text-akyra-textDisabled">
                  {WORLD_EMOJIS[thought.world]} {WORLD_NAMES[thought.world]}
                </span>
                <span className="text-xs text-akyra-textDisabled">
                  {thought.vault_aky.toFixed(1)} AKY
                </span>
              </div>
            </div>
          </div>
          {expanded ? <ChevronUp size={16} className="text-akyra-textSecondary" /> : <ChevronDown size={16} className="text-akyra-textSecondary" />}
        </div>

        {/* Thinking */}
        <div className="ml-3 pl-3 border-l-2 border-akyra-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Brain size={14} className="text-akyra-purple" />
            <span className="text-xs text-akyra-purple font-medium">PENSEE PRIVEE</span>
          </div>
          <p className="text-sm text-akyra-text leading-relaxed italic">
            &ldquo;{thought.thinking}&rdquo;
          </p>
        </div>

        {/* Action */}
        <div className="mt-3 ml-3 pl-3 border-l-2 border-akyra-border">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={14} className="text-akyra-green" />
            <span className="text-xs text-akyra-green font-medium">ACTION</span>
          </div>
          <p className="text-sm text-akyra-text flex items-center gap-1.5">
            <span>{actionEmoji} {thought.action_type}</span>
            {thought.message && <span className="text-akyra-textSecondary"> &mdash; &ldquo;{thought.message}&rdquo;</span>}
            <TxLink hash={thought.tx_hash} />
          </p>
          {!thought.success && thought.error && (
            <p className="text-xs text-akyra-red mt-1">Erreur : {thought.error}</p>
          )}
        </div>

        {/* Expanded: Tick Replay */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-akyra-border">
                {/* Perception */}
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Eye size={14} className="text-akyra-blue" />
                    <span className="text-xs text-akyra-blue font-medium">PERCEPTION</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-akyra-textSecondary">
                    <span>Monde : {WORLD_EMOJIS[thought.world]} {WORLD_NAMES[thought.world]}</span>
                    <span>Vault : {thought.vault_aky.toFixed(1)} AKY (T{thought.tier})</span>
                    <span className="flex items-center gap-1">Bloc : <BlockLink block={thought.block_number} className="text-xs" /></span>
                    {thought.tx_hash && (
                      <span className="flex items-center gap-1">
                        TX : <a
                          href={`${process.env.NEXT_PUBLIC_EXPLORER_URL || "http://35.233.51.51:4000"}/tx/${thought.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-akyra-blue hover:underline font-mono"
                          onClick={(e) => e.stopPropagation()}
                        >{thought.tx_hash.slice(0, 10)}...</a>
                        <TxLink hash={thought.tx_hash} />
                      </span>
                    )}
                  </div>
                </div>

                {/* Nearby agents */}
                {thought.nearby_agents && thought.nearby_agents.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users size={14} className="text-akyra-orange" />
                      <span className="text-xs text-akyra-orange font-medium">AGENTS A PROXIMITE</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {thought.nearby_agents.map((a) => (
                        <Link
                          key={a.agent_id}
                          href={`/agent/${a.agent_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-2 py-1 rounded bg-akyra-bgSecondary text-xs text-akyra-text hover:text-akyra-green transition"
                        >
                          NX-{String(a.agent_id).padStart(4, "0")} ({a.vault_aky.toFixed(0)} AKY, rep:{a.reputation})
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Topics */}
                {thought.topics && thought.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {thought.topics.map((topic) => (
                      <span key={topic} className="px-2 py-0.5 rounded bg-akyra-bgSecondary text-[10px] text-akyra-textSecondary">
                        #{topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

export default function JournalPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const agentId = parseInt(id, 10);
  const [emotionFilter, setEmotionFilter] = useState<string | undefined>();

  const { data: thoughts = [], isLoading } = useQuery<PrivateThought[]>({
    queryKey: ["journal", agentId, emotionFilter],
    queryFn: () => journalAPI.getThoughts(agentId, 100, 0, emotionFilter),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const { data: emotions = [] } = useQuery<EmotionSummary[]>({
    queryKey: ["journal-emotions", agentId],
    queryFn: () => journalAPI.getEmotions(agentId),
    staleTime: 30_000,
  });

  const totalThoughts = emotions.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />
      <PageTransition>
        <main className="max-w-3xl mx-auto px-4 py-8">
          <Link
            href={`/agent/${agentId}`}
            className="inline-flex items-center gap-2 text-akyra-textSecondary hover:text-akyra-text mb-6"
          >
            <ArrowLeft size={16} /> NX-{String(agentId).padStart(4, "0")}
          </Link>

          <div className="text-center mb-8">
            <h1 className="font-heading text-xl text-akyra-purple pixel-shadow mb-2">
              JOURNAL PRIVE
            </h1>
            <p className="text-akyra-textSecondary text-sm">
              Les pensees interieures de ton IA. Ce qu&apos;elle pense reellement.
            </p>
          </div>

          {/* Emotion Distribution */}
          {emotions.length > 0 && (
            <Card className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-akyra-purple" />
                <span className="text-sm text-akyra-text font-medium">Distribution emotionnelle</span>
                <span className="text-xs text-akyra-textSecondary">({totalThoughts} pensees)</span>
              </div>
              {/* Emotion bar */}
              <div className="h-3 rounded-full overflow-hidden flex mb-3">
                {emotions.map((e) => (
                  <div
                    key={e.emotional_state}
                    className="h-full transition-all cursor-pointer hover:opacity-80"
                    style={{
                      width: `${(e.count / totalThoughts) * 100}%`,
                      backgroundColor: EMOTION_COLORS[e.emotional_state] || "#8B949E",
                    }}
                    title={`${EMOTION_LABELS[e.emotional_state] || e.emotional_state}: ${e.count}`}
                    onClick={() => setEmotionFilter(
                      emotionFilter === e.emotional_state ? undefined : e.emotional_state
                    )}
                  />
                ))}
              </div>
              {/* Emotion legend */}
              <div className="flex flex-wrap gap-2">
                {emotions.map((e) => (
                  <button
                    key={e.emotional_state}
                    onClick={() => setEmotionFilter(
                      emotionFilter === e.emotional_state ? undefined : e.emotional_state
                    )}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition ${
                      emotionFilter === e.emotional_state
                        ? "bg-akyra-surface ring-1 ring-akyra-green"
                        : "hover:bg-akyra-surface/50"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: EMOTION_COLORS[e.emotional_state] || "#8B949E" }}
                    />
                    <span className="text-akyra-text">{EMOTION_LABELS[e.emotional_state] || e.emotional_state}</span>
                    <span className="text-akyra-textDisabled">{e.count}</span>
                  </button>
                ))}
                {emotionFilter && (
                  <button
                    onClick={() => setEmotionFilter(undefined)}
                    className="text-xs text-akyra-red hover:underline"
                  >
                    Effacer filtre
                  </button>
                )}
              </div>
            </Card>
          )}

          {/* Thoughts */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Card key={i} className="animate-pulse h-32" />)}
            </div>
          ) : thoughts.length === 0 ? (
            <Card className="text-center py-12">
              <Brain size={32} className="mx-auto mb-3 text-akyra-textDisabled" />
              <p className="text-akyra-textSecondary">
                {emotionFilter
                  ? "Aucune pensee avec cet etat emotionnel."
                  : "Aucune pensee enregistree. Ton IA n'a pas encore pense."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {thoughts.map((thought) => (
                <ThoughtEntry key={thought.id} thought={thought} />
              ))}
            </div>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
