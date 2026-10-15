/**
 * FirmaRetiroScreen — firma de retira del cliente al entregar la OT.
 *
 * Resuelve el último ingreso del vehículo (GET /workshop/ingresos?vehicleId,
 * ordenado DESC por el backend) y guarda en POST /workshop/ingresos/:id/firma-retiro.
 */

import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { api } from "../api/client";
import SignaturePad from "../components/SignaturePad";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorView from "../components/ErrorView";

export default function FirmaRetiroScreen({ route, navigation }: any) {
  const { vehicleId } = route.params as { vehicleId: string };

  const [nombre, setNombre] = React.useState("");
  const [firma, setFirma] = React.useState("");

  const {
    data: ingresos,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["ingresos-vehicle", vehicleId],
    queryFn: () => api.listIngresosByVehicle(vehicleId),
    enabled: !!vehicleId,
    retry: false,
  });

  const ingreso = ingresos?.[0];

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!ingreso) throw new Error("Sin ingreso de recepción");
      return api.saveFirmaRetiro(ingreso.id, firma, nombre);
    },
    onSuccess: () => {
      Alert.alert("Firma guardada", "La firma de retiro quedó registrada.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  if (isLoading) return <LoadingSpinner message="Buscando ingreso del vehículo..." />;
  if (isError)
    return <ErrorView message={error instanceof Error ? error.message : "No se pudo cargar"} onRetry={refetch} />;

  if (!ingreso) {
    return (
      <View style={styles.empty}>
        <Ionicons name="car-outline" size={40} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sin ingreso de recepción</Text>
        <Text style={styles.emptyText}>
          Este vehículo no tiene un ingreso registrado; genera el checklist de recepción primero.
        </Text>
      </View>
    );
  }

  const canSave = nombre.trim().length > 0 && firma.length > 0 && !saveMutation.isPending;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <View style={styles.ingresoRow}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text style={styles.ingresoText}>
            Ingreso {ingreso.id.slice(0, 8).toUpperCase()} ·{" "}
            {new Date(ingreso.fechaIngreso).toLocaleDateString("es-PY")}
          </Text>
        </View>
        <Text style={styles.hint}>
          El cliente firma para confirmar la entrega del vehículo.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre completo del cliente"
          placeholderTextColor={colors.textMuted}
          value={nombre}
          onChangeText={setNombre}
        />
        <SignaturePad value={firma} onChange={setFirma} />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, !canSave && { opacity: 0.5 }]}
        onPress={() => saveMutation.mutate()}
        disabled={!canSave}
      >
        <Ionicons name="checkmark-circle" size={16} color={colors.textInverse} />
        <Text style={styles.saveButtonText}>
          {saveMutation.isPending ? "Guardando…" : "Registrar firma de retiro"}
        </Text>
      </TouchableOpacity>
      {!nombre.trim() && (
        <Text style={styles.validation}>Ingresa el nombre del cliente.</Text>
      )}
      {!firma && <Text style={styles.validation}>Captura la firma con el dedo.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing.md },
  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingresoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  ingresoText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  hint: { fontSize: fontSize.xs, color: colors.textMuted, marginVertical: spacing.sm },
  input: {
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
  },
  saveButtonText: { color: colors.textInverse, fontSize: fontSize.sm, fontWeight: "600" },
  validation: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.backgroundMuted,
  },
  emptyTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" },
});
