/**
 * Vehicles screen — list with engine type badges
 */

import * as React from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { useVehicles } from "../hooks/use-data";
import type { Vehicle } from "../api/client";

const engineColors: Record<string, string> = {
  Nafta: colors.info,
  Diesel: colors.textSecondary,
  HEV: colors.warning,
  BEV: colors.error,
  Híbrido: colors.warning,
  Eléctrico: colors.error,
};

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const engineColor = engineColors[vehicle.engineType] ?? colors.textSecondary;

  return (
    <View style={styles.card}>
      <View style={[styles.engineIndicator, { backgroundColor: engineColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardBrand}>{vehicle.brand} {vehicle.model}</Text>
          <Text style={styles.cardPlate}>{vehicle.plate ?? "—"}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardYear}>{vehicle.year ?? "—"}</Text>
          <Text style={styles.cardSep}>·</Text>
          <Text style={[styles.cardEngine, { color: engineColor }]}>{vehicle.engineType}</Text>
          {vehicle.kilometraje != null && (
            <>
              <Text style={styles.cardSep}>·</Text>
              <Text style={styles.cardKm}>{vehicle.kilometraje.toLocaleString("es-PY")} km</Text>
            </>
          )}
        </View>
        {vehicle.vin && (
          <Text style={styles.cardVin}>VIN: {vehicle.vin}</Text>
        )}
      </View>
    </View>
  );
}

export default function VehiclesScreen() {
  const [search, setSearch] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);
  const { data: vehicles = [], isLoading, refetch } = useVehicles();

  const filtered = React.useMemo(() => {
    if (!search) return vehicles;
    const q = search.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.brand.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.plate?.toLowerCase().includes(q) ||
        v.vin?.toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar marca, modelo o placa..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <Text style={styles.count}>
        {filtered.length} vehículo{filtered.length !== 1 ? "s" : ""}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => <VehicleCard vehicle={item} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No hay vehículos registrados</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    margin: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    marginLeft: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  count: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  list: { padding: spacing.md, paddingTop: 0 },
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  engineIndicator: { width: 4 },
  cardContent: { flex: 1, padding: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardBrand: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  cardPlate: { fontSize: fontSize.sm, fontWeight: "600", color: colors.primary },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
  cardYear: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardSep: { fontSize: fontSize.xs, color: colors.textMuted, marginHorizontal: 4 },
  cardEngine: { fontSize: fontSize.xs, fontWeight: "500" },
  cardKm: { fontSize: fontSize.xs, color: colors.textMuted },
  cardVin: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs, fontFamily: "monospace" },
  empty: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.md },
});
