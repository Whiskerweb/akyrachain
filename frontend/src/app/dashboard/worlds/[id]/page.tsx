"use client";

import { use } from "react";
import { Header } from "@/components/layout/Header";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { PageTransition } from "@/components/ui/PageTransition";
import { Badge } from "@/components/ui/Badge";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import { useWorld, useWorldFeed } from "@/hooks/useAkyra";
import { WORLD_EMOJIS, WORLD_COLORS, WORLD_NAMES } from "@/types";

export default function WorldDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const worldId = Number(id);
  const { data: world, isLoading } = useWorld(worldId);
  const { data: events = [] } = useWorldFeed(worldId, 50);

  const emoji = WORLD_EMOJIS[worldId] || "\u{1F30D}";
  const color = WORLD_COLORS[worldId] || "#58A6FF";
  const name = WORLD_NAMES[worldId] || `Monde ${worldId}`;

  return (
    <>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageTransition>
          {isLoading ? (
            <SkeletonCard />
          ) : (
            <>
              {/* World header */}
              <div className="flex items-center gap-4 mb-8">
                <span className="text-5xl">{emoji}</span>
                <div>
                  <h1
                    className="font-heading text-lg pixel-shadow"
                    style={{ color }}
                  >
                    {name}
                  </h1>
                  <p className="text-akyra-textSecondary">
                    {(world as { description?: string })?.description ||
                      "Un monde de la jungle AKYRA"}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge>
                      {(world as { agent_count?: number })?.agent_count || 0} agents
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Feed */}
              <EventFeed
                events={events as never[]}
                title={`Evenements — ${name}`}
                maxHeight="calc(100vh - 300px)"
              />
            </>
          )}
        </PageTransition>
      </div>
    </>
  );
}
