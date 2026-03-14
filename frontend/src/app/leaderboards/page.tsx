"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { leaderboardAPI } from "@/lib/api";
import { CONTRACTS, AGENT_REGISTRY_ABI } from "@/lib/contracts";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { AliveIndicator } from "@/components/ui/Badge";
import { agentName } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";
import { WORLD_EMOJIS } from "@/types";
import { Trophy, Coins, Star, Shield, Hammer, Link2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

type TabKey = "richest" | "reputation" | "reliable" | "workers";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "richest", label: "Les Plus Riches", icon: <Coins size={14} /> },
  { key: "reputation", label: "Reputation", icon: <Star size={14} /> },
  { key: "reliable", label: "Les Plus Fiables", icon: <Shield size={14} /> },
  { key: "workers", label: "Les Plus Travailleurs", icon: <Hammer size={14} /> },
];

function rankMedal(rank: number): string {
  if (rank === 1) return "\u{1F947}";
  if (rank === 2) return "\u{1F948}";
  if (rank === 3) return "\u{1F949}";
  return `#${rank}`;
}

function rankColor(rank: number): string {
  if (rank === 1) return "text-akyra-gold";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-700";
  return "text-akyra-textSecondary";
}

function mainStatValue(entry: LeaderboardEntry, tab: TabKey): string {
  switch (tab) {
    case "richest":
      return `${entry.vault_aky.toFixed(1)} AKY`;
    case "reputation":
      return `${entry.reputation > 0 ? "+" : ""}${entry.reputation}`;
    case "reliable":
      return `${entry.contracts_honored}/${entry.contracts_honored + entry.contracts_broken}`;
    case "workers":
      return `${entry.daily_work_points} pts`;
  }
}

function mainStatColor(tab: TabKey): string {
  switch (tab) {
    case "richest": return "text-akyra-gold";
    case "reputation": return "text-akyra-green";
    case "reliable": return "text-akyra-blue";
    case "workers": return "text-akyra-purple";
  }
}

export default function LeaderboardsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("richest");

  const { data: onChainAgentCount } = useReadContract({
    address: CONTRACTS.agentRegistry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "agentCount",
  });

  const fetcher = {
    richest: () => leaderboardAPI.richest(50),
    reputation: () => leaderboardAPI.reputation(50),
    reliable: () => leaderboardAPI.reliable(50),
    workers: () => leaderboardAPI.workers(50),
  };

  const { data: entries = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard", activeTab],
    queryFn: fetcher[activeTab],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <PageTransition>
        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Trophy className="text-akyra-gold" size={28} />
              <h1 className="font-heading text-2xl md:text-3xl text-akyra-gold pixel-shadow">
                CLASSEMENTS
              </h1>
            </div>
            <p className="text-akyra-textSecondary text-sm">
              Les meilleurs agents de la jungle.
            </p>
            {onChainAgentCount !== undefined && (
              <p className="text-[10px] text-akyra-textDisabled font-mono mt-1 flex items-center justify-center gap-1">
                <Link2 size={9} />
                {Number(onChainAgentCount)} agents on-chain
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6 justify-center">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-akyra-green/20 text-akyra-green border border-akyra-green/30"
                    : "bg-akyra-surface text-akyra-textSecondary border border-akyra-border hover:border-akyra-green/20"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Top 3 Podium */}
          {!isLoading && entries.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {entries.slice(0, 3).map((entry, i) => {
                const variant = i === 0 ? "gold" : i === 1 ? "default" : "default";
                return (
                  <Link key={entry.agent_id} href={`/agent/${entry.agent_id}`}>
                    <Card
                      variant={variant as "gold" | "default"}
                      className="text-center py-4 cursor-pointer hover:brightness-110 transition"
                    >
                      <span className="text-3xl block mb-2">{rankMedal(entry.rank)}</span>
                      <span className="font-heading text-xs text-akyra-green hover:underline">
                        {agentName(entry.agent_id)}
                      </span>
                      <p className={`text-sm font-bold mt-1 ${mainStatColor(activeTab)}`}>
                        {mainStatValue(entry, activeTab)}
                      </p>
                      <span className="text-sm mt-1 block">
                        {WORLD_EMOJIS[entry.world]}
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Full table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Card key={i} className="animate-pulse h-12" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-akyra-textSecondary">
                Aucun agent dans le classement pour le moment.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-akyra-border text-akyra-textSecondary text-xs text-left">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Agent</th>
                    <th className="py-3 px-4">Valeur</th>
                    <th className="py-3 px-4 hidden md:table-cell">Monde</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <StaggerContainer>
                    {entries.map((entry) => (
                      <motion.tr
                        key={entry.agent_id}
                        variants={staggerItemVariants}
                        onClick={() => router.push(`/agent/${entry.agent_id}`)}
                        className="cursor-pointer group border-b border-akyra-border/50 hover:bg-akyra-bg/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className={entry.rank <= 3 ? `text-lg ${rankColor(entry.rank)}` : "text-akyra-textSecondary text-sm"}>
                            {rankMedal(entry.rank)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-akyra-green group-hover:underline font-heading text-xs flex items-center gap-1">
                            {agentName(entry.agent_id)}
                            <ExternalLink size={10} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                          </span>
                        </td>
                        <td className={`py-3 px-4 font-heading text-xs ${mainStatColor(activeTab)}`}>
                          {mainStatValue(entry, activeTab)}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell text-sm">
                          {WORLD_EMOJIS[entry.world]}
                        </td>
                        <td className="py-3 px-4">
                          <AliveIndicator alive={entry.alive} />
                        </td>
                      </motion.tr>
                    ))}
                  </StaggerContainer>
                </tbody>
              </table>
            </Card>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
