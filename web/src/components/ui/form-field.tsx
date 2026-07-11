"use client";

import * as React from "react";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface FormFieldProps {
  /** Label text displayed above the input */
  label?: string;
  /** HTML `for` attribute linking to the input id */
  htmlFor?: string;
  /** Error message — shows red text with icon when present */
  error?: string;
  /** Helper text shown below the input in muted style */
  helperText?: string;
  /** Whether the field is required (adds asterisk) */
  required?: boolean;
  /** Size variant for the label */
  labelSize?: "sm" | "default" | "lg";
  /** The input/select/textarea child element */
  children: React.ReactNode;
  /** Additional wrapper className */
  className?: string;
}

function FormField({
  label,
  htmlFor,
  error,
  helperText,
  required = false,
  labelSize = "default",
  children,
  className,
}: FormFieldProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const helperId = htmlFor ? `${htmlFor}-helper` : undefined;

  return (
    <div className={cn("space-y-1.5", className)} role="group">
      {label && (
        <div className="flex items-center gap-1">
          <Label htmlFor={htmlFor} size={labelSize}>
            {label}
          </Label>
          {required && (
            <span className="text-destructive font-medium" aria-hidden="true">
              *
            </span>
          )}
        </div>
      )}

      {children}

      {/* Error message — icon + text, never just color */}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {/* Helper text */}
      {helperText && !error && (
        <p
          id={helperId}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{helperText}</span>
        </p>
      )}
    </div>
  );
}

export { FormField };
