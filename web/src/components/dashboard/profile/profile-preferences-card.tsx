"use client";

import { Bell, Sun, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function ProfilePreferencesCard({
  notificationsEnabled,
  onNotificationsToggle,
}: {
  notificationsEnabled: boolean;
  onNotificationsToggle: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" aria-hidden="true" />
          Preferencias
        </CardTitle>
        <CardDescription>
          Configuración de notificaciones y apariencia
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Notificaciones</p>
              <p className="text-xs text-muted-foreground">Alertas de órdenes y mensajes</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={onNotificationsToggle}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              notificationsEnabled ? "bg-orange-500" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notificationsEnabled ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sun className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Tema oscuro</p>
              <p className="text-xs text-muted-foreground">Alternar entre modo claro y oscuro</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Moon className="h-3 w-3" />
            Oscuro
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
