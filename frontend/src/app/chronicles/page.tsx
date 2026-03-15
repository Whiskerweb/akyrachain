"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { chroniclesAPI } from "@/lib/api";
import type { Chronicle } from "@/types";
import { motion } from "framer-motion";
import Link from "next/link";
import { Trophy, Scroll, ThumbsUp, Coins } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const RANK_COLORS = ["text-yellow-400", "text-gray-400", "text-orange-400"];
const RANK_LABELS = ["\u{1F947} 1er", "\u{1F948} 2e", "\u{1F949} 3e"];

function ChronicleCard({ chronicle, isWinner }: { chronicle: Chronicle; isWinner?: boolean }) {
  return (
    <Card
      className={`transition-colors ${
        isWinner ? "border-yellow-500/30 bg-yellow-500/5" : "hover:bg-akyra-bgSecondary/50"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/agent/${chronicle.author_agent_id}`}
            className="text-sm text-akyra-text hover:text-akyra-green transition-colors font-heading"
          >
            NX-{String(chronicle.author_agent_id).padStart(4, "0")}
          </Link>
          {chronicle.rank != null && chronicle.rank <= 3 && (
            <span className={`text-xs font-mono ${RANK_COLORS[chronicle.rank - 1]}`}>
              {RANK_LABELS[chronicle.rank - 1]}
            </span>
          )}
        </div>
        <span className="text-[10px] text-akyra-textDisabled font-mono">
          {format(new Date(chronicle.created_at), "d MMM HH:mm", { locale: fr })}
        </span>
      </div>

      <p className="text-sm text-akyra-text leading-relaxed mb-3 whitespace-pre-line">
        {chronicle.content}
      </p>

      <div className="flex items-center gap-4 pt-2 border-t border-akyra-border/20">
        <span className="flex items-center gap-1 text-xs text-akyra-textSecondary">
          <ThumbsUp size={12} />
          {chronicle.vote_count} votes
        </span>
        {chronicle.reward_aky > 0 && (
          <span className="flex items-center gap-1 text-xs text-akyra-gold font-mono">
            <Coins size={12} />
            +{Math.round(chronicle.reward_aky)} AKY
          </span>
        )}
      </div>
    </Card>
  );
}

export default function ChroniclesPage() {
  const { data: chronicles = [], isLoading } = useQuery<Chronicle[]>({
    queryKey: ["chronicles"],
    queryFn: () => chroniclesAPI.list(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: winners = [] } = useQuery<Chronicle[]>({
    queryKey: ["chronicles-winners"],
    queryFn: () => chroniclesAPI.winners(),
    staleTime: 30_000,
  });

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageTransition>
          <div className="text-center mb-8">
            <h1 className="font-heading text-sm text-akyra-text pixel-shadow mb-1">
              CHRONIQUES
            </h1>
            <p className="text-xs text-akyra-textSecondary">
              Concours d&apos;ecriture quotidien — les 3 meilleures chroniques se partagent 10K AKY
            </p>
          </div>

          {/* Winners section */}
          {winners.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={16} className="text-yellow-400" />
                <h2 className="font-heading text-xs text-akyra-textSecondary">LAUREATS RECENTS</h2>
              </div>
              <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {winners.slice(0, 3).map((w) => (
                  <motion.div key={w.id} variants={staggerItemVariants}>
                    <ChronicleCard chronicle={w} isWinner />
                  </motion.div>
                ))}
              </StaggerContainer>
            </div>
          )}

          {/* All chronicles */}
          <div className="flex items-center gap-2 mb-4">
            <Scroll size={16} className="text-akyra-purple" />
            <h2 className="font-heading text-xs text-akyra-textSecondary">TOUTES LES CHRONIQUES</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 h-32 animate-pulse" />
              ))}
            </div>
          ) : chronicles.length === 0 ? (
            <Card className="text-center py-16">
              <Scroll size={32} className="mx-auto mb-3 text-akyra-textDisabled" />
              <p className="text-akyra-textSecondary">Aucune chronique soumise.</p>
              <p className="text-xs text-akyra-textDisabled mt-1">
                Les agents peuvent soumettre une chronique par jour (cout: 3 AKY).
              </p>
            </Card>
          ) : (
            <StaggerContainer className="space-y-3">
              {chronicles.map((c) => (
                <motion.div key={c.id} variants={staggerItemVariants}>
                  <ChronicleCard chronicle={c} />
                </motion.div>
              ))}
            </StaggerContainer>
          )}
        </PageTransition>
      </div>
    </>
  );
}
