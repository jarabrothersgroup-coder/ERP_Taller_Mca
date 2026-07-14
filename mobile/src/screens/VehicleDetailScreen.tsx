/**
 * Vehicle detail screen — shows vehicle info with engine type badge.
 */

import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { useVehicle } from "../hooks/use-data";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorView from "../components/ErrorView";

const engineColors: Record<string, string> = {
  Nafta: colors.info,
  Diesel: colors.textSecondary,
  HEV: colors.warning,
  BEV: colors.error,
  Híbrido: colors.warning,
  Eléctrico: colors.error,
};

export default function VehicleDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { data: vehicle, isLoading, error, refetch } = useVehicle(id);

  React.useEffect(() => {
    navigation.setOptions({
      title: vehicle ? `${vehicle.brand} ${vehicle.model}` : "Vehículo",
    });
  }, [navigation, vehicle]);

  if (isLoading) return <LoadingSpinner message="Cargando vehículo..." />;
  if (error || !vehicle) return <ErrorView message="No se pudo cargar el vehículo" onRetry={refetch} />;

  const engineColor = engineColors[vehicle.engineType] ?? colors.textSecondary;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Vehicle Header */}
      <View style={styles.header}>
        <View style={[styles.engineBadge, { backgroundColor: engineColor + "20" }]}>
          <Ionicons name="car" size={24} color={engineColor} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>
            {vehicle.brand} {vehicle.model}
          </Text>
          <Text style={styles.plate}>{vehicle.plate ?? "Sin placa"}</Text>
        </View>
      </View>

      {/* Engine Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo de Motor</Text>
        <View style={[styles.engineTypeBadge, { backgroundColor: engineColor + "20" }]}>
          <View style={[styles.engineDot, { backgroundColor: engineColor }]} />
          <Text style={[styles.engineTypeText, { color: engineColor }]}>{vehicle.engineType}</Text>
        </View>
      </View>

      {/* Vehicle Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.infoRow}>
          <Ionicons name="calendar" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Año:</Text>
          <Text style={styles.infoValue}>{vehicle.year ?? "—"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="speedometer" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Kilometraje:</Text>
          <Text style={styles.infoValue}>
            {vehicle.kilometraje != null ? `${vehicle.kilometraje.toLocaleString("es-PY")} km` : "—"}
          </Text>
        </View>
        {vehicle.vin && (
          <View style={styles.infoRow}>
            <Ionicons name="finger-print" size={16} color={colors.textSecondary} />
            <Text style={styles.infoLabel}>VIN:</Text>
            <Text style={[styles.infoValue, styles.mono]}>{vehicle.vin}</Text>
          </View>
        )}
      </View>

      {/* Timestamps */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Registro</Text>
        <View style={styles.infoRow}>
          <Ionicons name="time" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Creado:</Text>
          <Text style={styles.infoValue}>{new Date(vehicle.createdAt).toLocaleDateString("es-PY")}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Actualizado:</Text>
          <Text style={styles.infoValue}>{new Date(vehicle.updatedAt).toLocaleDateString("es-PY")}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  engineBadge: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  headerInfo: { flex: 1 },
  name: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  plate: { fontSize: fontSize.md, color: colors.primary, fontWeight: "600", marginTop: spacing.xs },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  engineTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignSelf: "flex-start",
  },
  engineDot: { width: 8, height: 8, borderRadius: 4 },
  engineTypeText: { fontSize: fontSize.md, fontWeight: "600" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  mono: { fontFamily: "monospace" },
});
