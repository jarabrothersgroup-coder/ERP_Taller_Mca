"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Show error styling (red border, ring) */
  hasError?: boolean;
  /** Placeholder option text */
  placeholder?: string;
  /** Array of options */
  options?: { value: string; label: string; disabled?: boolean }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError, disabled, placeholder, options, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={hasError ? "true" : undefined}
          className={cn(
            // Base — same as Input
            "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm appearance-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "hover:border-foreground/30 transition-colors duration-150",
            "active:border-foreground/40",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted disabled:hover:border-input",
            // Arrow custom spacing
            "pr-8",
            // Error
            hasError
              ? "border-destructive text-destructive focus-visible:ring-destructive/70"
              : "border-input",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                >
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {/* Custom chevron icon */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
