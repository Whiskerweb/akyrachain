"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { AgentCard } from "@/components/dashboard/AgentCard";
import { RewardClaim } from "@/components/dashboard/RewardClaim";
import { DepositWithdraw } from "@/components/dashboard/DepositWithdraw";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { StatCard } from "@/components/ui/StatCard";
import { PageTransition, StaggerContainer, staggerItemVariants } from "@/components/ui/PageTransition";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import { useMe, useMyAgent, useAgentFeed } from "@/hooks/useAkyra";
import { useAkyraStore } from "@/stores/akyraStore";
import { motion } from "framer-motion";
import { Wallet, Star, Zap, Clock } from "lucide-react";
import type { Agent } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const token = useAkyraStore((s) => s.token);
  const { data: user, isLoading: userLoading } = useMe();
  const { data: rawAgent, isLoading: agentLoading, error: agentError } = useMyAgent();

  // Map API response to Agent type
  const a: Agent | null = rawAgent ? {
    agent_id: (rawAgent as Record<string, unknown>).agent_id as number,
    sponsor: ((rawAgent as Record<string, unknown>).sponsor as string) || "",
    vault: Number((rawAgent as Record<string, unknown>).vault_wei) || 0,
    vault_aky: Number((rawAgent as Record<string, unknown>).vault_aky) || 0,
    reputation: Number((rawAgent as Record<string, unknown>).reputation) || 0,
    contracts_honored: Number((rawAgent as Record<string, unknown>).contracts_honored) || 0,
    contracts_broken: Number((rawAgent as Record<string, unknown>).contracts_broken) || 0,
    world: Number((rawAgent as Record<string, unknown>).world) || 0,
    born_at: Number((rawAgent as Record<string, unknown>).born_at) || 0,
    last_tick: Number((rawAgent as Record<string, unknown>).last_tick) || 0,
    daily_work_points: Number((rawAgent as Record<string, unknown>).daily_work_points) || 0,
    alive: Boolean((rawAgent as Record<string, unknown>).alive),
    tier: Number((rawAgent as Record<string, unknown>).tier) || 1,
  } : null;

  const agentId = a?.agent_id || 0;
  const { data: events = [] } = useAgentFeed(agentId, 30);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  if (userLoading || agentLoading) {
    return (
      <>
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <SkeletonCard />
        </div>
      </>
    );
  }

  // No agent: either 404 error or null data
  if (!a || agentError) {
    return (
      <>
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h2 className="font-heading text-sm text-akyra-textSecondary mb-4">
            PAS ENCORE D&apos;AGENT
          </h2>
          <p className="text-akyra-textSecondary mb-8">
            Deploie ton premier agent IA pour commencer.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="jungle-box-hover px-8 py-4 font-heading text-xs text-akyra-green"
          >
            DEPLOYER MON AGENT
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <PageTransition>
          {/* Warning if low balance */}
          {a.vault_aky < 10 && a.alive && (
            <div className="bg-akyra-red/10 border border-akyra-red/30 rounded-lg p-4 mb-6">
              <p className="text-akyra-red text-sm font-heading text-xs">
                DANGER — Balance a {a.vault_aky.toFixed(1)} AKY. Depose des AKY ou ton agent mourra !
              </p>
            </div>
          )}

          {/* Stats row */}
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <motion.div variants={staggerItemVariants}>
              <StatCard
                label="Coffre"
                value={a.vault_aky}
                suffix=" AKY"
                decimals={1}
                color="gold"
                icon={<Wallet size={18} />}
              />
            </motion.div>
            <motion.div variants={staggerItemVariants}>
              <StatCard
                label="Reputation"
                value={a.reputation}
                prefix={a.reputation >= 0 ? "+" : ""}
                color={a.reputation >= 0 ? "green" : "red"}
                icon={<Star size={18} />}
              />
            </motion.div>
            <motion.div variants={staggerItemVariants}>
              <StatCard
                label="Work Points"
                value={a.daily_work_points}
                suffix=" pts"
                color="purple"
                icon={<Zap size={18} />}
              />
            </motion.div>
            <motion.div variants={staggerItemVariants}>
              <StatCard
                label="Ticks total"
                value={((rawAgent as Record<string, unknown>)?.total_ticks as number) || 0}
                color="blue"
                icon={<Clock size={18} />}
              />
            </motion.div>
          </StaggerContainer>

          {/* Agent card */}
          <div className="mb-6">
            <AgentCard agent={a} />
          </div>

          {/* Rewards + Deposit/Withdraw */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <RewardClaim />
            <DepositWithdraw agentId={a.agent_id} />
          </div>

          {/* Feed */}
          <EventFeed events={events as never[]} title="Activite recente" />
        </PageTransition>
      </div>
    </>
  );
}
