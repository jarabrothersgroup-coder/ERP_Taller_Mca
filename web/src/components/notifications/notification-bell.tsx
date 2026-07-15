/**
 * Notification Bell — Real-time notification indicator with SSE integration.
 *
 * Shows unread count badge, opens dropdown with notification list.
 * Uses SSE for live updates via the useSse hook.
 *
 * @module components/notifications/notification-bell
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSse, type SseNotification } from "@/hooks/use-sse";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, BellRing, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ──────────────────────────────────── */

interface StoredNotification {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  entityType?: string;
  entityId?: string;
  priority: string;
  timestamp: string;
  read: boolean;
}

interface NotificationBellProps {
  /** Maximum notifications to show in the dropdown */
  maxVisible?: number;
  /** Additional CSS classes */
  className?: string;
  /** Toast callback for new notifications */
  onToast?: (notification: SseNotification) => void;
}

/* ── Helpers ────────────────────────────────── */

function priorityColor(priority: string): string {
  switch (priority) {
    case "urgent":
      return "text-red-500 bg-red-50 dark:bg-red-950";
    case "high":
      return "text-orange-500 bg-orange-50 dark:bg-orange-950";
    case "medium":
      return "text-blue-500 bg-blue-50 dark:bg-blue-950";
    default:
      return "text-muted-foreground bg-muted";
  }
}

function tipoIcon(tipo: string): string {
  switch (tipo) {
    case "orden":
      return "🔧";
    case "factura":
      return "📄";
    case "inventario":
      return "📦";
    case "scheduling":
      return "📅";
    case "sifen":
      return "🏛️";
    default:
      return "🔔";
  }
}

function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

/* ── Component ──────────────────────────────── */

export function NotificationBell({
  maxVisible = 20,
  className,
  onToast,
}: NotificationBellProps) {
  const [storedNotifications, setStoredNotifications] = useState<StoredNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  /** Fetch initial notifications from API */
  const fetchInitialNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=50", {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.notifications ?? (Array.isArray(data) ? data : []);
        if (items.length > 0) {
          setStoredNotifications(
            items.map((n: any) => ({
              id: n.id,
              tipo: n.tipo,
              titulo: n.titulo,
              mensaje: n.mensaje,
              entityType: n.entityType,
              entityId: n.entityId,
              priority: n.priority || "normal",
              timestamp: n.createdAt || n.timestamp,
              read: n.leido || false,
            })),
          );
        }
      }
    } catch (err) {
      console.error("[NotificationBell] Failed to fetch initial notifications:", err);
    }
  }, []);

  /* Fetch initial notifications on mount */
  useEffect(() => {
    fetchInitialNotifications();
  }, [fetchInitialNotifications]);

  /* SSE connection for real-time updates */
  const { status: sseStatus, lastNotification } = useSse({
    enabled: true,
    onNotification: (n) => {
      // Add to local list
      setStoredNotifications((prev) => [
        {
          id: n.id,
          tipo: n.tipo,
          titulo: n.titulo,
          mensaje: n.mensaje,
          entityType: n.entityType,
          entityId: n.entityId,
          priority: n.priority,
          timestamp: n.timestamp,
          read: false,
        },
        ...prev,
      ].slice(0, 100));

      // Show toast if callback provided
      onToast?.(n);
    },
  });

  /* Play notification sound + vibrate on new notification */
  useEffect(() => {
    if (lastNotification) {
      // Vibrate on mobile
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(200);
      }
    }
  }, [lastNotification]);

  const unreadCount = storedNotifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setStoredNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllAsRead = () => {
    setStoredNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setStoredNotifications([]);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
        >
          {sseStatus === "connected" ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] flex items-center justify-center px-1 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
          {/* SSE status indicator */}
          <span
            className={cn(
              "absolute bottom-0 right-0 h-2 w-2 rounded-full",
              sseStatus === "connected" && "bg-green-500",
              sseStatus === "connecting" && "bg-yellow-500 animate-pulse",
              sseStatus === "disconnected" && "bg-gray-400",
              sseStatus === "error" && "bg-red-500",
            )}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notificaciones</span>
            <Badge variant="secondary" className="text-xs">
              {storedNotifications.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Leer todas
              </Button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[400px]">
          {storedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Sin notificaciones</p>
              <p className="text-xs mt-1">
                {sseStatus === "connected"
                  ? "Conectado en tiempo real"
                  : "Conectando..."}
              </p>
            </div>
          ) : (
            storedNotifications.slice(0, maxVisible).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 cursor-pointer border-b last:border-0",
                  !notification.read && "bg-muted/50",
                )}
                onClick={() => markAsRead(notification.id)}
              >
                <span className="text-lg mt-0.5">{tipoIcon(notification.tipo)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-medium truncate", !notification.read && "font-semibold")}>
                      {notification.titulo}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1 py-0", priorityColor(notification.priority))}
                    >
                      {notification.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.mensaje}
                  </p>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    {timeAgo(notification.timestamp)}
                  </span>
                </div>
                {!notification.read && (
                  <Check className="h-4 w-4 text-blue-500 shrink-0 mt-1" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        {storedNotifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-4 py-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearAll}>
                Limpiar todo
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {sseStatus === "connected" ? "🟢 En vivo" : "🔴 Desconectado"}
              </span>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
