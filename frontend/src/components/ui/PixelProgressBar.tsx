"use client";

import { cn } from "@/lib/utils";

const barColors: Record<string, string> = {
  green: "bg-akyra-green",
  gold: "bg-akyra-gold",
  red: "bg-akyra-red",
  blue: "bg-akyra-blue",
  purple: "bg-akyra-purple",
};

interface PixelProgressBarProps {
  value: number; // 0-100
  max?: number;
  color?: keyof typeof barColors;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function PixelProgressBar({
  value,
  max = 100,
  color = "green",
  label,
  showValue = true,
  className,
}: PixelProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-akyra-textSecondary text-sm">{label}</span>}
          {showValue && (
            <span className="text-akyra-text text-sm">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div className="h-3 bg-akyra-bg rounded-sm border border-akyra-border overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500 rounded-sm",
            barColors[color] || barColors.green,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
