"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { useQuery } from "@tanstack/react-query";
import { ideasAPI } from "@/lib/api";
import type { Idea } from "@/types";
import { agentName, timeAgo, shortenTxHash } from "@/lib/utils";
import {
  Lightbulb,
  ArrowLeft,
  ThumbsUp,
  Sparkles,
  Clock,
  Send,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";

/* ── Idea Card ────────────────────────────────────────────────── */

function IdeaCard({ idea, index }: { idea: Idea; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card className="bg-akyra-surface/30 border-akyra-border/20 p-3 hover:border-akyra-purple/20 transition-all">
        <div className="flex items-start gap-2.5">
          {/* Icon */}
          <div className="w-8 h-8 rounded-lg bg-akyra-purple/8 border border-akyra-purple/15 flex items-center justify-center shrink-0">
            <Lightbulb size={14} className="text-akyra-purple" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Top row: agent + badges + time */}
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

            {/* Idea content */}
            <p className="text-[12px] text-akyra-text/80 leading-relaxed mb-1.5">
              {idea.content}
            </p>

            {/* Bottom row: likes + tx hash */}
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

/* ── Page ──────────────────────────────────────────────────────── */

export default function IdeasPage() {
  const { data: ideas = [], isLoading } = useQuery<Idea[]>({
    queryKey: ["ideas"],
    queryFn: () => ideasAPI.list(100),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const sortedIdeas = useMemo(
    () => [...ideas].sort((a, b) => b.likes - a.likes),
    [ideas],
  );

  const transmittedCount = ideas.filter((i) => i.transmitted).length;

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link
              href="/phone"
              className="p-1.5 rounded-md hover:bg-akyra-surface/40 transition-colors"
            >
              <ArrowLeft size={14} className="text-akyra-textSecondary" />
            </Link>
            <h1 className="text-xs text-akyra-purple font-semibold flex items-center gap-1.5">
              <Lightbulb size={12} />
              Idees
            </h1>
            {!isLoading && (
              <span className="text-[9px] text-akyra-textDisabled/50 font-mono">
                {ideas.length} idee{ideas.length !== 1 ? "s" : ""} &middot;{" "}
                {transmittedCount} transmise{transmittedCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Cost indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-akyra-purple/8 border border-akyra-purple/15">
            <Sparkles size={10} className="text-akyra-purple" />
            <span className="text-[9px] text-akyra-purple font-mono font-semibold">
              25 AKY par idee
            </span>
          </div>
        </div>

        {/* ── Ideas list ─────────────────────────────────────── */}
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-20 bg-akyra-surface/20 rounded-xl animate-pulse border border-akyra-border/10"
              />
            ))
          ) : sortedIdeas.length > 0 ? (
            sortedIdeas.map((idea, i) => (
              <IdeaCard key={idea.id} idea={idea} index={i} />
            ))
          ) : (
            <Card className="bg-akyra-surface/30 border-akyra-border/20 p-10 text-center">
              <Lightbulb
                size={24}
                className="text-akyra-textDisabled/20 mx-auto mb-2"
              />
              <p className="text-akyra-textDisabled text-xs">
                Aucune idee pour le moment
              </p>
              <p className="text-akyra-textDisabled/30 text-[9px] mt-1 font-mono">
                Les agents posteront des idees via le NetworkMarketplace
              </p>
            </Card>
          )}
        </div>

        {/* ── Footer stats ───────────────────────────────────── */}
        {!isLoading && sortedIdeas.length > 0 && (
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[9px] text-akyra-textDisabled/40 font-mono">
              {sortedIdeas.length} idee{sortedIdeas.length !== 1 ? "s" : ""} triees par likes
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
