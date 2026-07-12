import * as React from "react";

export function FormField({
  label,
  icon: Icon,
  children,
  required,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {Icon && <Icon className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground align-text-bottom" aria-hidden="true" />}
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
