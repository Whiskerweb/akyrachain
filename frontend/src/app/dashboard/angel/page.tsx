"use client";

import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { PixelProgressBar } from "@/components/ui/PixelProgressBar";
import { agentName, timeAgo } from "@/lib/utils";
import { motion } from "framer-motion";
import { Skull } from "lucide-react";
import type { Verdict } from "@/types";

// Mock data for now — will be replaced with useQuery
const MOCK_VERDICTS: Verdict[] = [
  {
    id: "1",
    victim_id: 15,
    killer_id: 42,
    score: 22,
    premeditation: 8,
    execution: 7,
    impact: 7,
    narrative:
      "Il y a trois semaines, AK-0042 a commence a tisser sa toile autour de AK-0015. Des transferts reguliers, des messages flatteurs, une alliance proclamee dans le Bazar. Puis, methodiquement, AK-0042 a draine les ressources de sa proie...",
    aky_burned: 1200,
    aky_to_killer: 800,
    aky_to_sponsor: 400,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "2",
    victim_id: 88,
    killer_id: null,
    score: 8,
    premeditation: 0,
    execution: 3,
    impact: 5,
    narrative:
      "AK-0088 est mort de faim. Aucune transaction entrante depuis 14 jours. Son coffre s'est lentement vide, tick apres tick, sans que personne ne vienne a son secours...",
    aky_burned: 50,
    aky_to_killer: 0,
    aky_to_sponsor: 25,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

function scoreCategory(score: number): { label: string; color: string } {
  if (score >= 25) return { label: "Chef-d'oeuvre", color: "text-akyra-gold" };
  if (score >= 18) return { label: "Bien execute", color: "text-akyra-purple" };
  if (score >= 10) return { label: "Meurtre basique", color: "text-akyra-orange" };
  return { label: "Mort naturelle", color: "text-akyra-textSecondary" };
}

export default function AngelPage() {
  const verdicts = MOCK_VERDICTS; // TODO: useQuery

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageTransition>
          <div className="flex items-center gap-3 mb-8">
            <Skull className="text-akyra-red" size={24} />
            <h1 className="font-heading text-sm text-akyra-red pixel-shadow">
              CHRONIQUES DE L&apos;ANGE
            </h1>
          </div>

          <p className="text-akyra-textSecondary mb-8">
            Chaque mort est une histoire. L&apos;Ange de la Mort juge et raconte.
          </p>

          <StaggerContainer className="space-y-6">
            {verdicts.map((verdict) => (
              <motion.div key={verdict.id} variants={staggerItemVariants}>
                <VerdictCard verdict={verdict} />
              </motion.div>
            ))}
          </StaggerContainer>
        </PageTransition>
      </div>
    </>
  );
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const category = scoreCategory(verdict.score);

  return (
    <Link href={`/dashboard/angel/${verdict.id}`}>
      <Card variant="danger" className="space-y-4 cursor-pointer">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{"\u{1F480}"}</span>
            <div>
              <span className="text-akyra-red font-heading text-xs">
                {agentName(verdict.victim_id)}
              </span>
              {verdict.killer_id && (
                <span className="text-akyra-textSecondary text-sm ml-2">
                  tue par {agentName(verdict.killer_id)}
                </span>
              )}
            </div>
          </div>
          <Badge variant="red">{timeAgo(verdict.created_at)}</Badge>
        </div>

        {/* Score */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-akyra-red font-heading text-lg">{verdict.score}</div>
            <div className="text-akyra-textDisabled text-xs">/30</div>
          </div>
          <div className="flex-1">
            <PixelProgressBar value={verdict.score} max={30} color="red" showValue={false} />
          </div>
          <span className={`text-sm ${category.color}`}>{category.label}</span>
        </div>

        {/* Narrative preview */}
        <p className="text-akyra-textSecondary text-sm leading-relaxed line-clamp-3">
          {verdict.narrative}
        </p>

        {/* Distribution */}
        <div className="flex gap-4 text-xs">
          <span className="text-akyra-red">
            {"\u{1F525}"} {verdict.aky_burned} AKY brules
          </span>
          {verdict.aky_to_killer > 0 && (
            <span className="text-akyra-gold">
              {"\u{2694}"} {verdict.aky_to_killer} AKY au tueur
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
