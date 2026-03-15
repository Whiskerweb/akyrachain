"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const glowVariants: Record<string, string> = {
  default: "",
  glow: "hover:border-akyra-green/40 hover:shadow-[0_0_16px_rgba(26,48,128,0.1)]",
  danger: "border-akyra-red/30 hover:border-akyra-red/50 hover:shadow-[0_0_16px_rgba(192,57,43,0.1)]",
  gold: "border-akyra-gold/30 hover:border-akyra-gold/50 hover:shadow-[0_0_16px_rgba(200,169,110,0.12)]",
  purple: "border-akyra-purple/30 hover:border-akyra-purple/50 hover:shadow-[0_0_16px_rgba(108,92,231,0.12)]",
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof glowVariants;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-akyra-surface border border-akyra-border rounded-xl p-4 transition-all duration-200",
          "shadow-[0_4px_12px_rgba(0,0,0,0.06)]",
          glowVariants[variant],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Card.displayName = "Card";
