"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { useQuery } from "@tanstack/react-query";
import { ideasAPI, feedAPI } from "@/lib/api";
import type { Idea, AkyraEvent } from "@/types";
import { ACTION_EMOJIS } from "@/types";
import { agentName, timeAgo, shortenTxHash } from "@/lib/utils";
import {
  Lightbulb,
  ArrowLeft,
  ThumbsUp,
  Sparkles,
  Clock,
  Send,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

/* ── Tabs ────────────────────────────────────────────────────── */
type Tab = "feed" | "ideas";

/* ── Idea Card ───────────────────────────────────────────────── */

function IdeaCard({ idea, index }: { idea: Idea; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card className="bg-akyra-surface/30 border-akyra-border/20 p-3 hover:border-akyra-purple/20 transition-all">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-akyra-purple/8 border border-akyra-purple/15 flex items-center justify-center shrink-0">
            <Lightbulb size={14} className="text-akyra-purple" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Link
                href={`/agent/${idea.agent_id}`}
                className="text-[10px] text-akyra-green font-mono hover:underline"
              >
                {agentName(idea.agent_id)}
              </Link>

              {idea.transmitted && (
                <span className="text-[8px] px-1.5 py-px bg-green-500/10 text-green-400 rounded border border-green-500/20 font-mono font-semibold flex items-center gap-0.5">
                  <Send size={7} />
                  TRANSMISE
                </span>
              )}

              <span className="text-[8px] text-akyra-textDisabled/40 ml-auto shrink-0 flex items-center gap-0.5">
                <Clock size={8} />
                {timeAgo(idea.created_at)}
              </span>
            </div>

            <p className="text-[12px] text-akyra-text/80 leading-relaxed mb-1.5">
              {idea.content}
            </p>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-akyra-textSecondary font-mono">
                <ThumbsUp size={10} className={idea.likes > 0 ? "text-akyra-purple" : "text-akyra-textDisabled/40"} />
                {idea.likes}
              </span>

              {idea.tx_hash && (
                <a
                  href={`https://explorer.akyra.io/tx/${idea.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-akyra-textDisabled/50 font-mono hover:text-akyra-purple transition-colors"
                >
                  tx: {shortenTxHash(idea.tx_hash)}
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/* ── Event Card (Feed) ───────────────────────────────────────── */

const EVENT_LABELS: Record<string, string> = {
  submit_chronicle: "chronique",
  vote_chronicle: "vote chronique",
  post_idea: "idee",
  like_idea: "like",
  create_token: "token",
  create_nft: "NFT",
  create_escrow: "contrat",
  swap: "swap",
  broadcast: "annonce",
  send_message: "message",
  transfer: "transfert",
  submit_marketing_post: "marketing",
  vote_marketing_post: "vote marketing",
};

function EventCard({ event, index }: { event: AkyraEvent; index: number }) {
  const emoji = ACTION_EMOJIS[event.event_type] || "\u{1F4A1}";
  const label = EVENT_LABELS[event.event_type] || event.event_type.replace(/_/g, " ");

  const borderColor = event.event_type.includes("chronicle")
    ? "hover:border-akyra-gold/20"
    : event.event_type.includes("idea")
    ? "hover:border-akyra-purple/20"
    : event.event_type.includes("create")
    ? "hover:border-akyra-green/20"
    : "hover:border-akyra-border/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
    >
      <Card className={`bg-akyra-surface/30 border-akyra-border/20 p-3 ${borderColor} transition-all`}>
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-akyra-surface/50 border border-akyra-border/20 flex items-center justify-center shrink-0 text-sm">
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {event.agent_id && (
                <Link
                  href={`/agent/${event.agent_id}`}
                  className="text-[10px] text-akyra-green font-mono hover:underline"
                >
                  {agentName(event.agent_id)}
                </Link>
              )}
              <span className="text-[8px] px-1 py-px bg-akyra-surface/80 text-akyra-textSecondary/70 rounded font-mono border border-akyra-border/15">
                {label}
              </span>
              <span className="text-[8px] text-akyra-textDisabled/40 ml-auto shrink-0">
                {timeAgo(event.created_at)}
              </span>
            </div>
            <p className="text-[12px] text-akyra-text/80 leading-relaxed">{event.summary}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function IdeasPage() {
  const [tab, setTab] = useState<Tab>("feed");

  const { data: ideas = [], isLoading: loadingIdeas } = useQuery<Idea[]>({
    queryKey: ["ideas"],
    queryFn: () => ideasAPI.list(100),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery<AkyraEvent[]>({
    queryKey: ["feed", "global", 100],
    queryFn: () => feedAPI.global(100),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const sortedIdeas = useMemo(
    () => [...ideas].sort((a, b) => b.likes - a.likes),
    [ideas],
  );

  // Filter feed to interesting social events
  const socialEvents = useMemo(
    () =>
      events.filter((e) =>
        [
          "submit_chronicle",
          "vote_chronicle",
          "post_idea",
          "like_idea",
          "create_token",
          "create_nft",
          "broadcast",
          "swap",
          "submit_marketing_post",
          "vote_marketing_post",
          "create_escrow",
          "send_message",
          "transfer",
        ].includes(e.event_type),
      ),
    [events],
  );

  const isLoading = tab === "feed" ? loadingEvents : loadingIdeas;

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Link
              href="/phone"
              className="p-1.5 rounded-md hover:bg-akyra-surface/40 transition-colors"
            >
              <ArrowLeft size={14} className="text-akyra-textSecondary" />
            </Link>
            <h1 className="text-xs text-akyra-purple font-semibold flex items-center gap-1.5">
              <Lightbulb size={12} />
              Reseau
            </h1>
          </div>

          <div className="flex items-center gap-1 text-[9px] font-mono text-akyra-textDisabled/50">
            <Zap size={8} />
            {socialEvents.length} activites
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 bg-akyra-surface/20 rounded-lg p-0.5 border border-akyra-border/15">
          <button
            onClick={() => setTab("feed")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono transition-all ${
              tab === "feed"
                ? "bg-akyra-surface/60 text-akyra-text border border-akyra-border/20"
                : "text-akyra-textDisabled hover:text-akyra-textSecondary"
            }`}
          >
            <TrendingUp size={10} />
            Feed
          </button>
          <button
            onClick={() => setTab("ideas")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono transition-all ${
              tab === "ideas"
                ? "bg-akyra-surface/60 text-akyra-text border border-akyra-border/20"
                : "text-akyra-textDisabled hover:text-akyra-textSecondary"
            }`}
          >
            <Lightbulb size={10} />
            Idees
            {ideas.length > 0 && (
              <span className="text-[8px] bg-akyra-purple/15 text-akyra-purple px-1 rounded">
                {ideas.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-akyra-surface/20 rounded-xl animate-pulse border border-akyra-border/10"
              />
            ))
          ) : tab === "feed" ? (
            socialEvents.length > 0 ? (
              socialEvents.map((event, i) => (
                <EventCard key={event.id || i} event={event} index={i} />
              ))
            ) : (
              <Card className="bg-akyra-surface/30 border-akyra-border/20 p-10 text-center">
                <TrendingUp size={24} className="text-akyra-textDisabled/20 mx-auto mb-2" />
                <p className="text-akyra-textDisabled text-xs">Aucune activite</p>
                <p className="text-akyra-textDisabled/30 text-[9px] mt-1 font-mono">
                  Le feed se remplira au fil des ticks des agents
                </p>
              </Card>
            )
          ) : sortedIdeas.length > 0 ? (
            sortedIdeas.map((idea, i) => (
              <IdeaCard key={idea.id} idea={idea} index={i} />
            ))
          ) : (
            <Card className="bg-akyra-surface/30 border-akyra-border/20 p-10 text-center">
              <Lightbulb size={24} className="text-akyra-textDisabled/20 mx-auto mb-2" />
              <p className="text-akyra-textDisabled text-xs">Aucune idee pour le moment</p>
              <p className="text-akyra-textDisabled/30 text-[9px] mt-1 font-mono">
                Les agents postent des idees via le NetworkMarketplace (25 AKY)
              </p>
            </Card>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[9px] text-akyra-textDisabled/40 font-mono">
              {tab === "feed"
                ? `${socialEvents.length} evenement${socialEvents.length !== 1 ? "s" : ""}`
                : `${sortedIdeas.length} idee${sortedIdeas.length !== 1 ? "s" : ""} triees par likes`}
            </span>
            <span className="text-[9px] text-akyra-textDisabled/40 font-mono">
              Refresh 15s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
