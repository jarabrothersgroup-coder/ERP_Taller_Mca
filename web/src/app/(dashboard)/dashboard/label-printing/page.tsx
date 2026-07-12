"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Printer, Barcode, QrCode } from "lucide-react";

export default function LabelPrintingPage() {
  const [repuestoId, setRepuestoId] = React.useState("");
  const [herramientaId, setHerramientaId] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [result, setResult] = React.useState<{ type: string; label: string } | null>(null);

  const handleGenerate = async (type: "repuesto" | "herramienta", id: string) => {
    if (!id.trim()) return;
    setGenerating(true);
    try {
      const res = await api.generateLabel({ type, id: id.trim(), copies: 1 });
      setResult({ type, label: res.label });
    } catch (err) {
      console.error("Error generating label:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Impresión de Etiquetas</h1>
        <p className="text-sm text-muted-foreground">Generar etiquetas de código de barras y QR</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Repuesto Label */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Barcode className="h-4 w-4" /> Etiqueta de Repuesto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="ID del repuesto"
              value={repuestoId}
              onChange={(e) => setRepuestoId(e.target.value)}
            />
            <Button
              onClick={() => handleGenerate("repuesto", repuestoId)}
              disabled={generating || !repuestoId.trim()}
              className="w-full gap-2"
            >
              <Printer className="h-4 w-4" />
              {generating ? "Generando..." : "Generar Etiqueta"}
            </Button>
          </CardContent>
        </Card>

        {/* Herramienta Label */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Etiqueta de Herramienta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="ID de la herramienta"
              value={herramientaId}
              onChange={(e) => setHerramientaId(e.target.value)}
            />
            <Button
              onClick={() => handleGenerate("herramienta", herramientaId)}
              disabled={generating || !herramientaId.trim()}
              className="w-full gap-2"
            >
              <Printer className="h-4 w-4" />
              {generating ? "Generando..." : "Generar Etiqueta"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vista Previa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-white p-8 text-center">
              <div
                className="inline-block"
                dangerouslySetInnerHTML={{ __html: result.label }}
              />
            </div>
            <div className="flex justify-center mt-4 gap-2">
              <Badge variant="secondary">{result.type}</Badge>
              <Button size="sm" variant="outline">
                <Printer className="h-3 w-3 mr-1" /> Imprimir
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
