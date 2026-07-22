/**
 * Push Notification & OT Assignment Screen — S78-7
 *
 * Handles incoming push notifications and displays OT assignments.
 * Uses WebSocket for real-time updates + 30s polling fallback.
 *
 * @module mobile/screens/PushNotificationsScreen
 */

import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { api } from "../api/client";
import { useWorkOrders } from "../hooks/use-data";
import { useNotificationWS, type WSNotification } from "../hooks/use-notification-ws";
import { getSession } from "../auth/session";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
  priority: "low" | "normal" | "high" | "urgent";
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent": return colors.error;
    case "high": return "#ff6b35";
    case "normal": return colors.primary;
    default: return colors.textMuted;
  }
}

function getPriorityIcon(priority: string): string {
  switch (priority) {
    case "urgent": return "alert-circle";
    case "high": return "warning";
    case "normal": return "notifications";
    default: return "notifications-outline";
  }
}

function mapWSNotification(wsn: WSNotification): NotificationItem {
  return {
    id: wsn.id,
    title: wsn.titulo,
    body: wsn.mensaje,
    data: wsn.entityId ? { ordenId: wsn.entityId } : undefined,
    read: false,
    createdAt: new Date().toISOString(),
    priority: (wsn.priority as any) ?? "normal",
  };
}

function mapAPINotification(n: any): NotificationItem {
  return {
    id: n.id,
    title: n.titulo ?? n.title ?? "",
    body: n.mensaje ?? n.body ?? "",
    data: n.data ? (typeof n.data === "string" ? JSON.parse(n.data) : n.data) : undefined,
    read: n.leido ?? n.read ?? false,
    createdAt: n.createdAt ?? n.created_at ?? new Date().toISOString(),
    priority: n.prioridad ?? n.priority ?? "normal",
  };
}

export default function PushNotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(true);
  const { data: assignedOTs = [] } = useWorkOrders({ status: "pending" });

  // Read tenant slug from session for WebSocket connection
  const [tenantSlug, setTenantSlug] = React.useState("demo");
  React.useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session?.slug) setTenantSlug(session.slug);
    })();
  }, []);

  // Stable callback for WS notifications — wrapped in useCallback to avoid reconnects
  const handleWSNotification = React.useCallback((wsn: WSNotification) => {
    const item = mapWSNotification(wsn);
    setNotifications((prev) => [item, ...prev]);
  }, []);

  // WebSocket connection for real-time notifications
  const { connected } = useNotificationWS({
    tenantSlug,
    onNotification: handleWSNotification,
  });

  const fetchNotifications = React.useCallback(async () => {
    try {
      const data = await api.listNotifications();
      const mapped: NotificationItem[] = (data ?? []).map(mapAPINotification);
      setNotifications(mapped);
    } catch (err) {
      console.warn("[PushNotifications] Failed to fetch notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount + poll every 30s as WS fallback
  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = React.useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      console.warn("[PushNotifications] Failed to mark read:", err);
    }
  }, []);

  const handleNavigateToOT = React.useCallback((ordenId?: string) => {
    if (ordenId) {
      navigation.navigate("WorkOrders", {
        screen: "WorkOrderDetail",
        params: { id: ordenId },
      });
    }
  }, [navigation]);

  const handleMarkAllRead = React.useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.markAllNotificationsRead();
    } catch (err) {
      console.warn("[PushNotifications] Failed to mark all read:", err);
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          <View style={styles.headerSubRow}>
            <Text style={styles.headerSub}>
              {isLoading ? "Cargando..." : unreadCount > 0 ? `${unreadCount} sin leer` : "Todo leído"}
            </Text>
            {connected && (
              <View style={styles.wsBadge}>
                <View style={styles.wsDot} />
                <Text style={styles.wsText}>Tiempo real</Text>
              </View>
            )}
          </View>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Leer todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Connection Status + Push Toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Ionicons
            name={connected ? "wifi" : "wifi-outline"}
            size={20}
            color={connected ? colors.success : colors.textMuted}
          />
          <Text style={styles.toggleLabel}>
            {connected ? "Conectado en tiempo real" : "Usando polling (30s)"}
          </Text>
        </View>
        <Switch
          value={pushEnabled}
          onValueChange={setPushEnabled}
          trackColor={{ false: colors.border, true: colors.primary + "60" }}
          thumbColor={pushEnabled ? colors.primary : colors.textMuted}
        />
      </View>

      {/* OT Assignments */}
      {assignedOTs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Órdenes Asignadas ({assignedOTs.length})</Text>
          {assignedOTs.slice(0, 3).map((ot: any) => (
            <TouchableOpacity
              key={ot.id}
              style={styles.otCard}
              onPress={() => handleNavigateToOT(ot.id)}
            >
              <View style={styles.otCardContent}>
                <View style={styles.otBadge}>
                  <Text style={styles.otBadgeText}>OT</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.otTitle}>#{ot.id.slice(0, 8)}</Text>
                  <Text style={styles.otSub}>{ot.cliente ?? "—"} — {ot.vehiculo ?? "—"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Notification List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actividad Reciente</Text>
        {isLoading ? (
          <View style={styles.centered}>
            <Text style={styles.loadingText}>Cargando notificaciones...</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.notifCard, !item.read && styles.notifCardUnread]}
                onPress={() => {
                  handleMarkRead(item.id);
                  if (item.data?.ordenId) handleNavigateToOT(item.data.ordenId);
                }}
              >
                <View style={styles.notifIcon}>
                  <Ionicons
                    name={getPriorityIcon(item.priority)}
                    size={22}
                    color={getPriorityColor(item.priority)}
                  />
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifHeader}>
                    <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>
                      {item.title}
                    </Text>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                  <Text style={styles.notifTime}>
                    {new Date(item.createdAt).toLocaleDateString("es-PY", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>Sin notificaciones</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  centered: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  loadingText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.sm },
  headerInfo: { flex: 1, marginLeft: spacing.md },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  headerSub: { fontSize: fontSize.xs, color: colors.textSecondary },
  wsBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.success + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
  wsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  wsText: { fontSize: 9, color: colors.success, fontWeight: "600" },
  markAllBtn: { padding: spacing.sm },
  markAllText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: "500" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  toggleInfo: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  toggleLabel: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
  section: { padding: spacing.md, flex: 1 },
  sectionTitle: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  list: { gap: spacing.sm },
  otCard: { backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  otCardContent: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  otBadge: { width: 36, height: 36, borderRadius: borderRadius.sm, backgroundColor: colors.primary + "20", justifyContent: "center", alignItems: "center" },
  otBadgeText: { fontSize: 10, fontWeight: "700", color: colors.primary },
  otTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  otSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  notifCard: { flexDirection: "row", backgroundColor: colors.card, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  notifCardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  notifIcon: { width: 40, justifyContent: "center", alignItems: "center" },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  notifTitle: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500", flex: 1 },
  notifTitleUnread: { fontWeight: "700" },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 4, lineHeight: 16 },
  notifTime: { fontSize: 10, color: colors.textMuted, marginTop: spacing.xs },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: spacing.sm },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.md },
});
