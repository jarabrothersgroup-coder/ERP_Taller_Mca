/**
 * RecepcionChecklistScreen — checklist visual de recepción en 3 pasos.
 *
 * Pasos: Exterior (paneles) → Detalles (neumáticos/combustible/accesorios)
 * → Firma del cliente. Guarda en POST /workshop/ingresos/:id/checklist y
 * puede disparar la impresión de la etiqueta QR del ingreso.
 */

import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Print from "expo-print";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { api, type PanelState, type RecepcionChecklist } from "../api/client";
import SignaturePad from "../components/SignaturePad";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorView from "../components/ErrorView";

const PANEL_LABELS: Record<string, string> = {
  capot: "Capot",
  paragolpesDel: "Paragolpes Delantero",
  paragolpesTras: "Paragolpes Trasero",
  puertaDelIzq: "Puerta Del. Izq.",
  puertaDelDer: "Puerta Del. Der.",
  puertaTrasIzq: "Puerta Tras. Izq.",
  puertaTrasDer: "Puerta Tras. Der.",
  maletero: "Maletero",
  techo: "Techo",
  espejoIzq: "Espejo Izq.",
  espejoDer: "Espejo Der.",
};

type Estado = PanelState["estado"];

const ESTADOS: Estado[] = ["BUENO", "RAYADO", "ABOLLADO", "ROTO", "ABOLLADO_RAYADO"];

const ESTADO_COLORS: Record<Estado, string> = {
  BUENO: colors.success,
  RAYADO: colors.info,
  ABOLLADO: colors.warning,
  ROTO: colors.error,
  ABOLLADO_RAYADO: "#8b5cf6",
};

const ESTADO_LABELS: Record<Estado, string> = {
  BUENO: "Bueno",
  RAYADO: "Rayado",
  ABOLLADO: "Abollado",
  ROTO: "Roto",
  ABOLLADO_RAYADO: "Abollado+Rayado",
};

const COMBUSTIBLE_PRESETS = [0, 0.25, 0.5, 0.75, 1];

const STEPS = ["Exterior", "Detalles", "Firma"];

function initialPanels(): Record<string, PanelState> {
  const out: Record<string, PanelState> = {};
  Object.keys(PANEL_LABELS).forEach((k) => {
    out[k] = { estado: "BUENO" };
  });
  return out;
}

export default function RecepcionChecklistScreen({ route, navigation }: any) {
  const { ingresoId } = route.params as { ingresoId: string };

  const [step, setStep] = React.useState(0);
  const [panels, setPanels] = React.useState<Record<string, PanelState>>(initialPanels);
  const [neumaticos, setNeumaticos] = React.useState({
    delIzq: "",
    delDer: "",
    trasIzq: "",
    trasDer: "",
    repuesto: "",
  });
  const [nivel, setNivel] = React.useState(0.5);
  const [kilometrajeFoto, setKilometrajeFoto] = React.useState(false);
  const [accesorios, setAccesorios] = React.useState({
    gato: false,
    triangulos: false,
    extintor: false,
    ruedaRepuesto: false,
    herramientas: false,
    manual: false,
  });
  const [radioCodigo, setRadioCodigo] = React.useState("");
  const [otros, setOtros] = React.useState("");
  const [obs, setObs] = React.useState("");
  const [firma, setFirma] = React.useState("");
  const [firmaNombre, setFirmaNombre] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);

  const hydratedRef = React.useRef(false);

  const {
    data: existing,
    isLoading,
    isError,
    refetch,
  } = useQuery<RecepcionChecklist | null, Error>({
    queryKey: ["ingreso-checklist", ingresoId],
    queryFn: async () => {
      try {
        return await api.getIngresoChecklist(ingresoId);
      } catch (e) {
        if (e instanceof Error && e.message.includes("no encontrado")) return null;
        throw e;
      }
    },
    enabled: !!ingresoId,
    retry: false,
  });

  // Hidratación única desde un checklist existente (evita pisar lo cargado).
  React.useEffect(() => {
    if (hydratedRef.current || existing === undefined) return;
    hydratedRef.current = true;
    if (existing) {
      setPanels({ ...initialPanels(), ...existing.panels });
      setNeumaticos((prev) => ({ ...prev, ...existing.neumaticos }));
      setNivel(existing.nivelCombustibleExacto ?? 0.5);
      setKilometrajeFoto(existing.kilometrajeFoto ?? false);
      if (existing.accesorios) {
        setAccesorios(() => ({
          gato: !!existing.accesorios.gato,
          triangulos: !!existing.accesorios.triangulos,
          extintor: !!existing.accesorios.extintor,
          ruedaRepuesto: !!existing.accesorios.ruedaRepuesto,
          herramientas: !!existing.accesorios.herramientas,
          manual: !!existing.accesorios.manual,
        }));
        setRadioCodigo(existing.accesorios.radioCodigo ?? "");
        setOtros(existing.accesorios.otros ?? "");
      }
      setObs(existing.observacionesCliente ?? "");
      setFirma(existing.firmaCliente ?? "");
      setFirmaNombre(existing.firmaClienteNombre ?? "");
      setSaved(true);
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.saveIngresoChecklist(ingresoId, {
        panels,
        neumaticos,
        nivelCombustibleExacto: nivel,
        kilometrajeFoto,
        accesorios: {
          ...accesorios,
          ...(radioCodigo ? { radioCodigo } : {}),
          ...(otros ? { otros } : {}),
        },
        observacionesCliente: obs || undefined,
        firmaCliente: firma || undefined,
        firmaClienteNombre: firmaNombre || undefined,
      }),
    onSuccess: () => {
      setSaved(true);
      Alert.alert("Checklist guardado", "La recepción quedó registrada.", [
        { text: "Cerrar", style: "cancel", onPress: () => navigation.goBack() },
        { text: "Imprimir etiqueta", onPress: () => void handlePrintQR() },
      ]);
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  const handlePrintQR = async () => {
    try {
      setPrinting(true);
      const qr = await api.fetchIngresoQR(ingresoId);
      await Print.printAsync({
        html: `<!doctype html><html><head><meta charset="utf-8"/></head><body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh"><img src="${qr}" alt="QR ingreso" style="width:280px;height:280px"/></body></html>`,
      });
    } catch (e) {
      Alert.alert("Impresión", e instanceof Error ? e.message : "No se pudo imprimir");
    } finally {
      setPrinting(false);
    }
  };

  const cyclePanel = (key: string) => {
    setPanels((prev) => {
      const current = prev[key]?.estado ?? "BUENO";
      const next = ESTADOS[(ESTADOS.indexOf(current) + 1) % ESTADOS.length];
      return { ...prev, [key]: { ...prev[key], estado: next } };
    });
    setSaved(false);
  };

  if (isLoading) return <LoadingSpinner message="Cargando checklist..." />;
  if (isError) return <ErrorView message="No se pudo cargar el checklist" onRetry={refetch} />;

  const problemas = Object.values(panels).filter((p) => p.estado !== "BUENO").length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Steps indicator */}
      <View style={styles.stepsRow}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor:
                    i < step ? colors.success : i === step ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.stepDotText,
                  { color: i <= step ? colors.textInverse : colors.textMuted },
                ]}
              >
                {i + 1}
              </Text>
            </View>
            <Text
              style={[styles.stepLabel, { color: i === step ? colors.text : colors.textMuted }]}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* ── STEP 1: Exterior ── */}
      {step === 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de paneles</Text>
          <View style={styles.legend}>
            {ESTADOS.map((e) => (
              <View key={e} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: ESTADO_COLORS[e] }]} />
                <Text style={styles.legendText}>{ESTADO_LABELS[e]}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.hint}>Toca cada panel para cambiar su estado.</Text>
          {Object.keys(PANEL_LABELS).map((key) => {
            const estado = panels[key]?.estado ?? "BUENO";
            return (
              <TouchableOpacity
                key={key}
                style={styles.panelRow}
                onPress={() => cyclePanel(key)}
                activeOpacity={0.7}
              >
                <Text style={styles.panelLabel}>{PANEL_LABELS[key]}</Text>
                <View style={[styles.panelChip, { backgroundColor: ESTADO_COLORS[estado] + "20" }]}>
                  <View style={[styles.legendDot, { backgroundColor: ESTADO_COLORS[estado] }]} />
                  <Text style={[styles.panelChipText, { color: ESTADO_COLORS[estado] }]}>
                    {ESTADO_LABELS[estado]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {problemas > 0 && (
            <View style={styles.warnRow}>
              <Ionicons name="alert-circle" size={16} color={colors.warning} />
              <Text style={styles.warnText}>
                {problemas} panel{problemas > 1 ? "s" : ""} con daños detectados
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── STEP 2: Detalles ── */}
      {step === 1 && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Neumáticos</Text>
            {(
              [
                ["delIzq", "Delantero Izquierdo"],
                ["delDer", "Delantero Derecho"],
                ["trasIzq", "Trasero Izquierdo"],
                ["trasDer", "Trasero Derecho"],
                ["repuesto", "Repuesto"],
              ] as const
            ).map(([key, label]) => (
              <TextInput
                key={key}
                style={styles.input}
                placeholder={label}
                placeholderTextColor={colors.textMuted}
                value={(neumaticos as Record<string, string>)[key]}
                onChangeText={(v) => {
                  setNeumaticos((prev) => ({ ...prev, [key]: v }));
                  setSaved(false);
                }}
              />
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nivel de combustible</Text>
            <View style={styles.presetRow}>
              {COMBUSTIBLE_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.presetButton,
                    {
                      backgroundColor:
                        nivel === p ? colors.primary : colors.backgroundMuted,
                      borderColor: nivel === p ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setNivel(p);
                    setSaved(false);
                  }}
                >
                  <Text
                    style={[
                      styles.presetText,
                      { color: nivel === p ? colors.textInverse : colors.textSecondary },
                    ]}
                  >
                    {Math.round(p * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Foto de kilometraje adjunta</Text>
              <Switch
                value={kilometrajeFoto}
                onValueChange={(v) => {
                  setKilometrajeFoto(v);
                  setSaved(false);
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accesorios</Text>
            {(
              [
                ["gato", "Gato"],
                ["triangulos", "Triángulos"],
                ["extintor", "Extintor"],
                ["ruedaRepuesto", "Rueda de repuesto"],
                ["herramientas", "Herramientas"],
                ["manual", "Manual del usuario"],
              ] as const
            ).map(([key, label]) => (
              <View key={key} style={styles.switchRow}>
                <Text style={styles.switchLabel}>{label}</Text>
                <Switch
                  value={accesorios[key]}
                  onValueChange={(v) => {
                    setAccesorios((prev) => ({ ...prev, [key]: v }));
                    setSaved(false);
                  }}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
            ))}
            <TextInput
              style={styles.input}
              placeholder="Código de radio (opcional)"
              placeholderTextColor={colors.textMuted}
              value={radioCodigo}
              onChangeText={(v) => {
                setRadioCodigo(v);
                setSaved(false);
              }}
            />
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Otros accesorios / observaciones (opcional)"
              placeholderTextColor={colors.textMuted}
              multiline
              value={otros}
              onChangeText={(v) => {
                setOtros(v);
                setSaved(false);
              }}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observaciones del cliente</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Notas generales de recepción…"
              placeholderTextColor={colors.textMuted}
              multiline
              value={obs}
              onChangeText={(v) => {
                setObs(v);
                setSaved(false);
              }}
            />
          </View>
        </>
      )}

      {/* ── STEP 3: Firma ── */}
      {step === 2 && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Firma del cliente</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              placeholderTextColor={colors.textMuted}
              value={firmaNombre}
              onChangeText={(v) => {
                setFirmaNombre(v);
                setSaved(false);
              }}
            />
            <SignaturePad
              value={firma}
              onChange={(v) => {
                setFirma(v);
                setSaved(false);
              }}
            />
            {firma && (
              <View style={styles.okRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.okText}>Firma capturada correctamente</Text>
              </View>
            )}
          </View>

          {/* Resumen */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumen</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paneles con daños</Text>
              <Text style={styles.summaryValue}>{problemas}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Combustible</Text>
              <Text style={styles.summaryValue}>{Math.round(nivel * 100)}%</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Cliente</Text>
              <Text style={styles.summaryValue}>{firmaNombre || "—"}</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, saveMutation.isPending && { opacity: 0.6 }]}
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Ionicons name="save" size={16} color={colors.textInverse} />
              <Text style={styles.primaryButtonText}>
                {saveMutation.isPending ? "Guardando…" : saved ? "Actualizar checklist" : "Guardar checklist"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, printing && { opacity: 0.6 }]}
              onPress={() => void handlePrintQR()}
              disabled={printing}
            >
              <Ionicons name="print" size={16} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>
                {printing ? "Preparando impresión…" : "Imprimir etiqueta QR"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Navegación ── */}
      <View style={styles.navRow}>
        {step > 0 && (
          <TouchableOpacity style={styles.navButton} onPress={() => setStep((s) => s - 1)}>
            <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
            <Text style={styles.navButtonText}>Atrás</Text>
          </TouchableOpacity>
        )}
        {step < STEPS.length - 1 && (
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonPrimary]}
            onPress={() => setStep((s) => s + 1)}
          >
            <Text style={[styles.navButtonText, { color: colors.textInverse }]}>Siguiente</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.textInverse} />
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { fontSize: fontSize.xs, fontWeight: "700" },
  stepLabel: { fontSize: fontSize.xs, fontWeight: "600" },
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
  hint: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fontSize.xs, color: colors.textSecondary },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelLabel: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  panelChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  panelChipText: { fontSize: fontSize.xs, fontWeight: "600" },
  warnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.warning + "15",
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  warnText: { fontSize: fontSize.xs, color: colors.text, flex: 1 },
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
  textarea: { minHeight: 80, textAlignVertical: "top" },
  presetRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  presetButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
  },
  presetText: { fontSize: fontSize.xs, fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  switchLabel: { fontSize: fontSize.sm, color: colors.text, flex: 1 },
  okRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  okText: { fontSize: fontSize.xs, color: colors.success },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  summaryValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: "600" },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  primaryButtonText: { color: colors.textInverse, fontSize: fontSize.sm, fontWeight: "600" },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryButtonText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "600" },
  navRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flex: 1,
  },
  navButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  navButtonText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
});
