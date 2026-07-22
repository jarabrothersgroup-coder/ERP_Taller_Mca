/**
 * Push Notification & OT Assignment Screen — S78-7
 *
 * Handles incoming push notifications and displays OT assignments.
 * Uses expo-notifications for local notification handling.
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
import { useWorkOrders } from "../hooks/use-data";
import type { WorkOrder } from "../api/client";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
  priority: "low" | "normal" | "high" | "urgent";
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", title: "Nueva OT Asignada", body: "OT #a1b2c3d4 — Toyota RAV4 — Inspección general", data: { ordenId: "a1b2c3d4" }, read: false, createdAt: new Date().toISOString(), priority: "high" },
  { id: "n2", title: "HV Lockout Requerido", body: "OT #e5f6g7h8 — Hyundai Ioniq Eléctrico — Firma HV obligatoria", data: { ordenId: "e5f6g7h8" }, read: false, createdAt: new Date(Date.now() - 3600000).toISOString(), priority: "urgent" },
  { id: "n3", title: "Recordatorio: OT Pendiente", body: "OT #i9j0k1l2 — Servicio de 30.000km tiene 2 días en revisión", data: { ordenId: "i9j0k1l2" }, read: true, createdAt: new Date(Date.now() - 86400000).toISOString(), priority: "normal" },
];

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

export default function PushNotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const { data: assignedOTs = [] } = useWorkOrders({ status: "pending" });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = React.useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const handleNavigateToOT = React.useCallback((ordenId?: string) => {
    if (ordenId) {
      navigation.navigate("WorkOrders", {
        screen: "WorkOrderDetail",
        params: { id: ordenId },
      });
    }
  }, [navigation]);

  const handleMarkAllRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
          <Text style={styles.headerSub}>
            {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo leído"}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Leer todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Push Toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Ionicons name="notifications" size={20} color={colors.primary} />
          <Text style={styles.toggleLabel}>Notificaciones Push</Text>
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
          {assignedOTs.slice(0, 3).map((ot) => (
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.sm },
  headerInfo: { flex: 1, marginLeft: spacing.md },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  headerSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
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
