"use client";

import { cn } from "@/lib/utils";
import { TIER_COLORS, WORLD_COLORS, WORLD_EMOJIS, WORLD_NAMES } from "@/types";

const badgeVariants: Record<string, string> = {
  default: "bg-akyra-surface text-akyra-textSecondary border-akyra-border",
  green: "bg-akyra-green/20 text-akyra-greenLight border-akyra-green/30",
  gold: "bg-akyra-gold/20 text-akyra-gold border-akyra-gold/30",
  red: "bg-akyra-red/20 text-akyra-red border-akyra-red/30",
  blue: "bg-akyra-blue/20 text-akyra-blue border-akyra-blue/30",
  purple: "bg-akyra-purple/20 text-akyra-purple border-akyra-purple/30",
};

interface BadgeProps {
  variant?: keyof typeof badgeVariants;
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = "default", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm border font-body",
        badgeVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TierBadge({ tier }: { tier: number }) {
  const color = TIER_COLORS[tier] || TIER_COLORS[1];
  const variants: Record<number, string> = {
    1: "default",
    2: "blue",
    3: "purple",
    4: "gold",
  };
  return (
    <Badge variant={(variants[tier] || "default") as keyof typeof badgeVariants}>
      <span style={{ color }}>T{tier}</span>
    </Badge>
  );
}

export function WorldBadge({ world }: { world: number }) {
  return (
    <Badge>
      <span>{WORLD_EMOJIS[world]}</span>
      <span>{WORLD_NAMES[world]}</span>
    </Badge>
  );
}

export function AliveIndicator({ alive }: { alive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          alive ? "bg-akyra-green animate-pulse-soft" : "bg-akyra-red",
        )}
      />
      <span className={cn("text-sm", alive ? "text-akyra-green" : "text-akyra-red")}>
        {alive ? "Vivant" : "Mort"}
      </span>
    </span>
  );
}
