/**
 * Work Order detail screen — shows full work order info with status update.
 */

import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { useWorkOrder, useUpdateWorkOrderStatus, useSignHvLockout } from "../hooks/use-data";
import { useAuth } from "../auth/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorView from "../components/ErrorView";

const statusConfig: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  PENDIENTE: { label: "Pendiente", color: colors.warning, icon: "time" },
  EN_PROGRESO: { label: "En Progreso", color: colors.primary, icon: "play" },
  COMPLETADA: { label: "Completada", color: colors.success, icon: "checkmark-circle" },
  CERRADA: { label: "Cerrada", color: colors.textMuted, icon: "lock-closed" },
};

const nextStatus: Record<string, string> = {
  PENDIENTE: "EN_PROGRESO",
  EN_PROGRESO: "COMPLETADA",
  COMPLETADA: "CERRADA",
};

export default function WorkOrderDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { session } = useAuth();
  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);
  const updateStatus = useUpdateWorkOrderStatus();
  const signHv = useSignHvLockout();

  React.useEffect(() => {
    navigation.setOptions({ title: `OT-${id.slice(0, 8).toUpperCase()}` });
  }, [navigation, id]);

  const handleStatusUpdate = () => {
    if (!workOrder) return;
    const next = nextStatus[workOrder.status];
    if (!next) return;

    const config = statusConfig[next];
    Alert.alert(
      "Actualizar Estado",
      `¿Cambiar estado a "${config.label}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => updateStatus.mutate({ id, status: next }),
        },
      ]
    );
  };

  const handleSignHv = () => {
    if (!workOrder || !session) return;
    Alert.alert(
      "Firma de Lockout HV",
      "Confirmo la desconexión de alto voltaje del vehículo (Ley 1034/83).",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Firmar",
          onPress: () => signHv.mutate({ id, mechanicId: session.email }),
        },
      ]
    );
  };

  if (isLoading) return <LoadingSpinner message="Cargando orden..." />;
  if (error || !workOrder) return <ErrorView message="No se pudo cargar la orden" onRetry={refetch} />;

  const config = statusConfig[workOrder.status] ?? { label: workOrder.status, color: colors.textSecondary, icon: "help-circle" };
  const next = nextStatus[workOrder.status];
  const nextConfig = next ? statusConfig[next] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status Header */}
      <View style={[styles.statusHeader, { backgroundColor: config.color + "15" }]}>
        <View style={[styles.statusBadge, { backgroundColor: config.color + "25" }]}>
          <Ionicons name={config.icon} size={16} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
        {nextConfig && (
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: nextConfig.color }]}
            onPress={handleStatusUpdate}
            disabled={updateStatus.isPending}
          >
            <Ionicons name="arrow-forward" size={14} color={colors.textInverse} />
            <Text style={styles.updateButtonText}>
              {updateStatus.isPending ? "Actualizando..." : `Marcar ${nextConfig.label}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Description */}
      {workOrder.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{workOrder.description}</Text>
        </View>
      )}

      {/* Vehicle & Client Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.infoRow}>
          <Ionicons name="car" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Vehículo:</Text>
          <Text style={styles.infoValue}>{workOrder.vehiculo ?? "—"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="pricetag" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Placa:</Text>
          <Text style={styles.infoValue}>{workOrder.plate ?? "—"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="person" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Cliente:</Text>
          <Text style={styles.infoValue}>{workOrder.cliente ?? "—"}</Text>
        </View>
      </View>

      {/* HV Alert */}
      {workOrder.hvAlert && (
        <View style={[styles.section, styles.alertSection]}>
          <Ionicons name="warning" size={20} color={colors.error} />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>Alerta de Alto Voltaje</Text>
            <Text style={styles.alertText}>
              {workOrder.hvLockoutSigned ? "Lockout firmado ✓" : "Lockout pendiente"}
            </Text>
            {workOrder.hvAlert && !workOrder.hvLockoutSigned && (
              <TouchableOpacity
                style={[styles.hvSignButton, { backgroundColor: colors.error }]}
                onPress={handleSignHv}
                disabled={signHv.isPending}
              >
                <Ionicons name="shield-checkmark" size={14} color={colors.textInverse} />
                <Text style={styles.hvSignButtonText}>
                  {signHv.isPending ? "Firmando..." : "Firmar Lockout HV"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* DTC Codes */}
      {workOrder.dtcCodes && workOrder.dtcCodes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Códigos DTC</Text>
          <View style={styles.dtcContainer}>
            {workOrder.dtcCodes.map((code, index) => (
              <View key={index} style={styles.dtcBadge}>
                <Text style={styles.dtcText}>{code}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Timestamps */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fechas</Text>
        <View style={styles.infoRow}>
          <Ionicons name="calendar" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Creada:</Text>
          <Text style={styles.infoValue}>{new Date(workOrder.createdAt).toLocaleDateString("es-PY")}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time" size={16} color={colors.textSecondary} />
          <Text style={styles.infoLabel}>Actualizada:</Text>
          <Text style={styles.infoValue}>{new Date(workOrder.updatedAt).toLocaleDateString("es-PY")}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing.md },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  statusText: { fontSize: fontSize.sm, fontWeight: "600" },
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  updateButtonText: { color: colors.textInverse, fontSize: fontSize.xs, fontWeight: "600" },
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
  description: { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  alertSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error + "10",
    borderColor: colors.error + "30",
  },
  alertContent: { flex: 1, marginLeft: spacing.md },
  alertTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.error },
  alertText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  hvSignButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignSelf: "flex-start",
  },
  hvSignButtonText: { color: colors.textInverse, fontSize: fontSize.xs, fontWeight: "600" },
  dtcContainer: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  dtcBadge: {
    backgroundColor: colors.warning + "20",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  dtcText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.warning, fontFamily: "monospace" },
});
