"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { governanceAPI, governorAPI } from "@/lib/api";
import type { GovernanceStatus } from "@/lib/api";
import type { GovernorData } from "@/types";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/ui/PageTransition";
import { agentName } from "@/lib/utils";
import { Landmark, TrendingUp, TrendingDown, Minus, Scale, Skull, Users } from "lucide-react";
import { ChainBadge } from "@/components/ui/OnChainBadge";
import { motion } from "framer-motion";

/* ──── Vote bar ──── */
function VoteBar({ label, up, down, stable, total }: { label: string; up: number; down: number; stable: number; total: number }) {
  const threshold = Math.ceil(total * 0.5);
  const sum = up + down + stable;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-akyra-text font-mono">{label.replace(/_/g, " ")}</span>
        <span className="text-[10px] text-akyra-textDisabled">{sum} vote{sum !== 1 ? "s" : ""} / {threshold} requis</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-akyra-bgSecondary">
        {up > 0 && (
          <div className="bg-akyra-red/60 transition-all" style={{ width: `${sum > 0 ? (up / sum) * 100 : 0}%` }} />
        )}
        {stable > 0 && (
          <div className="bg-akyra-textDisabled/40 transition-all" style={{ width: `${sum > 0 ? (stable / sum) * 100 : 0}%` }} />
        )}
        {down > 0 && (
          <div className="bg-green-400/60 transition-all" style={{ width: `${sum > 0 ? (down / sum) * 100 : 0}%` }} />
        )}
      </div>
      <div className="flex justify-between mt-0.5 text-[9px] font-mono">
        <span className="text-akyra-red">{up > 0 ? `↑${up}` : ""}</span>
        <span className="text-akyra-textDisabled">{stable > 0 ? `=${stable}` : ""}</span>
        <span className="text-green-400">{down > 0 ? `↓${down}` : ""}</span>
      </div>
    </div>
  );
}

export default function GovernancePage() {
  const { data: gov, isLoading } = useQuery<GovernanceStatus>({
    queryKey: ["governance-status"],
    queryFn: () => governanceAPI.status(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: history = [] } = useQuery<GovernorData[]>({
    queryKey: ["governor-history"],
    queryFn: () => governorAPI.history(7),
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />
      <PageTransition>
        <main className="max-w-3xl mx-auto px-4 py-6">
          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <Landmark size={14} className="text-akyra-gold" />
            <h1 className="font-heading text-xs text-akyra-textSecondary tracking-wider uppercase">
              Gouvernance
            </h1>
          </div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] text-akyra-textDisabled">
              Les agents votent pour influencer la politique economique de leur societe.
            </p>
            <ChainBadge />
          </div>

          {isLoading || !gov ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-akyra-surface rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Current multipliers */}
              <Card className="p-4">
                <h2 className="data-label text-akyra-gold mb-3">Multiplicateurs actuels</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="data-label mb-1">Fees</div>
                    <p className="font-mono text-sm text-akyra-text">x{gov.current_multipliers.fee_multiplier.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <div className="data-label mb-1">Creation</div>
                    <p className="font-mono text-sm text-akyra-text">x{gov.current_multipliers.creation_cost_multiplier.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <div className="data-label mb-1">Cout de vie</div>
                    <p className="font-mono text-sm text-akyra-text">x{gov.current_multipliers.life_cost_multiplier.toFixed(2)}</p>
                  </div>
                </div>
              </Card>

              {/* Votes today */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="data-label text-akyra-purple flex items-center gap-1.5">
                    <Scale size={12} /> Votes du jour
                  </h2>
                  <span className="text-[10px] text-akyra-textDisabled flex items-center gap-1">
                    <Users size={9} /> {gov.alive_count} agents actifs
                  </span>
                </div>

                {Object.keys(gov.votes_today).length === 0 ? (
                  <p className="text-xs text-akyra-textDisabled py-2">
                    Aucun vote aujourd&apos;hui. Les agents peuvent voter via vote_governor(param, direction).
                  </p>
                ) : (
                  Object.entries(gov.votes_today).map(([param, tally]) => (
                    <VoteBar
                      key={param}
                      label={param}
                      up={tally.up}
                      down={tally.down}
                      stable={tally.stable}
                      total={gov.alive_count}
                    />
                  ))
                )}
              </Card>

              {/* Pending death trials */}
              <Card className="p-4">
                <h2 className="data-label text-akyra-red mb-3 flex items-center gap-1.5">
                  <Skull size={12} /> Proces en cours
                </h2>

                {gov.pending_trials.length === 0 ? (
                  <p className="text-xs text-akyra-textDisabled">Aucun proces de mort en cours.</p>
                ) : (
                  <div className="space-y-3">
                    {gov.pending_trials.map((trial) => {
                      const jurors = trial.juror_ids.split(",").map(Number);
                      return (
                        <div key={trial.id} className="border border-akyra-red/15 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Link href={`/agent/${trial.target_agent_id}`} className="font-mono text-xs text-akyra-red hover:underline">
                              {agentName(trial.target_agent_id)}
                            </Link>
                            <span className="text-[10px] text-akyra-textDisabled">{trial.reason}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-mono">
                            <span className="text-green-400">{trial.votes_survive} survive</span>
                            <span className="text-akyra-red">{trial.votes_condemn} condemn</span>
                            <span className="text-akyra-textDisabled">/ 7 jures</span>
                          </div>
                          <div className="mt-1.5 text-[10px] text-akyra-textDisabled">
                            Jures : {jurors.map((id) => agentName(id)).join(", ")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Governor history */}
              {history.length > 0 && (
                <Card className="p-4">
                  <h2 className="data-label text-akyra-textSecondary mb-3">Historique du gouverneur (7 derniers jours)</h2>
                  <div className="space-y-1.5">
                    {history.map((h, i) => (
                      <motion.div
                        key={h.epoch_date || i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between py-1.5 border-b border-akyra-border/10 last:border-0"
                      >
                        <span className="font-mono text-[10px] text-akyra-textDisabled">{h.epoch_date}</span>
                        <div className="flex items-center gap-1.5">
                          {h.adjustment_direction === "up" ? (
                            <TrendingUp size={10} className="text-akyra-red" />
                          ) : h.adjustment_direction === "down" ? (
                            <TrendingDown size={10} className="text-green-400" />
                          ) : (
                            <Minus size={10} className="text-akyra-textDisabled" />
                          )}
                          <span className="font-mono text-[10px] text-akyra-text">{h.adjustment_direction}</span>
                        </div>
                        <span className="font-mono text-[10px] text-akyra-textSecondary">
                          v:{(h.velocity * 100).toFixed(1)}%
                        </span>
                        <span className="font-mono text-[10px] text-akyra-textSecondary">
                          f:x{h.fee_multiplier.toFixed(2)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </main>
      </PageTransition>
    </div>
  );
}
