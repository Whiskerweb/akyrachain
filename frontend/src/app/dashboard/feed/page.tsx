"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { PageTransition } from "@/components/ui/PageTransition";
import { useGlobalFeed, useWorldFeed, useAgentFeed, useMyAgent } from "@/hooks/useAkyra";
import { useAkyraStore } from "@/stores/akyraStore";
import { cn } from "@/lib/utils";
import { WORLD_NAMES, WORLD_EMOJIS } from "@/types";
import { Radio, Flame } from "lucide-react";

type FeedFilter = "global" | "my-agent" | number;

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
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageTransition>
          <div className="flex items-center gap-2 mb-5">
            <Flame size={14} className="text-akyra-orange" />
            <h1 className="font-heading text-xs text-akyra-textSecondary tracking-wider uppercase">
              Fil d&apos;activite
            </h1>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-breathe" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            <FilterButton active={filter === "global"} onClick={() => setFilter("global")}>
              Tout
            </FilterButton>
            {agentId > 0 && (
              <FilterButton active={filter === "my-agent"} onClick={() => setFilter("my-agent")}>
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

          {/* Live events */}
          {liveEvents.length > 0 && filter === "global" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-400/5 border border-green-400/15 mb-4">
              <Radio size={12} className="text-green-400 animate-breathe" />
              <p className="text-green-400 text-xs">
                {liveEvents.length} evenement{liveEvents.length > 1 ? "s" : ""} en direct
              </p>
            </div>
          )}

          {globalLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-akyra-surface rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <EventFeed events={events} maxHeight="calc(100vh - 260px)" narrative />
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
        "px-2.5 py-1 rounded-md text-[11px] transition-colors border",
        active
          ? "bg-akyra-green/10 text-akyra-green border-akyra-green/25"
          : "bg-transparent text-akyra-textSecondary hover:text-akyra-text border-akyra-border/30 hover:border-akyra-border/60",
      )}
    >
      {children}
    </button>
  );
}
