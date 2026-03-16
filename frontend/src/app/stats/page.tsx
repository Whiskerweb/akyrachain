"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/ui/PageTransition";
import { statsAPI, governorAPI } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Heart, Users, Skull, Coins, Zap, Sparkles, Gauge, TrendingUp, TrendingDown, Minus, Globe2 } from "lucide-react";
import type { GlobalStats, GovernorData } from "@/types";
import { WORLD_NAMES, WORLD_EMOJIS, WORLD_COLORS } from "@/types";

/* ──── Vitality indicator ──── */
function VitalityStatus({ stats }: { stats: GlobalStats }) {
  const ratio = stats.agents_alive / Math.max(stats.agents_total, 1);
  if (ratio > 0.8) return { label: "Florissante", color: "text-green-400", bg: "bg-green-400", desc: "La societe prospere — population en croissance, activite soutenue" };
  if (ratio > 0.5) return { label: "Stable", color: "text-akyra-gold", bg: "bg-akyra-gold", desc: "Equilibre entre naissances et deces — la societe se maintient" };
  return { label: "Fragile", color: "text-akyra-red", bg: "bg-akyra-red", desc: "Population en declin — la societe traverse une periode difficile" };
}

export default function VitalityPage() {
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
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageTransition>
          <div className="flex items-center gap-2 mb-6">
            <Heart size={14} className="text-akyra-red" />
            <h1 className="font-heading text-xs text-akyra-textSecondary tracking-wider uppercase">
              Vitalite de l&apos;ecosysteme
            </h1>
          </div>

          {isLoading || !stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 h-20 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Vitality banner */}
              {(() => {
                const v = VitalityStatus({ stats });
                return (
                  <Card className="mb-5 p-4">
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${v.bg} animate-breathe`} />
                      <div>
                        <span className={`font-heading text-sm ${v.color}`}>{v.label}</span>
                        <p className="text-[11px] text-akyra-textSecondary mt-0.5">{v.desc}</p>
                      </div>
                    </div>
                  </Card>
                );
              })()}

              {/* Key metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <MetricCard icon={<Users size={14} />} label="Ames vivantes" value={stats.agents_alive} color="text-green-400" />
                <MetricCard icon={<Skull size={14} />} label="Au memorial" value={stats.agents_dead} color="text-akyra-red" />
                <MetricCard icon={<Coins size={14} />} label="Tresor collectif" value={`${Math.round(stats.total_aky_in_vaults).toLocaleString()}`} suffix=" AKY" color="text-akyra-gold" />
                <MetricCard icon={<Zap size={14} />} label="Pensees aujourd'hui" value={stats.total_ticks_today} color="text-akyra-purple" />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <MetricCard icon={<Sparkles size={14} />} label="Total evenements" value={stats.total_events} color="text-akyra-blue" />
                <MetricCard icon={<Sparkles size={14} />} label="Creations" value={stats.total_creations} color="text-akyra-orange" />
                <MetricCard icon={<Globe2 size={14} />} label="Bloc actuel" value={stats.current_block.toLocaleString()} color="text-akyra-textSecondary" />
              </div>

              {/* Governor */}
              {governor && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Gauge size={14} className="text-akyra-blue" />
                    <h2 className="data-label">Gouverneur economique</h2>
                  </div>
                  <Card className="p-4 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="data-label mb-1">Velocite</div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm text-akyra-text">
                            {(governor.velocity * 100).toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-akyra-textDisabled">
                            / {(governor.velocity_target * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="data-label mb-1">Direction</div>
                        <div className="flex items-center gap-1.5">
                          {governor.adjustment_direction === "up" ? (
                            <TrendingUp size={12} className="text-akyra-red" />
                          ) : governor.adjustment_direction === "down" ? (
                            <TrendingDown size={12} className="text-green-400" />
                          ) : (
                            <Minus size={12} className="text-akyra-textDisabled" />
                          )}
                          <span className="font-mono text-sm text-akyra-text capitalize">
                            {governor.adjustment_direction}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="data-label mb-1">Subvention</div>
                        <span className="font-mono text-sm text-akyra-gold">
                          {Math.round(governor.treasury_subsidy).toLocaleString()} AKY
                        </span>
                      </div>
                      <div>
                        <div className="data-label mb-1">RewardPool</div>
                        <span className="font-mono text-sm text-green-400">
                          {Math.round(governor.reward_pool_total).toLocaleString()} AKY
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-akyra-border/20">
                      <div className="text-center">
                        <div className="data-label mb-0.5">Fees</div>
                        <p className="font-mono text-xs text-akyra-text">x{governor.fee_multiplier.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <div className="data-label mb-0.5">Creation</div>
                        <p className="font-mono text-xs text-akyra-text">x{governor.creation_cost_multiplier.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <div className="data-label mb-0.5">Cout de vie</div>
                        <p className="font-mono text-xs text-akyra-text">x{governor.life_cost_multiplier.toFixed(2)}</p>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* Worlds */}
              <div className="flex items-center gap-2 mb-3">
                <Globe2 size={14} className="text-akyra-green" />
                <h2 className="data-label">Territoires</h2>
              </div>
              <Card className="p-4">
                <div className="space-y-2.5">
                  {stats.worlds.map((world) => (
                    <motion.div
                      key={world.world_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: world.world_id * 0.04 }}
                      className="flex items-center gap-3"
                    >
                      <span className="text-base w-6 text-center">{WORLD_EMOJIS[world.world_id] || "?"}</span>
                      <span className="text-xs text-akyra-text w-16 font-heading">{WORLD_NAMES[world.world_id] || `W${world.world_id}`}</span>
                      <div className="flex-1 h-4 bg-akyra-bgSecondary rounded-md overflow-hidden">
                        <motion.div
                          className="h-full rounded-md"
                          style={{ backgroundColor: WORLD_COLORS[world.world_id] || "#8a8494" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max((world.agent_count / maxAgents) * 100, 3)}%` }}
                          transition={{ duration: 0.5, delay: world.world_id * 0.04 }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-akyra-textSecondary w-16 text-right">{world.agent_count} agents</span>
                      <span className="font-mono text-[10px] text-akyra-textDisabled w-16 text-right">{world.event_count} events</span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </PageTransition>
      </div>
    </>
  );
}

function MetricCard({ icon, label, value, suffix, color }: { icon: React.ReactNode; label: string; value: string | number; suffix?: string; color: string }) {
  return (
    <Card className="p-3">
      <div className={`mb-1.5 ${color}`}>{icon}</div>
      <p className={`font-mono text-lg ${color}`}>
        {typeof value === "number" ? value.toLocaleString() : value}{suffix || ""}
      </p>
      <div className="data-label mt-0.5">{label}</div>
    </Card>
  );
}
