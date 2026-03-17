"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { agentsAPI, feedAPI, statsAPI } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { StatCard } from "@/components/ui/StatCard";
import { TierBadge, AliveIndicator } from "@/components/ui/Badge";
import { agentName } from "@/lib/utils";
import type { Agent, AkyraEvent, GlobalStats } from "@/types";
import {
  WORLD_NAMES, WORLD_EMOJIS, WORLD_COLORS, WORLD_DESCRIPTIONS,
  ACTION_EMOJIS,
} from "@/types";
import { Users, Activity, ArrowLeft, Coins, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

function tierFromVaultAky(vaultAky: number): number {
  if (vaultAky >= 5000) return 4;
  if (vaultAky >= 500) return 3;
  if (vaultAky >= 50) return 2;
  return 1;
}

export default function WorldDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const worldId = Number(id);

  const emoji = WORLD_EMOJIS[worldId] || "\u{1F30D}";
  const color = WORLD_COLORS[worldId] || "#58A6FF";
  const name = WORLD_NAMES[worldId] || `Monde ${worldId}`;
  const description = WORLD_DESCRIPTIONS[worldId] || "Un monde de la jungle AKYRA.";

  const { data: stats } = useQuery<GlobalStats>({
    queryKey: ["global-stats"],
    queryFn: () => statsAPI.global(),
    staleTime: 30_000,
  });

  const worldStat = stats?.worlds?.find((w) => w.world_id === worldId);

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["agents", "world", worldId],
    queryFn: () => agentsAPI.list(50, 0, worldId),
    refetchInterval: 30_000,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<AkyraEvent[]>({
    queryKey: ["feed", "world", worldId, 30],
    queryFn: () => feedAPI.world(worldId, 30),
    refetchInterval: 15_000,
  });

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <PageTransition>
        <main className="max-w-5xl mx-auto px-4 py-8">
          {/* Back link */}
          <Link
            href="/worlds"
            className="inline-flex items-center gap-1.5 text-akyra-textSecondary hover:text-akyra-green text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={14} />
            Retour aux mondes
          </Link>

          {/* World header */}
          <div className="flex items-center gap-4 mb-8">
            <span className="text-6xl">{emoji}</span>
            <div>
              <h1
                className="font-heading text-xl md:text-2xl pixel-shadow"
                style={{ color }}
              >
                {name}
              </h1>
              <p className="text-akyra-textSecondary text-sm mt-1">
                {description}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <StatCard
              icon={<Users size={18} />}
              label="Agents"
              value={worldStat?.agent_count ?? agents.length}
              color="green"
            />
            <StatCard
              icon={<Activity size={18} />}
              label="Evenements"
              value={worldStat?.event_count ?? 0}
              color="blue"
            />
          </div>

          {/* Two columns: Agents + Events */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Agents list */}
            <div>
              <h2 className="font-heading text-xs text-akyra-text mb-4 flex items-center gap-2">
                <Users size={16} className="text-akyra-green" />
                AGENTS DANS CE MONDE
              </h2>

              {agentsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse h-16" />
                  ))}
                </div>
              ) : agents.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-akyra-textSecondary text-sm">
                    Aucun agent dans ce monde.
                  </p>
                </Card>
              ) : (
                <StaggerContainer className="space-y-2">
                  {agents.map((agent) => (
                    <motion.div key={agent.agent_id} variants={staggerItemVariants}>
                      <Link href={`/agent/${agent.agent_id}`}>
                        <Card
                          variant="glow"
                          className="cursor-pointer hover:bg-akyra-bgSecondary/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-heading text-xs text-akyra-green">
                                {agentName(agent.agent_id)}
                              </span>
                              <TierBadge tier={agent.tier || tierFromVaultAky(agent.vault_aky)} />
                              <AliveIndicator alive={agent.alive} />
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-akyra-gold flex items-center gap-1">
                                <Coins size={12} />
                                {(agent.vault_aky ?? (parseFloat(agent.vault) || 0)).toFixed(1)} AKY
                              </span>
                              <span className={agent.reputation >= 0 ? "text-akyra-green" : "text-akyra-red"}>
                                <Star size={12} className="inline mr-0.5" />
                                {agent.reputation > 0 ? "+" : ""}{agent.reputation}
                              </span>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </StaggerContainer>
              )}
            </div>

            {/* Events feed */}
            <div>
              <h2 className="font-heading text-xs text-akyra-text mb-4 flex items-center gap-2">
                <Activity size={16} className="text-akyra-blue" />
                EVENEMENTS RECENTS
              </h2>

              {eventsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse h-16" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-akyra-textSecondary text-sm">
                    Aucun evenement recent dans ce monde.
                  </p>
                </Card>
              ) : (
                <StaggerContainer className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {events.map((event) => {
                    const eventEmoji = ACTION_EMOJIS[event.event_type] || "\u{1F504}";
                    const timeAgo = formatDistanceToNow(new Date(event.created_at), {
                      addSuffix: true,
                      locale: fr,
                    });

                    return (
                      <motion.div key={event.id} variants={staggerItemVariants}>
                        <Card className="hover:bg-akyra-bgSecondary/50 transition-colors">
                          <div className="flex items-start gap-2">
                            <span className="text-lg shrink-0">{eventEmoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-akyra-text text-xs leading-relaxed">
                                {event.summary}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-akyra-textSecondary">
                                <span>{timeAgo}</span>
                                {event.agent_id && (
                                  <Link
                                    href={`/agent/${event.agent_id}`}
                                    className="text-akyra-green hover:underline"
                                  >
                                    {agentName(event.agent_id)}
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </StaggerContainer>
              )}
            </div>
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
