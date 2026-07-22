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
import { useDashboard, useWorkOrders, useBalanceGeneral, useEstadoResultados } from "../hooks/use-data";

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
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Financial metrics queries
  const { data: balanceGeneral, isLoading: isLoadingBalance } = useBalanceGeneral(selectedMonth + '-01');
  const { data: estadoResultados, isLoading: isLoadingEstadoResultados } = useEstadoResultados(
    parseInt(selectedMonth.split('-')[0]),
    parseInt(selectedMonth.split('-')[1])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchOrders()]);
    setRefreshing(false);
  }, [refetchStats, refetchOrders]);

  const formatCurrency = (amount: number) => {
    return `₲ ${amount.toLocaleString("es-PY")}`;
  };

  const getMonthYearOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString("es-PY", { month: "long", year: "numeric" }),
      });
    }
    return options;
  };

  const recentOrders = orders.slice(0, 5);

  // Financial metrics calculations
  const totalAssets = balanceGeneral?.totalActivo || 0;
  const totalLiabilities = balanceGeneral?.totalPasivoPatrimonio || 0;
  const netWorth = totalAssets - totalLiabilities;
  const totalRevenue = estadoResultados?.ingresos?.total || 0;
  const totalExpenses = estadoResultados?.gastos?.total || 0;
  const netProfit = totalRevenue - totalExpenses;

  // Calculate financial ratios
  const calculateProfitMargin = () => {
    if (totalRevenue === 0) return 0;
    return (netProfit / totalRevenue) * 100;
  };

  const calculateAssetTurnover = () => {
    if (totalAssets === 0) return 0;
    return totalRevenue / totalAssets;
  };

  const calculateLiabilityRatio = () => {
    if (totalLiabilities === 0) return 0;
    return totalLiabilities / totalAssets;
  };

  const profitMargin = calculateProfitMargin();
  const assetTurnover = calculateAssetTurnover();
  const liabilityRatio = calculateLiabilityRatio();

  // Add additional financial metrics cards
  const financialMetrics = [
    {
      label: "Margen Beneficio",
      value: `${profitMargin.toFixed(1)}%`,
      icon: "stats-chart",
      color: profitMargin >= 10 ? colors.success : profitMargin >= 5 ? colors.warning : colors.error,
      trend: profitMargin >= 10 ? "up" : profitMargin >= 5 ? "stable" : "down",
    },
    {
      label: "Rotación Activos",
      value: assetTurnover.toFixed(2),
      icon: "repeat",
      color: assetTurnover >= 1.5 ? colors.success : assetTurnover >= 1.0 ? colors.info : colors.warning,
      trend: assetTurnover >= 1.5 ? "up" : "stable",
    },
    {
      label: "Ratio Pasivos",
      value: liabilityRatio.toFixed(2),
      icon: "warning",
      color: liabilityRatio <= 0.5 ? colors.success : liabilityRatio <= 0.8 ? colors.warning : colors.error,
      trend: liabilityRatio <= 0.5 ? "down" : "stable",
    },
  ];

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

      {/* Month Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Período Contable</Text>
        <View style={styles.monthSelector}>
          {getMonthYearOptions().map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.monthChip, selectedMonth === option.value && styles.monthChipActive]}
              onPress={() => setSelectedMonth(option.value)}
            >
              <Text style={[styles.monthChipText, selectedMonth === option.value && styles.monthChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Financial Metrics Cards */}
      {(isLoadingBalance || isLoadingEstadoResultados) ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando datos financieros...</Text>
        </View>
      ) : (
        <View style={styles.financialGrid}>
          {/* Balance General Cards */}
          <View style={styles.financialCard}>
            <View style={[styles.financialCardHeader, { backgroundColor: colors.success + "20" }]}>
              <Ionicons name="trending-up" size={24} color={colors.success} />
              <Text style={styles.financialCardTitle}>Total Activos</Text>
            </View>
            <Text style={styles.financialCardValue}>{formatCurrency(totalAssets)}</Text>
            <Text style={styles.financialCardLabel}>Estado Financiero</Text>
          </View>

          <View style={styles.financialCard}>
            <View style={[styles.financialCardHeader, { backgroundColor: colors.error + "20" }]}>
              <Ionicons name="document-text" size={24} color={colors.error} />
              <Text style={styles.financialCardTitle}>Patrimonio</Text>
            </View>
            <Text style={styles.financialCardValue}>{formatCurrency(netWorth)}</Text>
            <Text style={styles.financialCardLabel}>Neto</Text>
          </View>

          <View style={styles.financialCard}>
            <View style={[styles.financialCardHeader, { backgroundColor: colors.info + "20" }]}>
              <Ionicons name="cash" size={24} color={colors.info} />
              <Text style={styles.financialCardTitle}>Ingresos</Text>
            </View>
            <Text style={styles.financialCardValue}>{formatCurrency(totalRevenue)}</Text>
            <Text style={styles.financialCardLabel}>Del Período</Text>
          </View>

          <View style={styles.financialCard}>
            <View style={[styles.financialCardHeader, { backgroundColor: "#8b5cf6" + "20" }]}>
              <Ionicons name="trending-down" size={24} color="#8b5cf6" />
              <Text style={styles.financialCardTitle}>Gastos</Text>
            </View>
            <Text style={styles.financialCardValue}>{formatCurrency(totalExpenses)}</Text>
            <Text style={styles.financialCardLabel}>Total</Text>
          </View>
        </View>
      )}

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
  // Financial metrics styles
  monthSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  monthChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  monthChipText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  monthChipTextActive: {
    color: colors.textInverse,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: "center",
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  financialGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  financialCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  financialCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  financialCardTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
    marginLeft: spacing.sm,
  },
  financialCardValue: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  financialCardLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
