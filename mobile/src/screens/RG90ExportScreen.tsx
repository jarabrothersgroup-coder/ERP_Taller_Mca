/**
 * RG90ExportScreen — RG 90 Marangatu VAT book export
 *
 * Lets users select a period and report type (Ventas/Compras/Retenciones),
 * preview the data, and trigger exports in JSON, TXT, or CSV formats.
 * Integrates with /finance/rg90/{ventas,compras,retenciones}/:anho/:mes APIs.
 */

import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { useRG90Report } from "../hooks/use-data";

type ReportType = "VENTAS" | "COMPRAS" | "RETENCIONES";
type ExportFormat = "JSON" | "TXT" | "CSV";

const REPORT_TYPES: Array<{ value: ReportType; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }> = [
  { value: "VENTAS", label: "Ventas", icon: "trending-up", desc: "Libro de Ventas IVA" },
  { value: "COMPRAS", label: "Compras", icon: "cart", desc: "Libro de Compras IVA" },
  { value: "RETENCIONES", label: "Retenciones", icon: "receipt", desc: "Libro de Retenciones" },
];

const FORMATS: Array<{ value: ExportFormat; label: string; desc: string }> = [
  { value: "JSON", label: "JSON", desc: "Formato estructurado" },
  { value: "TXT", label: "TXT", desc: "Texto plano SIFEN" },
  { value: "CSV", label: "CSV", desc: "Planilla (Excel)" },
];

/* ── Helpers ──────────────────────────────────── */

function buildMonthOptions(): Array<{ value: string; label: string }> {
  const options = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-PY", { month: "long", year: "numeric" }),
    });
  }
  return options;
}

function formatCurrency(amount: number): string {
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

/* ── Main Screen ──────────────────────────────── */

export default function RG90ExportScreen({ navigation }: any) {
  const [reportType, setReportType] = React.useState<ReportType>("VENTAS");
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [format, setFormat] = React.useState<ExportFormat>("JSON");

  const [year, month] = selectedMonth.split("-").map(Number);
  const { data: report, isLoading, error } = useRG90Report(reportType, year, month, format);

  const months = React.useMemo(buildMonthOptions, []);

  const handleExport = async () => {
    if (!report) return;

    try {
      const content = JSON.stringify(report, null, 2);
      const filename = `RG90_${reportType}_${selectedMonth}.${format.toLowerCase()}`;
      await Share.share({
        message: content,
        title: filename,
      });
    } catch (err) {
      console.warn("Export share failed:", err);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>RG 90 Marangatu</Text>
          <Text style={styles.subtitle}>Libros IVA - DNIT</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={styles.headerBadgeText}>Cumplimiento</Text>
        </View>
      </View>

      {/* Month selector */}
      <Text style={styles.label}>Período</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
        <View style={styles.monthRow}>
          {months.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[styles.monthChip, selectedMonth === m.value && styles.monthChipActive]}
              onPress={() => setSelectedMonth(m.value)}
            >
              <Text
                style={[styles.monthText, selectedMonth === m.value && styles.monthTextActive]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Report type selector */}
      <Text style={styles.label}>Tipo de Reporte</Text>
      <View style={styles.typeGrid}>
        {REPORT_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeCard, reportType === t.value && styles.typeCardActive]}
            onPress={() => setReportType(t.value)}
          >
            <View
              style={[
                styles.typeIcon,
                { backgroundColor: reportType === t.value ? colors.primary + "20" : colors.borderLight },
              ]}
            >
              <Ionicons
                name={t.icon}
                size={22}
                color={reportType === t.value ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text style={[styles.typeLabel, reportType === t.value && styles.typeLabelActive]}>
              {t.label}
            </Text>
            <Text style={styles.typeDesc}>{t.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Format selector */}
      <Text style={styles.label}>Formato de Exportación</Text>
      <View style={styles.formatRow}>
        {FORMATS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.formatChip, format === f.value && styles.formatChipActive]}
            onPress={() => setFormat(f.value)}
          >
            <Text style={[styles.formatText, format === f.value && styles.formatTextActive]}>
              {f.label}
            </Text>
            <Text style={[styles.formatDesc, format === f.value && styles.formatDescActive]}>
              {f.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Preview / Loading */}
      <View style={styles.previewSection}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Vista Previa</Text>
          {report && (
            <Text style={styles.previewCount}>{report.totalRegistros} registros</Text>
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando reporte...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.error} />
            <Text style={styles.errorText}>Error al cargar el reporte</Text>
            <Text style={styles.errorDesc}>
              Verifique la conexión y que existan datos para el período seleccionado.
            </Text>
          </View>
        ) : report ? (
          <View style={styles.previewCard}>
            {/* Totals */}
            {/* Summary */}
            <View style={styles.totalsBox}>
              <Text style={styles.totalsTitle}>Resumen del Período</Text>
              <View style={styles.totalItem}>
                <Text style={styles.totalItemLabel}>Total Registros</Text>
                <Text style={styles.totalItemValue}>{report.totalRegistros}</Text>
              </View>
              {report.totalVentas && (
                <View style={styles.totalItem}>
                  <Text style={styles.totalItemLabel}>Total Ventas</Text>
                  <Text style={styles.totalItemValue}>₲ {report.totalVentas}</Text>
                </View>
              )}
              <View style={styles.totalItem}>
                <Text style={styles.totalItemLabel}>Formato</Text>
                <Text style={styles.totalItemValue}>{report.formato}</Text>
              </View>
            </View>

            {/* Data rows preview (first 5) */}
            {report.entries && report.entries.length > 0 && (
              <View style={styles.dataPreview}>
                <Text style={styles.dataPreviewTitle}>
                  Primeros {Math.min(report.entries.length, 5)} registros
                </Text>
                {report.entries.slice(0, 5).map((row: any, i: number) => (
                  <View key={i} style={styles.dataRow}>
                    {Object.entries(row).slice(0, 4).map(([k, v]) => (
                      <View key={k} style={styles.dataCell}>
                        <Text style={styles.dataCellLabel}>{k}</Text>
                        <Text style={styles.dataCellValue} numberOfLines={1}>
                          {String(v ?? "—")}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="document-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Seleccione tipo y período para visualizar
            </Text>
          </View>
        )}
      </View>

      {/* Export button */}
      <TouchableOpacity
        style={[styles.exportBtn, !report && styles.exportBtnDisabled]}
        onPress={handleExport}
        disabled={!report}
      >
        <Ionicons name="download-outline" size={20} color={colors.textInverse} />
        <Text style={styles.exportBtnText}>
          Exportar Reporte ({format})
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ── Styles ───────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing.lg },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  title: { fontSize: fontSize.xxl, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  headerBadgeText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.primary },

  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.sm,
  },

  /* Month selector */
  monthScroll: { marginBottom: spacing.lg },
  monthRow: { flexDirection: "row", gap: spacing.sm },
  monthChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: "500" },
  monthTextActive: { color: colors.textInverse, fontWeight: "600" },

  /* Type selector */
  typeGrid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  typeCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight + "40" },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  typeLabel: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  typeLabelActive: { color: colors.primary },
  typeDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2, textAlign: "center" },

  /* Format selector */
  formatRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  formatChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formatChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  formatText: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  formatTextActive: { color: colors.primary },
  formatDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  formatDescActive: { color: colors.primary },

  /* Preview */
  previewSection: { marginBottom: spacing.xl },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  previewTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  previewCount: { fontSize: fontSize.xs, color: colors.textMuted },

  previewCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  /* Totals */
  totalsBox: {
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  totalsTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  totalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalItemLabel: { fontSize: fontSize.xs, color: colors.textSecondary, flex: 1 },
  totalItemValue: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text },

  /* Data preview */
  dataPreview: {},
  dataPreviewTitle: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.sm },
  dataRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dataCell: { flex: 1 },
  dataCellLabel: { fontSize: 9, color: colors.textMuted, textTransform: "uppercase" },
  dataCellValue: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },

  /* Loading */
  loadingBox: { alignItems: "center", paddingVertical: spacing.xxl },
  loadingText: { marginTop: spacing.sm, fontSize: fontSize.sm, color: colors.textSecondary, fontStyle: "italic" },

  /* Error */
  errorBox: { alignItems: "center", paddingVertical: spacing.xl },
  errorText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.error, marginTop: spacing.sm },
  errorDesc: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },

  /* Empty */
  emptyBox: { alignItems: "center", paddingVertical: spacing.xl },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" },

  /* Export button */
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { fontSize: fontSize.md, fontWeight: "600", color: colors.textInverse },
});
