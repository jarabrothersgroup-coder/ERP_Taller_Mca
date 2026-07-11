import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Spinner size */
  size?: "sm" | "default" | "lg" | "xl";
  /** Optional label for screen readers */
  label?: string;
}

const sizeMap = {
  sm: "h-4 w-4",
  default: "h-5 w-5",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

function Spinner({
  className,
  size = "default",
  label = "Cargando…",
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <Loader2
        className={cn("animate-spin text-muted-foreground", sizeMap[size])}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export { Spinner };
