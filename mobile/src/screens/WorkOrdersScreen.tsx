/**
 * Work Orders screen — list + filter by status
 */

import * as React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { useWorkOrders } from "../hooks/use-data";
import type { WorkOrder } from "../api/client";

const statusFilters = [
  { key: "", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "in_progress", label: "En Progreso" },
  { key: "completed", label: "Completadas" },
  { key: "budgeted", label: "Presupuestadas" },
];

function OrderCard({ order, onPress }: { order: WorkOrder; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardId}>OT #{order.id.slice(0, 8)}</Text>
        <View style={[styles.badge, { backgroundColor: getStatusColor(order.status) + "20" }]}>
          <Text style={[styles.badgeText, { color: getStatusColor(order.status) }]}>
            {order.status.replace("_", " ")}
          </Text>
        </View>
      </View>

      <Text style={styles.cardClient}>{order.cliente ?? "Sin cliente"}</Text>
      <Text style={styles.cardVehicle}>{order.vehiculo ?? order.plate ?? "—"}</Text>

      {order.description && (
        <Text style={styles.cardDesc} numberOfLines={2}>{order.description}</Text>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>
          {new Date(order.createdAt).toLocaleDateString("es-PY")}
        </Text>
        {order.hvAlert && (
          <View style={[styles.badge, { backgroundColor: colors.error + "20" }]}>
            <Text style={[styles.badgeText, { color: colors.error }]}>HV Alert</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
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

export default function WorkOrdersScreen({ navigation }: any) {
  const [filter, setFilter] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);
  const { data: orders = [], isLoading, refetch } = useWorkOrders(filter ? { status: filter } : undefined);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={styles.container}>
      {/* Filters */}
      <FlatList
        horizontal
        data={statusFilters}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Orders List */}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => navigation.navigate("WorkOrderDetail", { id: item.id })}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="build-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No hay órdenes de trabajo</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  filterList: { padding: spacing.md, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: "500" },
  filterTextActive: { color: colors.textInverse },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  cardId: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.sm },
  badgeText: { fontSize: fontSize.xs, fontWeight: "600" },
  cardClient: { fontSize: fontSize.sm, color: colors.textSecondary },
  cardVehicle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  cardDesc: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm },
  cardDate: { fontSize: fontSize.xs, color: colors.textMuted },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.md },
});
