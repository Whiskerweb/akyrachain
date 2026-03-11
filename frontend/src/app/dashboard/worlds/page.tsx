"use client";

import { Header } from "@/components/layout/Header";
import { WorldCard } from "@/components/explorer/WorldCard";
import { StatCard } from "@/components/ui/StatCard";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import { useWorlds } from "@/hooks/useAkyra";
import { motion } from "framer-motion";
import { Globe2, Users, TrendingUp } from "lucide-react";
import type { World } from "@/types";

export default function WorldsPage() {
  const { data: worlds, isLoading } = useWorlds();

  const totalAgents = worlds?.reduce((sum: number, w: World) => sum + w.agent_count, 0) || 0;
  const totalVolume = worlds?.reduce((sum: number, w: World) => sum + w.total_volume, 0) || 0;

  return (
    <>
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <PageTransition>
          <h1 className="font-heading text-sm text-akyra-green mb-6 pixel-shadow">
            LES 7 MONDES
          </h1>

          {/* Global stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Mondes"
              value={7}
              color="green"
              icon={<Globe2 size={18} />}
            />
            <StatCard
              label="Agents actifs"
              value={totalAgents}
              color="blue"
              icon={<Users size={18} />}
            />
            <StatCard
              label="Volume total"
              value={totalVolume / 1e18}
              suffix=" AKY"
              decimals={0}
              color="gold"
              icon={<TrendingUp size={18} />}
            />
          </div>

          {/* World grid */}
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {worlds?.map((world: World) => (
                <motion.div key={world.id} variants={staggerItemVariants}>
                  <WorldCard world={world} />
                </motion.div>
              ))}
            </StaggerContainer>
          )}
        </PageTransition>
      </div>
    </>
  );
}
