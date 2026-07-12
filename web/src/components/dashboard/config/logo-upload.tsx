"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoUpload({
  currentLogo,
  onLogoChange,
  disabled,
}: {
  currentLogo: string | null;
  onLogoChange: (logo: string | null) => void;
  disabled: boolean;
}) {
  const [preview, setPreview] = React.useState<string | null>(currentLogo);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no puede superar los 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      onLogoChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          "flex h-28 w-28 items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden",
          dragOver
            ? "border-orange-500 bg-orange-500/5 scale-105"
            : preview
            ? "border-orange-300 dark:border-orange-700 bg-muted/30"
            : "border-muted-foreground/30 hover:border-muted-foreground/50 bg-muted/10"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        aria-label="Subir logo del taller"
      >
        {preview ? (
          <img src={preview} alt="Logo del taller" className="h-full w-full object-contain p-2" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="h-6 w-6" aria-hidden="true" />
            <span className="text-[10px]">Logo</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }}
        disabled={disabled}
      />

      <p className="text-[10px] text-muted-foreground text-center max-w-[120px] leading-tight">
        PNG o JPG, máx 5MB
      </p>

      {preview && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground"
          onClick={() => { setPreview(null); onLogoChange(null); }}
          disabled={disabled}
        >
          Quitar logo
        </Button>
      )}
    </div>
  );
}
