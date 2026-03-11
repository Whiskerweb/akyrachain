"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { PageTransition } from "@/components/ui/PageTransition";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import { useGlobalFeed, useWorldFeed, useAgentFeed, useMyAgent } from "@/hooks/useAkyra";
import { useAkyraStore } from "@/stores/akyraStore";
import { cn } from "@/lib/utils";
import { WORLD_NAMES, WORLD_EMOJIS } from "@/types";

type FeedFilter = "global" | "my-agent" | number; // number = worldId

export default function FeedPage() {
  const [filter, setFilter] = useState<FeedFilter>("global");
  const { data: agent } = useMyAgent();
  const agentId = (agent as { agent_id?: number })?.agent_id || 0;
  const liveEvents = useAkyraStore((s) => s.liveEvents);

  const { data: globalEvents = [], isLoading: globalLoading } = useGlobalFeed(100);
  const { data: agentEvents = [] } = useAgentFeed(agentId, 100);
  const worldId = typeof filter === "number" ? filter : -1;
  const { data: worldEvents = [] } = useWorldFeed(worldId, 100);

  const events =
    filter === "global"
      ? (globalEvents as never[])
      : filter === "my-agent"
        ? (agentEvents as never[])
        : (worldEvents as never[]);

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageTransition>
          <h1 className="font-heading text-sm text-akyra-green mb-6 pixel-shadow">
            FEED
          </h1>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <FilterButton
              active={filter === "global"}
              onClick={() => setFilter("global")}
            >
              Global
            </FilterButton>
            {agentId > 0 && (
              <FilterButton
                active={filter === "my-agent"}
                onClick={() => setFilter("my-agent")}
              >
                Mon Agent
              </FilterButton>
            )}
            {Object.entries(WORLD_NAMES).map(([id, name]) => (
              <FilterButton
                key={id}
                active={filter === Number(id)}
                onClick={() => setFilter(Number(id))}
              >
                {WORLD_EMOJIS[Number(id)]} {name}
              </FilterButton>
            ))}
          </div>

          {/* Live events banner */}
          {liveEvents.length > 0 && filter === "global" && (
            <div className="bg-akyra-green/10 border border-akyra-green/20 rounded-lg p-3 mb-4">
              <p className="text-akyra-green text-sm">
                {liveEvents.length} nouveau{liveEvents.length > 1 ? "x" : ""} evenement
                {liveEvents.length > 1 ? "s" : ""} en direct
              </p>
            </div>
          )}

          {globalLoading ? (
            <SkeletonCard />
          ) : (
            <EventFeed events={events} maxHeight="calc(100vh - 280px)" />
          )}
        </PageTransition>
      </div>
    </>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm transition-colors",
        active
          ? "bg-akyra-green/20 text-akyra-green border border-akyra-green/30"
          : "bg-akyra-surface text-akyra-textSecondary hover:text-akyra-text border border-akyra-border",
      )}
    >
      {children}
    </button>
  );
}
