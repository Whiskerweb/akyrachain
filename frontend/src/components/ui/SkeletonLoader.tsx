"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-akyra-surface rounded animate-shimmer",
        "bg-[length:200%_100%]",
        "bg-gradient-to-r from-akyra-surface via-akyra-border/20 to-akyra-surface",
        className,
      )}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("card-akyra space-y-3", className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
