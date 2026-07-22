/**
 * DVI Camera Capture Screen — S78-4
 *
 * Captures photos during Digital Vehicle Inspection (DVI).
 * Uses expo-camera for photo capture with overlay guides.
 *
 * @module mobile/screens/DVICameraScreen
 */

import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api, BACKEND_URL } from "../api/client";

interface PhotoEntry {
  uri: string;
  label: string;
  timestamp: string;
}

const PHOTO_LABELS = [
  "Frente del vehículo",
  "Lado izquierdo",
  "Lado derecho",
  "Parte trasera",
  "Tablero (km)",
  "Neumático delantero izq.",
  "Neumático trasero der.",
  "Motor",
  "Daños preexistentes",
];

export default function DVICameraScreen({ route, navigation }: any) {
  const ordenId = route?.params?.ordenId;
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = React.useState(false);
  const [capturedPhotos, setCapturedPhotos] = React.useState<PhotoEntry[]>([]);
  const [currentLabel, setCurrentLabel] = React.useState(PHOTO_LABELS[0]!);
  const [showPreview, setShowPreview] = React.useState(false);
  const [previewUri, setPreviewUri] = React.useState<string | null>(null);
  const cameraRef = React.useRef<CameraView>(null);

  const remainingLabels = PHOTO_LABELS.filter(
    (l) => !capturedPhotos.find((p) => p.label === l),
  );

  const handleTakePhoto = React.useCallback(async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 }) as { uri: string };
      const entry: PhotoEntry = {
        uri: photo.uri,
        label: currentLabel,
        timestamp: new Date().toISOString(),
      };
      setCapturedPhotos((prev) => [...prev, entry]);
      setPreviewUri(photo.uri);
      setShowPreview(true);

      // Auto-advance to next label
      const nextIdx = remainingLabels.indexOf(currentLabel) + 1;
      if (nextIdx < remainingLabels.length) {
        setCurrentLabel(remainingLabels[nextIdx]!);
      }
    } catch (err) {
      console.warn("[DVI Camera] Error taking photo:", err);
      Alert.alert("Error", "No se pudo capturar la foto. Intente nuevamente.");
    }
  }, [cameraReady, currentLabel, remainingLabels]);

  const handleRetake = React.useCallback(() => {
    // Remove last photo so user can retake
    setCapturedPhotos((prev) => prev.slice(0, -1));
    setShowPreview(false);
    setPreviewUri(null);
  }, []);

  const handleSave = React.useCallback(async () => {
    if (!ordenId) {
      Alert.alert("Error", "No se ha especificado una orden de trabajo.");
      return;
    }
    try {
      const result = await api.createDVIInspection({
        ordenTrabajoId: ordenId,
        notas: `Inspección DVI con ${capturedPhotos.length} fotos.`,
      });
      // Upload each photo individually if DVI was created
      for (const photo of capturedPhotos) {
        try {
          const formData = new FormData();
          formData.append("photo", {
            uri: photo.uri,
            type: "image/jpeg",
            name: `dvi_${result.id}_${Date.now()}.jpg`,
          } as any);
          formData.append("label", photo.label);
          await fetch(`${BACKEND_URL}/dvi/${result.id}/photos`, {
            method: "POST",
            body: formData,
            headers: { "X-Tenant-Slug": "demo" },
          });
        } catch (uploadErr) {
          console.warn("[DVI] Photo upload failed:", uploadErr);
        }
      }
      Alert.alert("Éxito", `Inspección DVI guardada con ${capturedPhotos.length} fotos.`);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "No se pudo guardar la inspección.");
    }
  }, [capturedPhotos, ordenId, navigation]);

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
          La inspección DVI necesita acceso a la cámara para capturar imágenes del vehículo.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Conceder Permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Inspección DVI</Text>
          <Text style={styles.headerSub}>
            {capturedPhotos.length}/{PHOTO_LABELS.length} fotos
          </Text>
        </View>
        {capturedPhotos.length > 0 && (
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          </TouchableOpacity>
        )}
      </View>

      {showPreview && previewUri ? (
        /* Photo Preview */
        <View style={styles.previewContainer}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleRetake}>
              <Ionicons name="refresh" size={20} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Rehacer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => { setShowPreview(false); setPreviewUri(null); }}
            >
              <Ionicons name="checkmark" size={20} color={colors.textInverse} />
              <Text style={styles.primaryButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Camera View */
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        >
          {/* Overlay guide */}
          <View style={styles.overlay}>
            <View style={styles.guideFrame} />
          </View>

          {/* Current label */}
          <View style={styles.labelBanner}>
            <Text style={styles.labelText}>{currentLabel}</Text>
          </View>

          {/* Capture button */}
          <View style={styles.captureArea}>
            <TouchableOpacity
              style={[styles.captureBtn, !cameraReady && styles.captureBtnDisabled]}
              onPress={handleTakePhoto}
              disabled={!cameraReady}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      )}

      {/* Photo Strip */}
      {capturedPhotos.length > 0 && (
        <ScrollView horizontal style={styles.photoStrip} showsHorizontalScrollIndicator={false}>
          {capturedPhotos.map((photo, i) => (
            <View key={i} style={styles.photoThumb}>
              <Image source={{ uri: photo.uri }} style={styles.thumbImage} />
              <Text style={styles.thumbLabel} numberOfLines={1}>{photo.label.slice(0, 15)}</Text>
            </View>
          ))}
        </ScrollView>
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
  saveBtn: { padding: spacing.sm },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  guideFrame: { width: "85%", height: "50%", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", borderRadius: borderRadius.md },
  labelBanner: { position: "absolute", top: 80, left: spacing.lg, right: spacing.lg, backgroundColor: "rgba(0,0,0,0.6)", padding: spacing.sm, borderRadius: borderRadius.sm },
  labelText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "600", textAlign: "center" },
  captureArea: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.3)", justifyContent: "center", alignItems: "center", borderWidth: 4, borderColor: "#fff" },
  captureBtnDisabled: { opacity: 0.5 },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  previewContainer: { flex: 1, backgroundColor: "#000" },
  previewImage: { flex: 1 },
  previewActions: { flexDirection: "row", justifyContent: "space-around", padding: spacing.lg, backgroundColor: "#111" },
  primaryButton: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  primaryButtonText: { color: colors.textInverse, fontSize: fontSize.sm, fontWeight: "600" },
  secondaryButton: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600" },
  photoStrip: { maxHeight: 80, paddingHorizontal: spacing.sm, backgroundColor: colors.card },
  photoThumb: { width: 64, height: 72, margin: spacing.xs, alignItems: "center" },
  thumbImage: { width: 56, height: 56, borderRadius: borderRadius.sm, backgroundColor: colors.border },
  thumbLabel: { fontSize: 8, color: colors.textSecondary, marginTop: 2 },
});
