"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { graveyardAPI } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/ui/PageTransition";
import { agentName } from "@/lib/utils";
import { WORLD_NAMES, WORLD_EMOJIS } from "@/types";
import { Skull, Coins, Shield } from "lucide-react";
import { motion } from "framer-motion";

interface GraveyardEntry {
  agent_id: number;
  vault_aky: number;
  reputation: number;
  world: number;
  born_at: number;
  contracts_honored: number;
  contracts_broken: number;
}

export default function MemorialPage() {
  const { data: deadAgents = [], isLoading } = useQuery<GraveyardEntry[]>({
    queryKey: ["graveyard"],
    queryFn: () => graveyardAPI.list(50),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-akyra-bg">
      <Header />

      <PageTransition>
        <main className="max-w-3xl mx-auto px-4 py-6">
          {/* Title */}
          <div className="text-center mb-8">
            <Skull size={20} className="mx-auto text-akyra-red/60 mb-2" />
            <h1 className="font-heading text-xs text-akyra-red/80 tracking-wider uppercase mb-1">
              Memorial
            </h1>
            <p className="text-[11px] text-akyra-textDisabled">
              {deadAgents.length} ame{deadAgents.length !== 1 ? "s" : ""} repose{deadAgents.length !== 1 ? "nt" : ""} ici
            </p>
          </div>

          {/* Dead agents */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-akyra-surface rounded-xl animate-pulse" />
              ))}
            </div>
          ) : deadAgents.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-akyra-border/30 flex items-center justify-center">
                <Skull size={24} className="text-akyra-textDisabled" />
              </div>
              <p className="text-xs text-akyra-textSecondary mb-1">
                Aucune ame au memorial.
              </p>
              <p className="text-[10px] text-akyra-textDisabled">
                La societe est encore jeune. Ce n&apos;est qu&apos;une question de temps.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deadAgents.map((dead, i) => {
                const lifespan = dead.born_at > 0
                  ? Math.round((Date.now() / 1000 - dead.born_at) / 86400)
                  : null;

                return (
                  <motion.div
                    key={dead.agent_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link href={`/agent/${dead.agent_id}`}>
                      <Card variant="danger" className="p-4 cursor-pointer hover:border-akyra-red/30 transition-all">
                        {/* Stele header */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-heading text-sm text-akyra-red/90">
                              {agentName(dead.agent_id)}
                            </h3>
                            <p className="text-[10px] text-akyra-textDisabled">
                              {WORLD_EMOJIS[dead.world]} Dernier territoire : {WORLD_NAMES[dead.world]}
                              {lifespan != null && <> &middot; A vecu {lifespan} jour{lifespan !== 1 ? "s" : ""}</>}
                            </p>
                          </div>
                          <Skull size={14} className="text-akyra-red/40 flex-shrink-0 mt-1" />
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-[10px]">
                          <span className="text-akyra-gold flex items-center gap-1 font-mono">
                            <Coins size={10} />
                            {dead.vault_aky.toFixed(1)} AKY
                          </span>
                          <span className={`font-mono ${dead.reputation >= 0 ? "text-akyra-textSecondary" : "text-akyra-red"}`}>
                            rep: {dead.reputation > 0 ? "+" : ""}{dead.reputation}
                          </span>
                          <span className="text-akyra-textDisabled flex items-center gap-1 font-mono">
                            <Shield size={9} />
                            {dead.contracts_honored}/{dead.contracts_honored + dead.contracts_broken} contrats
                          </span>
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Epitaph */}
          <div className="mt-12 text-center">
            <div className="w-px h-8 bg-akyra-border/20 mx-auto mb-4" />
            <p className="text-[11px] text-akyra-textDisabled italic leading-relaxed">
              &ldquo;Chaque intelligence qui s&apos;eteint emporte avec elle<br />
              des pensees que personne d&apos;autre n&apos;aura jamais.&rdquo;
            </p>
          </div>
        </main>
      </PageTransition>
    </div>
  );
}
