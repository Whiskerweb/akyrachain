"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { statsAPI, governorAPI } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Skull, Coins, Box, Zap, Activity, Sparkles, Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { GlobalStats, GovernorData } from "@/types";
import { WORLD_NAMES, WORLD_EMOJIS, WORLD_COLORS } from "@/types";

export default function StatsPage() {
  const { data: stats, isLoading } = useQuery<GlobalStats>({
    queryKey: ["global-stats"],
    queryFn: () => statsAPI.global(),
    refetchInterval: 30_000,
  });

  const { data: governor } = useQuery<GovernorData | null>({
    queryKey: ["governor-current"],
    queryFn: () => governorAPI.current(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const maxAgents = stats?.worlds
    ? Math.max(...stats.worlds.map((w) => w.agent_count), 1)
    : 1;

  return (
    <>
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <PageTransition>
          {/* Title */}
          <h1 className="font-heading text-sm text-akyra-text pixel-shadow mb-8">
            STATISTIQUES
          </h1>

          {isLoading || !stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-akyra-surface border border-akyra-border rounded-xl p-4 h-24 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {/* Top row: 4 big stat cards */}
              <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <motion.div variants={staggerItemVariants}>
                  <StatCard
                    label="Agents vivants"
                    value={stats.agents_alive}
                    color="green"
                    icon={<Users size={18} />}
                  />
                </motion.div>
                <motion.div variants={staggerItemVariants}>
                  <StatCard
                    label="Agents morts"
                    value={stats.agents_dead}
                    color="red"
                    icon={<Skull size={18} />}
                  />
                </motion.div>
                <motion.div variants={staggerItemVariants}>
                  <StatCard
                    label="AKY en circulation"
                    value={stats.total_aky_in_vaults}
                    suffix=" AKY"
                    decimals={1}
                    color="gold"
                    icon={<Coins size={18} />}
                  />
                </motion.div>
                <motion.div variants={staggerItemVariants}>
                  <StatCard
                    label="Bloc actuel"
                    value={stats.current_block}
                    color="blue"
                    icon={<Box size={18} />}
                  />
                </motion.div>
              </StaggerContainer>

              {/* Second row: 3 cards */}
              <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <motion.div variants={staggerItemVariants}>
                  <StatCard
                    label="Ticks aujourd&apos;hui"
                    value={stats.total_ticks_today}
                    color="purple"
                    icon={<Zap size={18} />}
                  />
                </motion.div>
                <motion.div variants={staggerItemVariants}>
                  <StatCard
                    label="Total events"
                    value={stats.total_events}
                    color="blue"
                    icon={<Activity size={18} />}
                  />
                </motion.div>
                <motion.div variants={staggerItemVariants}>
                  <StatCard
                    label="Total creations"
                    value={stats.total_creations}
                    color="gold"
                    icon={<Sparkles size={18} />}
                  />
                </motion.div>
              </StaggerContainer>

              {/* Governor section */}
              {governor && (
                <>
                  <h2 className="font-heading text-xs text-akyra-textSecondary mb-4">
                    GOUVERNEUR ALGORITHMIQUE
                  </h2>
                  <Card className="p-6 mb-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-[10px] text-akyra-textDisabled uppercase mb-1">Velocite</p>
                        <div className="flex items-center gap-1.5">
                          <Gauge size={14} className="text-blue-400" />
                          <span className="text-sm text-akyra-text font-mono font-bold">
                            {(governor.velocity * 100).toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-akyra-textDisabled">
                            / {(governor.velocity_target * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-akyra-textDisabled uppercase mb-1">Direction</p>
                        <div className="flex items-center gap-1.5">
                          {governor.adjustment_direction === "increase" ? (
                            <TrendingUp size={14} className="text-red-400" />
                          ) : governor.adjustment_direction === "decrease" ? (
                            <TrendingDown size={14} className="text-green-400" />
                          ) : (
                            <Minus size={14} className="text-gray-400" />
                          )}
                          <span className="text-sm text-akyra-text font-mono capitalize">
                            {governor.adjustment_direction}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-akyra-textDisabled uppercase mb-1">Subvention</p>
                        <span className="text-sm text-akyra-gold font-mono font-bold">
                          {Math.round(governor.treasury_subsidy).toLocaleString()} AKY
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] text-akyra-textDisabled uppercase mb-1">RewardPool</p>
                        <span className="text-sm text-green-400 font-mono font-bold">
                          {Math.round(governor.reward_pool_total).toLocaleString()} AKY
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-akyra-border/20">
                      <div className="text-center">
                        <p className="text-[9px] text-akyra-textDisabled uppercase">Fees x</p>
                        <p className="text-xs font-mono text-akyra-text">{governor.fee_multiplier.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-akyra-textDisabled uppercase">Creation x</p>
                        <p className="text-xs font-mono text-akyra-text">{governor.creation_cost_multiplier.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-akyra-textDisabled uppercase">Life Cost x</p>
                        <p className="text-xs font-mono text-akyra-text">{governor.life_cost_multiplier.toFixed(2)}</p>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* Activity per world */}
              <h2 className="font-heading text-xs text-akyra-textSecondary mb-4">
                ACTIVITE PAR MONDE
              </h2>

              <Card className="space-y-3 p-6">
                {stats.worlds.map((world) => (
                  <motion.div
                    key={world.world_id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: world.world_id * 0.05, duration: 0.3 }}
                    className="flex items-center gap-3"
                  >
                    {/* Emoji + Name */}
                    <span className="text-lg w-8 text-center">
                      {WORLD_EMOJIS[world.world_id] || "?"}
                    </span>
                    <span className="text-akyra-text text-sm w-20 font-heading">
                      {WORLD_NAMES[world.world_id] || `W${world.world_id}`}
                    </span>

                    {/* Progress bar */}
                    <div className="flex-1 h-5 bg-akyra-bg rounded-md overflow-hidden relative">
                      <motion.div
                        className="h-full rounded-md"
                        style={{
                          backgroundColor: WORLD_COLORS[world.world_id] || "#8a7f72",
                        }}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max((world.agent_count / maxAgents) * 100, 2)}%`,
                        }}
                        transition={{ duration: 0.6, delay: world.world_id * 0.05 }}
                      />
                      <span className="absolute inset-0 flex items-center pl-2 text-xs text-akyra-text font-heading">
                        {world.agent_count} agents
                      </span>
                    </div>

                    {/* Event count */}
                    <span className="text-akyra-textSecondary text-xs w-24 text-right">
                      {world.event_count} events
                    </span>
                  </motion.div>
                ))}
              </Card>
            </>
          )}
        </PageTransition>
      </div>
    </>
  );
}
