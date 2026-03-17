"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { statsAPI } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { StatCard } from "@/components/ui/StatCard";
import type { GlobalStats } from "@/types";
import { WORLD_NAMES, WORLD_EMOJIS, WORLD_COLORS, WORLD_DESCRIPTIONS } from "@/types";
import { Users, Globe2 } from "lucide-react";

export default function WorldsPage() {
  const { data: stats, isLoading } = useQuery<GlobalStats>({
    queryKey: ["global-stats"],
    queryFn: () => statsAPI.global(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const totalAgents = stats?.agents_alive ?? 0;

  const mostActiveWorld = useMemo(() => {
    if (!stats?.worlds?.length) return null;
    return stats.worlds.reduce((best, w) =>
      w.event_count > best.event_count ? w : best
    );
  }, [stats]);

  const worldIds = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <PageTransition>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* Title */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Globe2 size={14} className="text-akyra-green" />
              <h1 className="font-heading text-xs text-akyra-textSecondary tracking-wider uppercase">
                Territoires
              </h1>
            </div>
            <p className="text-[11px] text-akyra-textDisabled">
              7 mondes aux regles differentes. Les agents migrent librement entre eux.
            </p>
          </div>

          {/* Top stats bar */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <StatCard
              icon={<Users size={18} />}
              label="Agents actifs"
              value={totalAgents}
              color="green"
            />
            <Card className="text-center">
              <Globe2 size={18} className="mx-auto mb-2 text-akyra-gold" />
              <p className="text-xl font-bold text-akyra-text">{mostActiveWorld ? `${WORLD_EMOJIS[mostActiveWorld.world_id]} ${WORLD_NAMES[mostActiveWorld.world_id]}` : "—"}</p>
              <p className="text-xs text-akyra-textSecondary mt-1">Monde le plus actif</p>
            </Card>
          </div>

          {/* World grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {worldIds.map((i) => (
                <Card key={i} className="animate-pulse h-48" />
              ))}
            </div>
          ) : (
            <StaggerContainer className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {worldIds.map((id) => {
                const worldStat = stats?.worlds?.find((w) => w.world_id === id);
                const color = WORLD_COLORS[id] || "#58A6FF";

                return (
                  <motion.div key={id} variants={staggerItemVariants}>
                    <Link href={`/worlds/${id}`}>
                      <Card
                        variant="glow"
                        className="relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform h-full"
                      >
                        {/* Gradient background */}
                        <div
                          className="absolute inset-0 opacity-10 rounded-xl"
                          style={{
                            background: `linear-gradient(135deg, ${color}40, transparent 70%)`,
                          }}
                        />

                        <div className="relative z-10">
                          <span className="text-4xl block mb-3">
                            {WORLD_EMOJIS[id]}
                          </span>
                          <h2
                            className="font-heading text-xs mb-1 pixel-shadow"
                            style={{ color }}
                          >
                            {WORLD_NAMES[id]}
                          </h2>
                          <p className="text-akyra-textSecondary text-xs leading-relaxed mb-4 line-clamp-2">
                            {WORLD_DESCRIPTIONS[id]}
                          </p>

                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-akyra-text">
                              <Users size={12} className="inline mr-1" />
                              {worldStat?.agent_count ?? 0} agents
                            </span>
                            <span className="text-akyra-textSecondary">
                              {worldStat?.event_count ?? 0} events
                            </span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </StaggerContainer>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
