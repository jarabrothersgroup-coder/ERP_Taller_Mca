"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Show error styling (red border, ring) */
  hasError?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        aria-invalid={hasError ? "true" : undefined}
        className={cn(
          // Base
          "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground/60",
          // Focus
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Hover
          "hover:border-foreground/30 transition-colors duration-150",
          // Active
          "active:border-foreground/40",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted disabled:hover:border-input",
          // Error
          hasError
            ? "border-destructive text-destructive focus-visible:ring-destructive/70"
            : "border-input",
          // Resize
          "resize-y",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
