"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Show error styling (red border, ring) */
  hasError?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, hasError, disabled, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        disabled={disabled}
        aria-invalid={hasError ? "true" : undefined}
        className={cn(
          // Base
          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/60",
          // Focus: thick ring
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Hover: subtle border brighten
          "hover:border-foreground/30 transition-colors duration-150",
          // Active: slight press effect
          "active:border-foreground/40",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted disabled:hover:border-input",
          // Error state — uses red tone that works in both light/dark
          hasError
            ? "border-destructive text-destructive focus-visible:ring-destructive/70"
            : "border-input",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
