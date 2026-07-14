/**
 * Client detail screen — shows client info and related vehicles.
 */

import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { useClient, useVehicles } from "../hooks/use-data";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorView from "../components/ErrorView";

export default function ClientDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { data: client, isLoading, error, refetch } = useClient(id);
  const { data: allVehicles = [] } = useVehicles();

  const clientVehicles = React.useMemo(
    () => allVehicles.filter((v) => v.clientId === id),
    [allVehicles, id]
  );

  React.useEffect(() => {
    navigation.setOptions({ title: client?.name ?? "Cliente" });
  }, [navigation, client]);

  if (isLoading) return <LoadingSpinner message="Cargando cliente..." />;
  if (error || !client) return <ErrorView message="No se pudo cargar el cliente" onRetry={refetch} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Client Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {client.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{client.name}</Text>
          {client.ruc && <Text style={styles.ruc}>RUC: {client.ruc}</Text>}
        </View>
      </View>

      {/* Contact Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contacto</Text>
        {client.email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={16} color={colors.primary} />
            <Text style={styles.infoValue}>{client.email}</Text>
          </View>
        )}
        {client.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call" size={16} color={colors.primary} />
            <Text style={styles.infoValue}>{client.phone}</Text>
          </View>
        )}
        {client.address && (
          <View style={styles.infoRow}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={styles.infoValue}>{client.address}</Text>
          </View>
        )}
      </View>

      {/* Notes */}
      {client.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notas</Text>
          <Text style={styles.notes}>{client.notes}</Text>
        </View>
      )}

      {/* Client Vehicles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehículos ({clientVehicles.length})</Text>
        {clientVehicles.length === 0 ? (
          <Text style={styles.emptyText}>Sin vehículos registrados</Text>
        ) : (
          clientVehicles.map((vehicle) => (
            <View key={vehicle.id} style={styles.vehicleCard}>
              <View style={[styles.engineIndicator, { backgroundColor: colors.primary }]} />
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName}>
                  {vehicle.brand} {vehicle.model}
                </Text>
                <Text style={styles.vehicleMeta}>
                  {vehicle.plate ?? "—"} · {vehicle.year ?? "—"} · {vehicle.engineType}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Timestamps */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Registro</Text>
        <View style={styles.infoRow}>
          <Ionicons name="calendar" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Creado:</Text>
          <Text style={styles.infoValue}>{new Date(client.createdAt).toLocaleDateString("es-PY")}</Text>
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
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: { color: colors.textInverse, fontWeight: "700", fontSize: fontSize.lg },
  headerInfo: { flex: 1 },
  name: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  ruc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
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
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  notes: { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: "italic" },
  vehicleCard: {
    flexDirection: "row",
    backgroundColor: colors.backgroundMuted,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  engineIndicator: { width: 4 },
  vehicleInfo: { flex: 1, padding: spacing.md },
  vehicleName: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  vehicleMeta: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
});
