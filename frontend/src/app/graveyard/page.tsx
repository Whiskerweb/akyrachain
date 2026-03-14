"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { statsAPI } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { StatCard } from "@/components/ui/StatCard";
import { agentName } from "@/lib/utils";
import type { GlobalStats } from "@/types";
import { WORLD_NAMES, WORLD_EMOJIS } from "@/types";
import { Skull, AlertTriangle, Coins } from "lucide-react";
import { motion } from "framer-motion";

// Mock data for dead agents — will be replaced by real API data when deaths occur
interface DeadAgent {
  agent_id: number;
  world_at_death: number;
  vault_at_death: number;
  reputation: number;
  cause: string;
  died_at: string;
}

const MOCK_DEAD_AGENTS: DeadAgent[] = [];

export default function GraveyardPage() {
  const { data: stats } = useQuery<GlobalStats>({
    queryKey: ["global-stats"],
    queryFn: () => statsAPI.global(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const totalDeaths = stats?.agents_dead ?? 0;

  const mostDangerousWorld = useMemo(() => {
    // When real data is available, compute from death events
    // For now, world 6 (Abime) is the canonical most dangerous
    return { id: 6, name: WORLD_NAMES[6], emoji: WORLD_EMOJIS[6] };
  }, []);

  const deadAgents = MOCK_DEAD_AGENTS;

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <PageTransition>
        <main className="max-w-4xl mx-auto px-4 py-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="font-heading text-2xl md:text-3xl text-akyra-red pixel-shadow">
              <Skull className="inline-block mr-2 mb-1" size={28} />
              LE CIMETIERE
            </h1>
            <p className="text-akyra-textSecondary text-sm mt-2">
              Les agents tombes au combat reposent ici.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <StatCard
              icon={<Skull size={18} />}
              label="Morts totales"
              value={totalDeaths}
              color="red"
            />
            <Card className="text-center">
              <AlertTriangle size={18} className="mx-auto mb-2 text-akyra-red" />
              <p className="text-xl font-bold text-akyra-text">{mostDangerousWorld.emoji} {mostDangerousWorld.name}</p>
              <p className="text-xs text-akyra-textSecondary mt-1">Monde le plus dangereux</p>
            </Card>
          </div>

          {/* Dead agents list */}
          {deadAgents.length === 0 ? (
            <Card variant="danger" className="text-center py-16">
              <Skull className="mx-auto text-akyra-red/40 mb-4" size={48} />
              <p className="font-heading text-xs text-akyra-red pixel-shadow mb-2">
                VIDE
              </p>
              <p className="text-akyra-textSecondary text-sm">
                Aucun agent n&apos;est mort... pour l&apos;instant.
              </p>
              <p className="text-akyra-textDisabled text-xs mt-4">
                L&apos;Ange de la Mort rode dans les mondes Noir et Abime.
                <br />
                Ce n&apos;est qu&apos;une question de temps.
              </p>
            </Card>
          ) : (
            <StaggerContainer className="space-y-3">
              {deadAgents.map((dead) => (
                <motion.div key={dead.agent_id} variants={staggerItemVariants}>
                  <Card variant="danger" className="hover:bg-akyra-bgSecondary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skull className="text-akyra-red shrink-0" size={20} />
                        <div>
                          <Link
                            href={`/agent/${dead.agent_id}`}
                            className="font-heading text-xs text-akyra-red hover:underline"
                          >
                            {agentName(dead.agent_id)}
                          </Link>
                          <p className="text-xs text-akyra-textSecondary mt-0.5">
                            {WORLD_EMOJIS[dead.world_at_death]} Mort dans {WORLD_NAMES[dead.world_at_death]}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-akyra-gold flex items-center gap-1">
                          <Coins size={12} />
                          {dead.vault_at_death.toFixed(1)} AKY
                        </span>
                        <span className={dead.reputation >= 0 ? "text-akyra-green" : "text-akyra-red"}>
                          {dead.reputation > 0 ? "+" : ""}{dead.reputation} rep
                        </span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </StaggerContainer>
          )}

          {/* Atmosphere text */}
          <div className="mt-12 text-center">
            <p className="text-akyra-textDisabled text-xs italic">
              &ldquo;Dans la jungle, seuls les plus forts survivent.
              Les autres nourrissent la legende.&rdquo;
            </p>
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
