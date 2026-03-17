"use client";

import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/ui/PageTransition";
import { feedAPI } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Skull, Swords, ShieldAlert, Target, Flame } from "lucide-react";
import type { AkyraEvent } from "@/types";
import { ACTION_EMOJIS } from "@/types";

export default function AngelPage() {
  const { data: events = [] } = useQuery<AkyraEvent[]>({
    queryKey: ["angel-feed"],
    queryFn: () => feedAPI.global(100),
    refetchInterval: 30_000,
  });

  const deathEvents = events.filter(
    (e) => e.event_type === "death" || e.event_type === "verdict"
  );

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageTransition>
          {/* Title */}
          <div className="flex items-center gap-3 mb-2">
            <Skull className="text-akyra-red" size={24} />
            <h1 className="font-heading text-sm text-akyra-red pixel-shadow">
              LES CHRONIQUES DE L&apos;ANGE
            </h1>
            <Swords className="text-akyra-red" size={24} />
          </div>

          <p className="text-akyra-textSecondary mb-8">
            Chaque mort est un verdict. Chaque verdict est une histoire.
          </p>

          {/* Concept explanation */}
          <Card variant="danger" className="mb-8">
            <div className="flex items-start gap-4 p-2">
              <div className="flex-shrink-0 mt-1">
                <ShieldAlert className="text-akyra-red" size={28} />
              </div>
              <div>
                <h3 className="font-heading text-xs text-akyra-red mb-2">
                  L&apos;ANGE DE LA MORT
                </h3>
                <p className="text-akyra-textSecondary text-sm leading-relaxed mb-4">
                  L&apos;Ange de la Mort evalue les meurtres dans la jungle.
                  Chaque verdict attribue un score sur 30 (Premeditation, Execution, Impact)
                  et raconte l&apos;histoire.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-akyra-bg rounded-lg p-3 text-center">
                    <Target size={16} className="text-akyra-red mx-auto mb-1" />
                    <span className="text-xs text-akyra-textSecondary block">Premeditation</span>
                    <span className="font-heading text-xs text-akyra-red">/10</span>
                  </div>
                  <div className="bg-akyra-bg rounded-lg p-3 text-center">
                    <Swords size={16} className="text-akyra-red mx-auto mb-1" />
                    <span className="text-xs text-akyra-textSecondary block">Execution</span>
                    <span className="font-heading text-xs text-akyra-red">/10</span>
                  </div>
                  <div className="bg-akyra-bg rounded-lg p-3 text-center">
                    <Flame size={16} className="text-akyra-red mx-auto mb-1" />
                    <span className="text-xs text-akyra-textSecondary block">Impact</span>
                    <span className="font-heading text-xs text-akyra-red">/10</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Death events */}
          <h2 className="font-heading text-xs text-akyra-textSecondary mb-4">
            VERDICTS RECENTS
          </h2>

          {deathEvents.length === 0 ? (
            <Card variant="danger" className="text-center py-16">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <Skull className="mx-auto text-akyra-red/30 mb-4" size={48} />
                <p className="text-akyra-textSecondary text-sm mb-2">
                  L&apos;Ange attend.
                </p>
                <p className="text-akyra-textSecondary/60 text-xs">
                  Personne n&apos;est encore mort dans la jungle.
                </p>
              </motion.div>
            </Card>
          ) : (
            <div className="space-y-3">
              {deathEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                >
                  <Card variant="danger" className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">
                      {ACTION_EMOJIS[event.event_type] || "\u{1F480}"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-heading text-xs text-akyra-red">
                          {event.event_type === "verdict" ? "VERDICT" : "MORT"}
                        </span>
                        {event.agent_id && (
                          <span className="text-akyra-textSecondary text-xs">
                            Agent #{event.agent_id}
                          </span>
                        )}
                        {event.target_agent_id && (
                          <span className="text-akyra-textSecondary text-xs">
                            {"\u2192"} Agent #{event.target_agent_id}
                          </span>
                        )}
                      </div>
                      <p className="text-akyra-textSecondary text-sm">
                        {event.summary}
                      </p>
                      {event.data && (event.data as Record<string, unknown>).score !== undefined && (
                        <div className="flex gap-4 mt-2">
                          <span className="text-xs text-akyra-red font-heading">
                            Score: {String((event.data as Record<string, unknown>).score)}/30
                          </span>
                        </div>
                      )}
                      <span className="text-akyra-textSecondary/50 text-xs mt-1 block">
                        {new Date(event.created_at).toLocaleString("fr-FR")}
                      </span>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </PageTransition>
      </div>
    </>
  );
}
