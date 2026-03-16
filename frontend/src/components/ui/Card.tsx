"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const glowVariants: Record<string, string> = {
  default: "",
  glow: "hover:border-akyra-green/40 hover:shadow-[0_0_16px_rgba(59,91,219,0.12)]",
  danger: "border-akyra-red/20 hover:border-akyra-red/40 hover:shadow-[0_0_16px_rgba(224,49,49,0.12)]",
  gold: "border-akyra-gold/20 hover:border-akyra-gold/40 hover:shadow-[0_0_16px_rgba(200,169,110,0.12)]",
  purple: "border-akyra-purple/20 hover:border-akyra-purple/40 hover:shadow-[0_0_16px_rgba(121,80,242,0.12)]",
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
          "shadow-[0_2px_8px_rgba(0,0,0,0.3)]",
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
