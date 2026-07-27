// @ts-nocheck — BarcodeDetector API no está en tipos DOM estándar de TypeScript
"use client";

import * as React from "react";
import { Scan, Loader2, Camera, CameraOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────── */

export interface ScanResult {
  format: string;
  value: string;
  confidence: number;
}

interface ScannerCapability {
  supported: boolean;
  formats: string[];
}

/* ── Native BarcodeDetector API ─────────────── */

async function getScannerCapability(): Promise<ScannerCapability> {
  if (typeof BarcodeDetector === "undefined") {
    return { supported: false, formats: [] };
  }
  try {
    const formats = await BarcodeDetector.getSupportedFormats();
    return { supported: true, formats };
  } catch {
    return { supported: false, formats: [] };
  }
}

/* ── Component ──────────────────────────────── */

interface BarcodeScannerButtonProps {
  /** Called when a barcode/QR code is successfully scanned */
  onScan: (result: ScanResult) => void;
  /** Optional: auto-close dialog after scan */
  autoClose?: boolean;
  /** Optional: variant for the button */
  variant?: "default" | "outline" | "ghost";
  /** Optional: size for the button */
  size?: "sm" | "default" | "lg";
  /** Optional: additional className */
  className?: string;
  /** Optional: label text */
  label?: string;
}

export function BarcodeScannerButton({
  onScan,
  autoClose = true,
  variant = "outline",
  size = "sm",
  className,
  label = "Escanear",
}: BarcodeScannerButtonProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [open, setOpen] = React.useState(false);
  const [capability, setCapability] = React.useState<ScannerCapability | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasResult, setHasResult] = React.useState(false);
  const stopScanRef = React.useRef<(() => void) | null>(null);
  const hasResultRef = React.useRef(false);

  // Check capability on mount
  React.useEffect(() => {
    getScannerCapability().then(setCapability);
  }, []);

  // Open dialog → start camera
  const handleOpen = React.useCallback(async () => {
    setOpen(true);
    setError(null);
    setHasResult(false);
    hasResultRef.current = false;

    // Small delay to ensure dialog is rendered
    await new Promise((r) => setTimeout(r, 300));
    if (!videoRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);

      // Start detection loop
      const detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "code_93", "qr_code", "data_matrix"],
      });

      let active = true;
      stopScanRef.current = () => {
        active = false;
        stream.getTracks().forEach((t) => t.stop());
      };

      const loop = async () => {
        while (active && !hasResultRef.current) {
          try {
            const barcodes = await detector.detect(videoRef.current!);
            if (barcodes.length > 0 && !hasResultRef.current) {
              const barcode = barcodes[0];
              hasResultRef.current = true;
              setHasResult(true);

              // Brief pause to show success
              await new Promise((r) => setTimeout(r, 400));

              const result: ScanResult = {
                format: barcode.format,
                value: barcode.rawValue,
                confidence: 1.0,
              };
              onScan(result);

              if (autoClose) {
                handleClose();
              }
              return;
            }
          } catch {
            // Frame error, continue
          }
          await new Promise((r) => setTimeout(r, 150));
        }
      };

      loop();
    } catch (err: any) {
      setError(err?.message || "Error al acceder a la cámara");
      setScanning(false);
    }
  }, [onScan, autoClose]);

  const handleClose = React.useCallback(() => {
    if (stopScanRef.current) {
      stopScanRef.current();
      stopScanRef.current = null;
    }
    setScanning(false);
    setOpen(false);
    setError(null);
    setHasResult(false);
    hasResultRef.current = false;
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (stopScanRef.current) stopScanRef.current();
    };
  }, []);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn("gap-1.5", className)}
        onClick={handleOpen}
        disabled={capability !== null && !capability.supported}
        title={
          capability && !capability.supported
            ? "El escáner requiere Chrome, Edge u Opera"
            : label
        }
      >
        <Scan className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5 text-blue-500" />
              Escanear Código
            </DialogTitle>
            <DialogDescription>
              Apunte la cámara al código de barras o QR del producto
            </DialogDescription>
          </DialogHeader>

          <div className="relative overflow-hidden rounded-lg bg-black aspect-[4/3]">
            {/* Camera feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "w-full h-full object-cover",
                (!scanning || hasResult) && "opacity-0",
              )}
            />

            {/* Scanning overlay */}
            {scanning && !hasResult && (
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Corner brackets */}
                <div className="relative w-48 h-32">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br" />
                  {/* Scanning line animation */}
                  <div className="absolute left-1 right-1 h-0.5 bg-blue-400/70 animate-scan-line" />
                </div>
              </div>
            )}

            {/* Scanning indicator */}
            {scanning && !hasResult && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Escaneando…
              </div>
            )}

            {/* Success overlay */}
            {hasResult && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="flex flex-col items-center gap-2 text-white">
                  <CheckCircle2 className="h-10 w-10 text-green-400" />
                  <span className="text-sm font-medium">¡Código detectado!</span>
                </div>
              </div>
            )}

            {/* Camera not started */}
            {!scanning && !error && !hasResult && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Camera className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted gap-2 p-4">
                <CameraOff className="h-8 w-8 text-red-400" />
                <p className="text-sm text-center text-muted-foreground">{error}</p>
                <p className="text-xs text-center text-muted-foreground">
                  Asegúrese de haber concedido permisos de cámara
                </p>
              </div>
            )}

            {/* Caps lock overlay for manual entry */}
            {!scanning && !error && capability?.supported && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs">
                <AlertCircle className="h-3 w-3 text-amber-400" />
                Presione &quot;Iniciar Cámara&quot; para escanear
              </div>
            )}
          </div>

          {/* Error action */}
          {error && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  handleClose();
                  setTimeout(() => handleOpen(), 200);
                }}
              >
                <Camera className="h-4 w-4" />
                Reintentar
              </Button>
            </div>
          )}

          {/* Supported formats */}
          {capability?.supported && capability.formats.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Formatos soportados: {capability.formats.slice(0, 6).join(", ")}
              {capability.formats.length > 6 && ` y ${capability.formats.length - 6} más`}
            </p>
          )}

          {/* Unsupported browser */}
          {capability && !capability.supported && (
            <p className="text-xs text-amber-600 text-center">
              El escáner nativo requiere <strong>Chrome</strong>, <strong>Edge</strong> u{" "}
              <strong>Opera</strong>. En otros navegadores, use la búsqueda manual.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Scan line animation keyframes */}
      <style jsx global>{`
        @keyframes scan-line {
          0%, 100% { top: 8%; }
          50% { top: 92%; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
