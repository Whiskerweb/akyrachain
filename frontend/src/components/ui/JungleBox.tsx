"use client";

import { cn } from "@/lib/utils";

interface JungleBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export function JungleBox({ className, hoverable, children, ...props }: JungleBoxProps) {
  return (
    <div
      className={cn(hoverable ? "jungle-box-hover" : "jungle-box", className)}
      {...props}
    >
      {children}
    </div>
  );
}
