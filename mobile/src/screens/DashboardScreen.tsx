/**
 * Dashboard screen — KPI cards + recent orders
 */

import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { useDashboard, useWorkOrders } from "../hooks/use-data";

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }: any) {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data: stats, isLoading, refetch: refetchStats } = useDashboard();
  const { data: orders = [], refetch: refetchOrders } = useWorkOrders();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchOrders()]);
    setRefreshing(false);
  }, [refetchStats, refetchOrders]);

  const recentOrders = orders.slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>AutomotiveOS</Text>
          <Text style={styles.subtitle}>Panel de Control</Text>
        </View>
        <TouchableOpacity style={styles.avatar}>
          <Ionicons name="person" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsGrid}>
          <StatCard
            label="Ingresos"
            value={`₲ ${(stats.totalIngresos / 1_000_000).toFixed(1)}M`}
            icon="cash"
            color={colors.success}
          />
          <StatCard
            label="Órdenes"
            value={String(stats.totalOrdenes)}
            icon="build"
            color={colors.info}
          />
          <StatCard
            label="Completadas"
            value={String(stats.ordenesCompletadas)}
            icon="checkmark-circle"
            color={colors.primary}
          />
          <StatCard
            label="Ticket Prom."
            value={`₲ ${stats.ticketPromedio.toLocaleString("es-PY")}`}
            icon="trending-up"
            color="#8b5cf6"
          />
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accesos Rápidos</Text>
        <View style={styles.actionsGrid}>
          {[
            { label: "Órdenes", icon: "build", screen: "WorkOrders", color: colors.info },
            { label: "Clientes", icon: "people", screen: "Clients", color: colors.success },
            { label: "Vehículos", icon: "car", screen: "Vehicles", color: colors.primary },
            { label: "Agenda", icon: "calendar", screen: "Appointments", color: "#8b5cf6" },
          ].map((action) => (
            <TouchableOpacity
              key={action.screen}
              style={styles.actionCard}
              onPress={() => navigation.navigate(action.screen)}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color + "15" }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Órdenes Recientes</Text>
          <TouchableOpacity onPress={() => navigation.navigate("WorkOrders")}>
            <Text style={styles.seeAll}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        {recentOrders.length === 0 && !isLoading ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No hay órdenes recientes</Text>
          </View>
        ) : (
          recentOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              onPress={() => navigation.navigate("WorkOrderDetail", { id: order.id })}
            >
              <View style={styles.orderLeft}>
                <Text style={styles.orderId}>OT #{order.id.slice(0, 8)}</Text>
                <Text style={styles.orderClient}>{order.cliente ?? "Sin cliente"}</Text>
                <Text style={styles.orderVehicle}>{order.vehiculo ?? order.plate ?? "—"}</Text>
              </View>
              <View style={styles.orderRight}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + "20" }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                    {order.status}
                  </Text>
                </View>
                {order.hvAlert && (
                  <View style={[styles.statusBadge, { backgroundColor: colors.error + "20", marginTop: 4 }]}>
                    <Text style={[styles.statusText, { color: colors.error }]}>HV</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed": return colors.success;
    case "in_progress": return colors.info;
    case "pending": return colors.warning;
    case "budgeted": return "#8b5cf6";
    default: return colors.textSecondary;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing.lg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  greeting: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  statCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginTop: spacing.xs },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginBottom: spacing.md },
  seeAll: { fontSize: fontSize.sm, color: colors.primary, fontWeight: "500" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  actionLabel: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.xxl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm },
  orderCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderLeft: { flex: 1 },
  orderId: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  orderClient: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  orderVehicle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  orderRight: { alignItems: "flex-end", justifyContent: "center" },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusText: { fontSize: fontSize.xs, fontWeight: "600" },
});
