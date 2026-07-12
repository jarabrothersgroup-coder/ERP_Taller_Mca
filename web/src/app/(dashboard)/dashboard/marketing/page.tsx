"use client";

import * as React from "react";
import { useCampaigns } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, Plus, Send, Eye, MousePointerClick } from "lucide-react";

export default function MarketingPage() {
  const { data: campaigns = [], isLoading } = useCampaigns();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const totalEnviados = campaigns.reduce((s, c) => s + (c.enviados ?? 0), 0);
  const totalAperturas = campaigns.reduce((s, c) => s + (c.aperturas ?? 0), 0);
  const totalConversiones = campaigns.reduce((s, c) => s + (c.conversiones ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">Campañas, fidelización y reseñas</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Nueva Campaña</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Send className="h-3 w-3" /> Enviados
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalEnviados}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Eye className="h-3 w-3" /> Aperturas
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalAperturas}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <MousePointerClick className="h-3 w-3" /> Conversiones
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalConversiones}</p></CardContent>
        </Card>
      </div>

      {/* Campaigns */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay campañas registradas</p>
            <p className="text-xs text-muted-foreground mt-1">Creá una campaña para comenzar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Card key={c.id} className="hover:border-foreground/20 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{c.nombre}</CardTitle>
                  <Badge variant={c.status === "ACTIVA" ? "success" : "secondary"}>{c.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{c.tipo}</span>
                  <span>{c.enviados} enviados</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
