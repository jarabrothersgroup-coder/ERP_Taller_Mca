/**
 * AccountingScreen — Balance General + Estado Resultados
 *
 * Mobile viewer for the double-entry accounting reports.
 * Renders structured data from /finance/contabilidad/{balance-general,estado-resultados}.
 *
 * Data shapes (from backend):
 *   BalanceGeneral → { activo/pasivo/patrimonio: BalanceSeccion }
 *   BalanceSeccion → { tipo, label, total, grupos[], cuentasDirectas[] }
 *   BalanceGrupo   → { codigo, nombre, nivel, saldo, subcuentas[] }
 *
 *   EstadoResultados → { ingresos/costos/gastos: PnLSeccion }
 *   PnLSeccion → { total, grupos[], cuentas[] }
 *   utilidadBruta, utilidadNeta
 */

import * as React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { useBalanceGeneral, useEstadoResultados } from "../hooks/use-data";
import type { BalanceSeccion, BalanceGrupo, PnLSeccion } from "../api/client";

type ReportTab = "balance" | "resultados";

/* ── Helpers ──────────────────────────────────── */

function formatCurrency(amount: number): string {
  return `₲ ${amount.toLocaleString("es-PY")}`;
}

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

/* ── Balance General ──────────────────────────── */

function BalanceGeneralView({ data }: { data: any }) {
  return (
    <View>
      <SeccionCard
        seccion={data.activo}
        icon="trending-up"
        iconColor={colors.success}
        title="Activo"
      />
      <SeccionCard
        seccion={data.pasivo}
        icon="arrow-down"
        iconColor={colors.warning}
        title="Pasivo"
      />
      <SeccionCard
        seccion={data.patrimonio}
        icon="shield-checkmark"
        iconColor={colors.info}
        title="Patrimonio"
      />
      <View style={styles.totalSeccion}>
        <View style={styles.totalSeccionRow}>
          <Text style={styles.totalSeccionLabel}>Total Activo</Text>
          <Text style={styles.totalSeccionValue}>{formatCurrency(data.totalActivo)}</Text>
        </View>
        <View style={styles.totalSeccionRow}>
          <Text style={styles.totalSeccionLabel}>Total Pasivo + Patrimonio</Text>
          <Text style={styles.totalSeccionValue}>{formatCurrency(data.totalPasivoPatrimonio)}</Text>
        </View>
      </View>

      <View
        style={[
          styles.balanceBadge,
          {
            backgroundColor: data.balanceado ? colors.success + "15" : colors.error + "15",
            borderColor: data.balanceado ? colors.success : colors.error,
          },
        ]}
      >
        <Ionicons
          name={data.balanceado ? "checkmark-circle" : "close-circle"}
          size={20}
          color={data.balanceado ? colors.success : colors.error}
        />
        <Text
          style={[
            styles.balanceText,
            { color: data.balanceado ? colors.success : colors.error },
          ]}
        >
          {data.balanceado
            ? "✓ Balanceado"
            : `Diferencia: ${formatCurrency(data.diferencia)}`}
        </Text>
      </View>
    </View>
  );
}

function SeccionCard({
  seccion,
  icon,
  iconColor,
  title,
}: {
  seccion: BalanceSeccion;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
}) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: iconColor + "15" }]}>
            <Ionicons name={icon} size={16} color={iconColor} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionTotal}>{formatCurrency(seccion.total)}</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sectionBody}>
          {/* Groups */}
          {seccion.grupos?.map((grupo) => (
            <GrupoRow key={grupo.codigo} grupo={grupo} />
          ))}

          {/* Direct accounts (level 4+) */}
          {seccion.cuentasDirectas?.length > 0 && (
            <View style={styles.directAccounts}>
              <Text style={styles.directAccountsLabel}>Cuentas Directas</Text>
              {seccion.cuentasDirectas.map((cuenta) => (
                <View key={cuenta.cuentaId} style={styles.cuentaRow}>
                  <View style={styles.cuentaInfo}>
                    <Text style={styles.cuentaCodigo}>{cuenta.codigo}</Text>
                    <Text style={styles.cuentaNombre}>{cuenta.nombre}</Text>
                  </View>
                  <Text style={styles.cuentaSaldo}>
                    {formatCurrency(cuenta.saldoActual)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function GrupoRow({ grupo }: { grupo: BalanceGrupo }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <View style={styles.grupoContainer}>
      <TouchableOpacity
        style={styles.grupoHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.grupoInfo}>
          <Ionicons
            name={expanded ? "folder-open" : "folder"}
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.grupoNombre}>{grupo.nombre}</Text>
        </View>
        <View style={styles.grupoRight}>
          <Text style={styles.grupoSaldo}>{formatCurrency(grupo.saldo)}</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {expanded && grupo.subcuentas?.length > 0 && (
        <View style={styles.subcuentas}>
          {grupo.subcuentas.map((sub) => (
            <View key={sub.cuentaId} style={styles.cuentaRow}>
              <View style={styles.cuentaInfo}>
                <Text style={styles.cuentaCodigo}>{sub.codigo}</Text>
                <Text style={styles.cuentaNombre}>{sub.nombre}</Text>
              </View>
              <Text style={styles.cuentaSaldo}>
                {formatCurrency(sub.saldoActual)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ── Estado Resultados ────────────────────────── */

function EstadoResultadosView({ data }: { data: any }) {
  const profitColor = (val: number) => (val >= 0 ? colors.success : colors.error);

  return (
    <View>
      <PnLSeccionCard
        seccion={data.ingresos}
        icon="trending-up"
        iconColor={colors.success}
        title="Ingresos"
      />

      <PnLSeccionCard
        seccion={data.costos}
        icon="remove-circle"
        iconColor={colors.warning}
        title="Costos"
      />

      {/* Utilidad Bruta */}
      {data.utilidadBruta !== undefined && (
        <View style={[styles.highlightRow, { borderLeftColor: profitColor(data.utilidadBruta) }]}>
          <View>
            <Text style={styles.highlightLabel}>Utilidad Bruta</Text>
            <Text style={styles.highlightSub}>Ingresos - Costos</Text>
          </View>
          <Text style={[styles.highlightValue, { color: profitColor(data.utilidadBruta) }]}>
            {formatCurrency(data.utilidadBruta)}
          </Text>
        </View>
      )}

      <PnLSeccionCard
        seccion={data.gastos}
        icon="trending-down"
        iconColor={colors.error}
        title="Gastos"
      />

      {/* Utilidad Neta */}
      {data.utilidadNeta !== undefined && (
        <View
          style={[
            styles.highlightRow,
            {
              borderLeftColor: profitColor(data.utilidadNeta),
              backgroundColor: colors.primary + "08",
            },
          ]}
        >
          <View>
            <Text style={styles.highlightLabel}>Utilidad Neta</Text>
            <Text style={styles.highlightSub}>Resultado del período</Text>
          </View>
          <Text style={[styles.highlightValue, { color: profitColor(data.utilidadNeta) }]}>
            {formatCurrency(data.utilidadNeta)}
          </Text>
        </View>
      )}
    </View>
  );
}

function PnLSeccionCard({
  seccion,
  icon,
  iconColor,
  title,
}: {
  seccion: PnLSeccion;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
}) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: iconColor + "15" }]}>
            <Ionicons name={icon} size={16} color={iconColor} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionTotal}>{formatCurrency(seccion.total)}</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sectionBody}>
          {seccion.grupos?.map((grupo: any) => (
            <PnLGrupoRow key={grupo.codigo} grupo={grupo} />
          ))}

          {seccion.cuentas?.length > 0 && (
            <View style={styles.directAccounts}>
              <Text style={styles.directAccountsLabel}>Cuentas Directas</Text>
              {seccion.cuentas.map((cuenta: any) => (
                <View key={cuenta.cuentaId} style={styles.cuentaRow}>
                  <View style={styles.cuentaInfo}>
                    <Text style={styles.cuentaCodigo}>{cuenta.codigo}</Text>
                    <Text style={styles.cuentaNombre}>{cuenta.nombre}</Text>
                  </View>
                  <Text style={styles.cuentaSaldo}>
                    {formatCurrency(cuenta.saldo)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function PnLGrupoRow({ grupo }: { grupo: any }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <View style={styles.grupoContainer}>
      <TouchableOpacity
        style={styles.grupoHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.grupoInfo}>
          <Ionicons
            name={expanded ? "folder-open" : "folder"}
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.grupoNombre}>{grupo.nombre}</Text>
        </View>
        <View style={styles.grupoRight}>
          <Text style={styles.grupoSaldo}>{formatCurrency(grupo.saldo)}</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {expanded && grupo.cuentas?.length > 0 && (
        <View style={styles.subcuentas}>
          {grupo.cuentas.map((sub: any) => (
            <View key={sub.cuentaId} style={styles.cuentaRow}>
              <View style={styles.cuentaInfo}>
                <Text style={styles.cuentaCodigo}>{sub.codigo}</Text>
                <Text style={styles.cuentaNombre}>{sub.nombre}</Text>
              </View>
              <Text style={styles.cuentaSaldo}>{formatCurrency(sub.saldo)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ── Main Screen ──────────────────────────────── */

export default function AccountingScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = React.useState<ReportTab>("balance");
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [year, month] = selectedMonth.split("-").map(Number);
  const { data: balance, isLoading: loadingBalance } = useBalanceGeneral(selectedMonth + "-01");
  const { data: resultados, isLoading: loadingResultados } = useEstadoResultados(year, month);

  const months = React.useMemo(buildMonthOptions, []);
  const isLoading = activeTab === "balance" ? loadingBalance : loadingResultados;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Contabilidad</Text>
          <Text style={styles.subtitle}>Balance General y Resultados</Text>
        </View>
      </View>

      {/* Segmented control */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === "balance" && styles.segmentActive]}
          onPress={() => setActiveTab("balance")}
        >
          <Ionicons
            name="pie-chart"
            size={16}
            color={activeTab === "balance" ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.segmentText, activeTab === "balance" && styles.segmentTextActive]}>
            Balance General
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === "resultados" && styles.segmentActive]}
          onPress={() => setActiveTab("resultados")}
        >
          <Ionicons
            name="trending-up"
            size={16}
            color={activeTab === "resultados" ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.segmentText, activeTab === "resultados" && styles.segmentTextActive]}>
            Estado Resultados
          </Text>
        </TouchableOpacity>
      </View>

      {/* Month selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
        <View style={styles.monthRow}>
          {months.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[styles.monthChip, selectedMonth === m.value && styles.monthChipActive]}
              onPress={() => setSelectedMonth(m.value)}
            >
              <Text style={[styles.monthText, selectedMonth === m.value && styles.monthTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando datos contables...</Text>
        </View>
      ) : activeTab === "balance" && balance ? (
        <BalanceGeneralView data={balance} />
      ) : activeTab === "resultados" && resultados ? (
        <EstadoResultadosView data={resultados} />
      ) : (
        <View style={styles.emptyBox}>
          <Ionicons name="alert-circle-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin datos</Text>
          <Text style={styles.emptyDesc}>
            No hay información contable disponible para el período seleccionado.
          </Text>
        </View>
      )}
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

  /* Segmented control */
  segmentRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  segmentText: { fontSize: fontSize.sm, fontWeight: "500", color: colors.textSecondary },
  segmentTextActive: { color: colors.primary, fontWeight: "600" },

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

  /* Loading */
  loadingBox: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
  },

  /* Empty */
  emptyBox: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginTop: spacing.md },
  emptyDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
  },

  /* Section card */
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  sectionTotal: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 1 },
  sectionBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },

  /* Grupo */
  grupoContainer: { marginBottom: spacing.xs },
  grupoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.backgroundMuted,
    borderRadius: borderRadius.sm,
  },
  grupoInfo: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 },
  grupoNombre: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text, flex: 1 },
  grupoRight: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  grupoSaldo: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },

  /* Subcuentas */
  subcuentas: {
    paddingLeft: spacing.lg,
    paddingTop: spacing.xs,
  },
  directAccounts: { marginTop: spacing.sm },
  directAccountsLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  cuentaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  cuentaInfo: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 },
  cuentaCodigo: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  cuentaNombre: { fontSize: fontSize.xs, color: colors.textSecondary, flex: 1, marginLeft: spacing.xs },
  cuentaSaldo: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text },

  /* Total row */
  totalSeccion: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalSeccionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  totalSeccionLabel: { fontSize: fontSize.sm, fontWeight: "500", color: colors.textSecondary },
  totalSeccionValue: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },

  /* Balance badge */
  balanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  balanceText: { fontSize: fontSize.sm, fontWeight: "600" },

  /* Highlight rows (profit figures) */
  highlightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  highlightLabel: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  highlightSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  highlightValue: { fontSize: fontSize.lg, fontWeight: "700" },
});
