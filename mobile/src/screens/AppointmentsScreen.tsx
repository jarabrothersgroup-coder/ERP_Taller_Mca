/**
 * Appointments screen — calendar-style list
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
import { useAppointments } from "../hooks/use-data";
import type { Appointment } from "../api/client";
import { FadeInView, AnimatedEmptyState, LoadingSpinner } from "../components/AnimatedComponents";

const estadoConfig: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  PROGRAMADO: { label: "Programado", color: colors.info, icon: "time" },
  EN_CURSO: { label: "En Curso", color: colors.primary, icon: "play" },
  COMPLETADO: { label: "Completado", color: colors.success, icon: "checkmark-circle" },
  CANCELADO: { label: "Cancelado", color: colors.error, icon: "close-circle" },
  NO_SHOW: { label: "No Show", color: colors.textMuted, icon: "alert-circle" },
};

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const config = estadoConfig[appointment.estado] ?? { label: appointment.estado, color: colors.textSecondary, icon: "help-circle" };

  return (
    <View style={styles.card}>
      <View style={styles.cardTime}>
        <Text style={styles.timeText}>{appointment.horaInicio}</Text>
        <Text style={styles.timeEnd}>{appointment.horaFin}</Text>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardClient}>{appointment.clienteNombre}</Text>
          <View style={[styles.badge, { backgroundColor: config.color + "20" }]}>
            <Ionicons name={config.icon} size={10} color={config.color} />
            <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>

        <Text style={styles.cardVehicle}>
          {appointment.vehiculoMarca} {appointment.vehiculoModelo} — {appointment.vehiculoChapa}
        </Text>
        <Text style={styles.cardService}>{appointment.tipoServicio}</Text>

        {appointment.notas && (
          <Text style={styles.cardNotes} numberOfLines={1}>{appointment.notas}</Text>
        )}
      </View>
    </View>
  );
}

export default function AppointmentsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data: appointments = [], isLoading, refetch } = useAppointments();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Sort by date+time ascending
  const sorted = React.useMemo(
    () =>
      [...appointments].sort((a, b) => {
        const da = `${a.fecha}T${a.horaInicio}`;
        const db = `${b.fecha}T${b.horaInicio}`;
        return da.localeCompare(db);
      }),
    [appointments]
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item, index }) => (
          <FadeInView delay={index * 60}>
            <AppointmentCard appointment={item} />
          </FadeInView>
        )}
        ListEmptyComponent={
          isLoading ? (
            <LoadingSpinner message="Cargando turnos..." />
          ) : (
            <AnimatedEmptyState
              icon="calendar-outline"
              title="No hay turnos agendados"
              subtitle="Agende un turno desde el menú de agenda"
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  list: { padding: spacing.md },
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardTime: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    backgroundColor: colors.backgroundMuted,
  },
  timeText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
  timeEnd: { fontSize: fontSize.xs, color: colors.textMuted },
  cardDivider: { width: 1, backgroundColor: colors.border },
  cardContent: { flex: 1, padding: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  cardClient: { fontSize: fontSize.md, fontWeight: "600", color: colors.text, flex: 1 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, gap: 3 },
  badgeText: { fontSize: fontSize.xs, fontWeight: "600" },
  cardVehicle: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardService: { fontSize: fontSize.xs, color: colors.primary, fontWeight: "500", marginTop: 2 },
  cardNotes: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs, fontStyle: "italic" },
});
