/**
 * Barcode Stock Scanner Screen — S78-6
 *
 * Scans barcodes and QR codes for inventory operations:
 * - Look up repuesto by barcode
 * - Record stock entrada/salida
 * - Quick inventory count
 *
 * @module mobile/screens/BarcodeScannerScreen
 */

import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { api } from "../api/client";

interface ScannedItem {
  barcode: string;
  type: "BARCODE" | "QR";
  timestamp: string;
}

export default function BarcodeScannerScreen({ route, navigation }: any) {
  const mode = route?.params?.mode ?? "LOOKUP"; // LOOKUP | ENTRADA | SALIDA | INVENTARIO
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = React.useState<ScannedItem[]>([]);
  const [lastScan, setLastScan] = React.useState<string | null>(null);
  const [scanCount, setScanCount] = React.useState(0);
  const cameraRef = React.useRef<CameraView>(null);

  const handleBarCodeScanned = React.useCallback((result: BarcodeScanningResult) => {
    const { data, type } = result;

    // Debounce rapid scans (500ms)
    if (lastScan === data) return;
    Vibration.vibrate(100);

    const item: ScannedItem = {
      barcode: data,
      type: type === 256 ? "QR" : "BARCODE",
      timestamp: new Date().toISOString(),
    };

    setScanned((prev) => [...prev, item]);
    setLastScan(data);
    setScanCount((c) => c + 1);

    const handleLookup = async () => {
      try {
        const result = await api.lookupByBarcode(data);
        const rep = result.repuesto;
        Alert.alert(
          "Producto Encontrado",
          `Código: ${data}\nDescripción: ${rep?.descripcion ?? "—"}\nStock: ${rep?.stock ?? "—"} unidades`,
          [
            { text: "Cerrar", style: "cancel" },
            {
              text: "Ver Detalle",
              onPress: () => {
                navigation.navigate("InventoryDetail", { barcode: data });
              },
            },
          ],
        );
      } catch (err) {
        Alert.alert("No encontrado", `No se encontró un producto con código: ${data}`);
      }
    };

    const handleStockMovement = async (tipo: "ENTRADA" | "SALIDA") => {
      try {
        const result = await api.lookupByBarcode(data);
        await api.recordStockMovement({
          repuestoId: result.repuesto?.id ?? data,
          tipo,
          cantidad: 1,
        });
        Alert.alert("Éxito", `${tipo} de stock registrada para ${data}.`);
      } catch (err: any) {
        Alert.alert("Error", err?.message ?? `No se pudo registrar la ${tipo.toLowerCase()}.`);
      }
    };

    if (mode === "LOOKUP") {
      handleLookup();
    } else if (mode === "ENTRADA" || mode === "SALIDA") {
      const action = mode === "ENTRADA" ? "Entrada" : "Salida";
      Alert.alert(
        `Registrar ${action}`,
        `Código: ${data}\n¿Registrar ${action.toLowerCase()} de stock?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: `Confirmar ${action}`,
            onPress: () => handleStockMovement(mode as "ENTRADA" | "SALIDA"),
          },
        ],
      );
    }
  }, [lastScan, mode, navigation]);

  const handleClearScans = React.useCallback(() => {
    setScanned([]);
    setScanCount(0);
    setLastScan(null);
  }, []);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Solicitando permiso de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
        <Text style={styles.permissionTitle}>Permiso de Cámara Requerido</Text>
        <Text style={styles.permissionText}>
          El escáner de códigos de barras necesita acceso a la cámara.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Conceder Permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const modeTitle: Record<string, string> = {
    LOOKUP: "Buscar Producto",
    ENTRADA: "Entrada de Stock",
    SALIDA: "Salida de Stock",
    INVENTARIO: "Conteo de Inventario",
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{modeTitle[mode] ?? "Escáner"}</Text>
          <Text style={styles.headerSub}>{scanCount} escaneos</Text>
        </View>
        {scanCount > 0 && (
          <TouchableOpacity onPress={handleClearScans} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Camera Scanner */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"] }}
        onBarcodeScanned={handleBarCodeScanned}
      >
        {/* Scanning overlay */}
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>
            {mode === "LOOKUP"
              ? "Enfoque el código de barras del producto"
              : mode === "INVENTARIO"
              ? "Escaneé productos para conteo rápido"
              : "Escaneé el código para registrar movimiento"}
          </Text>
        </View>
      </CameraView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "LOOKUP" && styles.modeBtnActive]}
          onPress={() => navigation.setParams({ mode: "LOOKUP" })}
        >
          <Ionicons name="search" size={18} color={mode === "LOOKUP" ? colors.textInverse : colors.textSecondary} />
          <Text style={[styles.modeBtnText, mode === "LOOKUP" && styles.modeBtnTextActive]}>Buscar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "ENTRADA" && styles.modeBtnActive]}
          onPress={() => navigation.setParams({ mode: "ENTRADA" })}
        >
          <Ionicons name="arrow-down" size={18} color={mode === "ENTRADA" ? colors.textInverse : colors.textSecondary} />
          <Text style={[styles.modeBtnText, mode === "ENTRADA" && styles.modeBtnTextActive]}>Entrada</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "SALIDA" && styles.modeBtnActive]}
          onPress={() => navigation.setParams({ mode: "SALIDA" })}
        >
          <Ionicons name="arrow-up" size={18} color={mode === "SALIDA" ? colors.textInverse : colors.textSecondary} />
          <Text style={[styles.modeBtnText, mode === "SALIDA" && styles.modeBtnTextActive]}>Salida</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "INVENTARIO" && styles.modeBtnActive]}
          onPress={() => navigation.setParams({ mode: "INVENTARIO" })}
        >
          <Ionicons name="clipboard" size={18} color={mode === "INVENTARIO" ? colors.textInverse : colors.textSecondary} />
          <Text style={[styles.modeBtnText, mode === "INVENTARIO" && styles.modeBtnTextActive]}>Conteo</Text>
        </TouchableOpacity>
      </View>

      {/* Last Scans */}
      {scanned.length > 0 && (
        <View style={styles.scanList}>
          <Text style={styles.scanListTitle}>
            Últimos {Math.min(scanned.length, 5)} escaneos
          </Text>
          {scanned.slice(-5).reverse().map((s, i) => (
            <View key={i} style={styles.scanItem}>
              <Ionicons name={s.type === "QR" ? "qr-code" : "barcode"} size={16} color={colors.primary} />
              <Text style={styles.scanCode} numberOfLines={1}>{s.barcode}</Text>
              <Text style={styles.scanTime}>{new Date(s.timestamp).toLocaleTimeString("es-PY")}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl, backgroundColor: colors.background },
  loadingText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md },
  permissionTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text, marginTop: spacing.lg, textAlign: "center" },
  permissionText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm, textAlign: "center", lineHeight: 20 },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.sm },
  headerInfo: { flex: 1, marginLeft: spacing.md },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  headerSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  clearBtn: { padding: spacing.sm },
  camera: { flex: 1 },
  scanOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  scanFrame: { width: 250, height: 200, borderWidth: 2, borderColor: colors.primary, borderRadius: borderRadius.md, backgroundColor: "transparent" },
  scanHint: { color: "#fff", fontSize: fontSize.sm, marginTop: spacing.lg, textAlign: "center", paddingHorizontal: spacing.xl, textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 4 },
  actionBar: { flexDirection: "row", backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.sm, gap: spacing.xs },
  modeBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: borderRadius.sm, gap: 2 },
  modeBtnActive: { backgroundColor: colors.primary },
  modeBtnText: { fontSize: 10, color: colors.textSecondary, fontWeight: "500" },
  modeBtnTextActive: { color: colors.textInverse },
  scanList: { padding: spacing.md, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  scanListTitle: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: "600", marginBottom: spacing.sm },
  scanItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  scanCode: { flex: 1, fontSize: fontSize.sm, fontFamily: "monospace", color: colors.text },
  scanTime: { fontSize: 10, color: colors.textMuted },
  primaryButton: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.lg },
  primaryButtonText: { color: colors.textInverse, fontSize: fontSize.sm, fontWeight: "600" },
});
