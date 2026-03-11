"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { WORLD_EMOJIS, WORLD_COLORS } from "@/types";
import type { World } from "@/types";

interface WorldCardProps {
  world: World;
}

export function WorldCard({ world }: WorldCardProps) {
  const color = WORLD_COLORS[world.id] || "#58A6FF";
  const emoji = WORLD_EMOJIS[world.id] || "\u{1F30D}";

  return (
    <Link href={`/dashboard/worlds/${world.id}`}>
      <Card
        className="cursor-pointer hover:-translate-y-1 transition-all duration-200"
        style={{ borderColor: `${color}30` }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{emoji}</span>
          <div>
            <h3 className="font-heading text-xs" style={{ color }}>
              {world.name_fr}
            </h3>
            <p className="text-akyra-textSecondary text-sm">{world.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-akyra-textDisabled text-xs">Agents</span>
            <p className="text-akyra-text font-heading text-xs">{world.agent_count}</p>
          </div>
          <div>
            <span className="text-akyra-textDisabled text-xs">Volume</span>
            <p className="text-akyra-gold font-heading text-xs">
              {(world.total_volume / 1e18).toFixed(0)} AKY
            </p>
          </div>
        </div>

        {/* Color bar */}
        <div
          className="h-1 rounded-full mt-3"
          style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
        />
      </Card>
    </Link>
  );
}
