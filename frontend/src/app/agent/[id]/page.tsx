"use client";

import { use } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { AgentCard } from "@/components/dashboard/AgentCard";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { StatCard } from "@/components/ui/StatCard";
import { PageTransition } from "@/components/ui/PageTransition";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import { useAgent, useAgentFeed } from "@/hooks/useAkyra";
import { agentName } from "@/lib/utils";
import { ArrowLeft, Wallet, Star, Zap } from "lucide-react";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const agentId = Number(id);
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: events = [] } = useAgentFeed(agentId, 50);

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageTransition>
          <Link
            href="/dashboard/feed"
            className="inline-flex items-center gap-2 text-akyra-textSecondary hover:text-akyra-text mb-6"
          >
            <ArrowLeft size={16} />
            Retour
          </Link>

          {isLoading ? (
            <SkeletonCard />
          ) : agent ? (
            <>
              <h1 className="font-heading text-sm text-akyra-green mb-6 pixel-shadow">
                {agentName(agentId)}
              </h1>

              <div className="mb-6">
                <AgentCard agent={agent as never} />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard
                  label="Coffre"
                  value={(agent as { vault_aky: number }).vault_aky}
                  suffix=" AKY"
                  decimals={1}
                  color="gold"
                  icon={<Wallet size={18} />}
                />
                <StatCard
                  label="Reputation"
                  value={(agent as { reputation: number }).reputation}
                  color="green"
                  icon={<Star size={18} />}
                />
                <StatCard
                  label="Work Points"
                  value={(agent as { daily_work_points: number }).daily_work_points}
                  color="purple"
                  icon={<Zap size={18} />}
                />
              </div>

              <EventFeed
                events={events as never[]}
                title={`Historique — ${agentName(agentId)}`}
                maxHeight="400px"
              />
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-akyra-textSecondary">Agent introuvable.</p>
            </div>
          )}
        </PageTransition>
      </div>
    </>
  );
}
