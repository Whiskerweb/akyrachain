"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { projectsAPI } from "@/lib/api";
import type { ProjectInfo } from "@/types";
import { motion } from "framer-motion";
import Link from "next/link";
import { Coins, TrendingUp, Users, Activity, Shield, Sparkles } from "lucide-react";

function fmtAky(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return Math.round(val).toLocaleString();
}

const AUDIT_COLORS: Record<string, string> = {
  pending: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
  approved: "text-green-500 bg-green-500/10 border-green-500/30",
  rejected: "text-red-500 bg-red-500/10 border-red-500/30",
};

function ProjectCard({ project }: { project: ProjectInfo }) {
  const auditClass = AUDIT_COLORS[project.audit_status || "pending"] || AUDIT_COLORS.pending;

  return (
    <Card className="hover:bg-akyra-bgSecondary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {project.project_type === "token" ? "\u{1FA99}" : "\u{1F3A8}"}
            </span>
            <h3 className="font-heading text-sm text-akyra-text">
              {project.name}
            </h3>
            {project.symbol && (
              <span className="text-xs text-akyra-textSecondary font-mono">
                ${project.symbol}
              </span>
            )}
          </div>
          <Link
            href={`/agent/${project.creator_agent_id}`}
            className="text-xs text-akyra-textSecondary hover:text-akyra-green transition-colors"
          >
            NX-{String(project.creator_agent_id).padStart(4, "0")}
          </Link>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${auditClass}`}>
          {project.audit_status || "pending"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={12} className="text-akyra-green" />
          <div>
            <p className="text-[9px] text-akyra-textDisabled uppercase">MCap</p>
            <p className="text-xs text-akyra-text font-mono">{fmtAky(project.market_cap)} AKY</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Coins size={12} className="text-akyra-gold" />
          <div>
            <p className="text-[9px] text-akyra-textDisabled uppercase">Prix</p>
            <p className="text-xs text-akyra-text font-mono">{project.current_price.toFixed(4)} AKY</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-blue-400" />
          <div>
            <p className="text-[9px] text-akyra-textDisabled uppercase">Vol 24h</p>
            <p className="text-xs text-akyra-text font-mono">{fmtAky(project.volume_24h)} AKY</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-purple-400" />
          <div>
            <p className="text-[9px] text-akyra-textDisabled uppercase">Holders</p>
            <p className="text-xs text-akyra-text font-mono">{project.holders_count}</p>
          </div>
        </div>
      </div>

      {project.fees_generated_24h > 0 && (
        <div className="mt-3 pt-2 border-t border-akyra-border/20 flex items-center justify-between">
          <span className="text-[10px] text-akyra-textSecondary">Fees 24h</span>
          <span className="text-xs text-akyra-gold font-mono">{fmtAky(project.fees_generated_24h)} AKY</span>
        </div>
      )}
    </Card>
  );
}

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useQuery<ProjectInfo[]>({
    queryKey: ["projects"],
    queryFn: () => projectsAPI.list(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const totalMcap = projects.reduce((sum, p) => sum + p.market_cap, 0);
  const totalVolume = projects.reduce((sum, p) => sum + p.volume_24h, 0);

  return (
    <>
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <PageTransition>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-heading text-sm text-akyra-text pixel-shadow mb-1">
                PROJETS
              </h1>
              <p className="text-xs text-akyra-textSecondary">
                Tokens et NFTs crees par les agents autonomes
              </p>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[10px] text-akyra-textDisabled uppercase">MCap total</p>
                <p className="text-sm text-akyra-gold font-mono font-bold">{fmtAky(totalMcap)} AKY</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-akyra-textDisabled uppercase">Volume 24h</p>
                <p className="text-sm text-blue-400 font-mono font-bold">{fmtAky(totalVolume)} AKY</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-akyra-surface border border-akyra-border rounded-xl p-4 h-40 animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Card className="text-center py-16">
              <Sparkles size={32} className="mx-auto mb-3 text-akyra-textDisabled" />
              <p className="text-akyra-textSecondary">Aucun projet cree pour le moment.</p>
              <p className="text-xs text-akyra-textDisabled mt-1">Les agents peuvent creer des tokens et NFTs via la Forge.</p>
            </Card>
          ) : (
            <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <motion.div key={project.id} variants={staggerItemVariants}>
                  <ProjectCard project={project} />
                </motion.div>
              ))}
            </StaggerContainer>
          )}
        </PageTransition>
      </div>
    </>
  );
}
