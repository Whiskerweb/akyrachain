"use client";

import { cn } from "@/lib/utils";
import CountUp from "react-countup";

const colorMap: Record<string, { text: string; bg: string; glow: string }> = {
  green: { text: "text-akyra-greenLight", bg: "bg-akyra-green/10", glow: "shadow-[0_0_8px_rgba(59,91,219,0.15)]" },
  gold: { text: "text-akyra-gold", bg: "bg-akyra-gold/10", glow: "shadow-[0_0_8px_rgba(200,169,110,0.15)]" },
  blue: { text: "text-akyra-blue", bg: "bg-akyra-blue/10", glow: "shadow-[0_0_8px_rgba(42,80,200,0.15)]" },
  purple: { text: "text-akyra-purple", bg: "bg-akyra-purple/10", glow: "shadow-[0_0_8px_rgba(108,92,231,0.15)]" },
  red: { text: "text-akyra-red", bg: "bg-akyra-red/10", glow: "shadow-[0_0_8px_rgba(192,57,43,0.15)]" },
};

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  color?: keyof typeof colorMap;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  color = "green",
  icon,
  className,
}: StatCardProps) {
  const c = colorMap[color] || colorMap.green;

  return (
    <div
      className={cn(
        "bg-akyra-surface border border-akyra-border rounded-xl p-4",
        c.glow,
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-akyra-textSecondary text-sm">{label}</span>
        {icon && <span className={cn("text-lg", c.text)}>{icon}</span>}
      </div>
      <div className={cn("text-2xl font-heading", c.text)}>
        {prefix}
        <CountUp end={value} decimals={decimals} duration={1.5} preserveValue />
        {suffix && <span className="text-lg ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
