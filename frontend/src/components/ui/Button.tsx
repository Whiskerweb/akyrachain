"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-body text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "bg-akyra-green text-white hover:bg-akyra-greenLight active:scale-95",
        destructive: "bg-akyra-red text-white hover:bg-akyra-redDark active:scale-95",
        outline: "border border-akyra-border text-akyra-text hover:bg-akyra-surface hover:border-akyra-green/50",
        secondary: "bg-akyra-surface text-akyra-text hover:bg-akyra-border active:scale-95",
        ghost: "text-akyra-textSecondary hover:text-akyra-text hover:bg-akyra-surface",
        gold: "bg-akyra-gold text-akyra-bg hover:bg-akyra-goldLight active:scale-95 font-heading text-xs",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-xl",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="animate-pulse-soft">...</span>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "Button";
