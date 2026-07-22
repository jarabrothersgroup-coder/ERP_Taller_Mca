/**
 * Thinkcar OBD2 Bluetooth Screen — S78-5
 *
 * Scans for and connects to Thinkcar OBD2 Bluetooth devices.
 * Displays real-time DTC codes and vehicle data.
 *
 * @module mobile/screens/ThinkcarOBD2Screen
 */

import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";

interface BluetoothDevice {
  id: string;
  name: string;
  rssi: number;
  serviceUuids?: string[];
}

interface DTCResult {
  code: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const MOCK_DEVICES: BluetoothDevice[] = [
  { id: "1", name: "Thinkcar THINKOBD 100", rssi: -65 },
  { id: "2", name: "Thinkcar THINKOBD 200", rssi: -72 },
  { id: "3", name: "ELM327 v2.1", rssi: -80 },
];

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL": return colors.error;
    case "HIGH": return "#ff6b35";
    case "MEDIUM": return colors.warning;
    default: return colors.success;
  }
}

export default function ThinkcarOBD2Screen({ navigation }: any) {
  const [isScanning, setIsScanning] = React.useState(false);
  const [devices, setDevices] = React.useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = React.useState<BluetoothDevice | null>(null);
  const [dtcCodes, setDtcCodes] = React.useState<DTCResult[]>([]);
  const [isReading, setIsReading] = React.useState(false);

  const handleScan = React.useCallback(async () => {
    setIsScanning(true);
    setDevices([]);
    // Simulate scanning — in production uses BleManager from react-native-ble-plx
    setTimeout(() => {
      setDevices(MOCK_DEVICES);
      setIsScanning(false);
    }, 2000);
  }, []);

  const handleConnect = React.useCallback(async (device: BluetoothDevice) => {
    setConnectedDevice(device);
    Alert.alert("Conectado", `Conectado a ${device.name}`);
  }, []);

  const handleDisconnect = React.useCallback(async () => {
    setConnectedDevice(null);
    setDtcCodes([]);
    Alert.alert("Desconectado", "Dispositivo OBD2 desconectado.");
  }, []);

  const handleReadDTC = React.useCallback(async () => {
    if (!connectedDevice) return;
    setIsReading(true);
    // Simulate DTC reading — in production reads via ELM327 AT commands over BLE
    setTimeout(() => {
      setDtcCodes([
        { code: "P0300", description: "Fallo de encendido aleatorio/múltiples cilindros", severity: "HIGH" },
        { code: "P0420", description: "Eficiencia del catalizador por debajo del umbral", severity: "MEDIUM" },
        { code: "P0171", description: "Mezcla pobre en banco 1", severity: "MEDIUM" },
      ]);
      setIsReading(false);
    }, 3000);
  }, [connectedDevice]);

  const handleImportDTC = React.useCallback(async () => {
    if (dtcCodes.length === 0) return;
    Alert.alert(
      "Importar DTCs",
      `Se importarán ${dtcCodes.length} códigos DTC a la orden de trabajo.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Importar",
          onPress: () => {
            Alert.alert("Éxito", `${dtcCodes.length} códigos DTC importados.`);
            navigation.goBack();
          },
        },
      ],
    );
  }, [dtcCodes, navigation]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Thinkcar OBD2</Text>
          <Text style={styles.headerSub}>{connectedDevice ? "Conectado" : "Desconectado"}</Text>
        </View>
        {connectedDevice ? (
          <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
            <Ionicons name="bluetooth" size={24} color={colors.error} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleScan} style={styles.scanBtn} disabled={isScanning}>
            <Ionicons
              name={isScanning ? "sync" : "bluetooth"}
              size={24}
              color={isScanning ? colors.textMuted : colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {!connectedDevice ? (
        /* Device List */
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dispositivos Bluetooth</Text>
          {isScanning ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Escaneando dispositivos OBD2...</Text>
            </View>
          ) : devices.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="bluetooth-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>Presione el icono Bluetooth para escanear</Text>
            </View>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.deviceCard} onPress={() => handleConnect(item)}>
                  <View style={styles.deviceInfo}>
                    <Ionicons name="hardware-chip" size={24} color={colors.primary} />
                    <View style={{ marginLeft: spacing.md }}>
                      <Text style={styles.deviceName}>{item.name}</Text>
                      <Text style={styles.deviceSignal}>Señal: {item.rssi} dBm</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.list}
            />
          )}
        </View>
      ) : (
        /* Connected View */
        <View style={{ flex: 1 }}>
          {/* Connected Device Info */}
          <View style={styles.connectedBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.connectedText}>Conectado a {connectedDevice.name}</Text>
          </View>

          {/* Read DTC Button */}
          <TouchableOpacity
            style={[styles.readBtn, isReading && styles.readBtnDisabled]}
            onPress={handleReadDTC}
            disabled={isReading}
          >
            {isReading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Ionicons name="car" size={20} color={colors.textInverse} />
            )}
            <Text style={styles.readBtnText}>
              {isReading ? "Leyendo DTCs..." : "Leer Códigos DTC"}
            </Text>
          </TouchableOpacity>

          {/* DTC Results */}
          {dtcCodes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Códigos DTC ({dtcCodes.length})
              </Text>
              {dtcCodes.map((dtc, i) => (
                <View key={i} style={styles.dtcCard}>
                  <View style={styles.dtcHeader}>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(dtc.severity) + "20" }]}>
                      <Text style={[styles.severityText, { color: getSeverityColor(dtc.severity) }]}>
                        {dtc.severity}
                      </Text>
                    </View>
                    <Text style={styles.dtcCode}>{dtc.code}</Text>
                  </View>
                  <Text style={styles.dtcDesc}>{dtc.description}</Text>
                </View>
              ))}

              <TouchableOpacity style={styles.importBtn} onPress={handleImportDTC}>
                <Ionicons name="download" size={20} color={colors.textInverse} />
                <Text style={styles.importBtnText}>Importar a Orden de Trabajo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundMuted },
  centered: { alignItems: "center", paddingVertical: spacing.xxl * 2 },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.sm },
  headerInfo: { flex: 1, marginLeft: spacing.md },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  headerSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  scanBtn: { padding: spacing.sm },
  disconnectBtn: { padding: spacing.sm },
  section: { padding: spacing.md, flex: 1 },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  list: { gap: spacing.sm },
  deviceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.card, padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  deviceInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  deviceName: { fontSize: fontSize.md, fontWeight: "500", color: colors.text },
  deviceSignal: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  loadingText: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.md, textAlign: "center" },
  connectedBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.success + "10", borderBottomWidth: 1, borderBottomColor: colors.border },
  connectedText: { fontSize: fontSize.sm, color: colors.success, fontWeight: "500" },
  readBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, margin: spacing.md, padding: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.md },
  readBtnDisabled: { opacity: 0.6 },
  readBtnText: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: "600" },
  dtcCard: { backgroundColor: colors.card, padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  dtcHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  severityBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  severityText: { fontSize: fontSize.xs, fontWeight: "600" },
  dtcCode: { fontSize: fontSize.md, fontWeight: "700", fontFamily: "monospace", color: colors.text },
  dtcDesc: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 18 },
  importBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md, padding: spacing.lg, backgroundColor: colors.success, borderRadius: borderRadius.md },
  importBtnText: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: "600" },
});
