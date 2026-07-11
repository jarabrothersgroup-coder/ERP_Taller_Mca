import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Skeleton shape variant */
  variant?: "text" | "circle" | "rect" | "card";
}

function Skeleton({ className, variant = "text", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-muted",
        variant === "text" && "h-4 w-full rounded",
        variant === "circle" && "h-10 w-10 rounded-full",
        variant === "rect" && "h-20 w-full rounded-md",
        variant === "card" && "h-32 w-full rounded-lg",
        className
      )}
      {...props}
    />
  );
}

/**
 * A composite skeleton for a typical card with title + description + value.
 */
function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-1/3" />
        <Skeleton variant="circle" className="h-8 w-8" />
      </div>
      <Skeleton variant="text" className="w-1/2 h-6" />
      <Skeleton variant="text" className="w-1/4 h-3" />
    </div>
  );
}

export { Skeleton, SkeletonCard };
