/**
 * SignaturePad — firma táctil (PanResponder + react-native-svg).
 *
 * Devuelve un data URL SVG (`data:image/svg+xml;utf8,…`) que el backend
 * guarda como texto opaco; el web lo muestra igual que una firma PNG.
 */

import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";

interface SignaturePadProps {
  /** Data URL actual (vacío = sin firma). */
  value: string;
  onChange: (value: string) => void;
  height?: number;
}

const STROKE_COLOR = "#0f172a";
const STROKE_WIDTH = 2.5;

function toSvgDataUrl(strokes: string[], width: number, height: number): string {
  const paths = strokes
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${STROKE_COLOR}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function SignaturePad({
  value,
  onChange,
  height = 220,
}: SignaturePadProps) {
  const [strokes, setStrokes] = React.useState<string[]>([]);
  const [size, setSize] = React.useState({ width: 0, height });

  const sizeRef = React.useRef(size);
  sizeRef.current = size;
  const strokesRef = React.useRef<string[]>([]);
  strokesRef.current = strokes;

  const emit = React.useCallback(
    (next: string[]) => {
      const { width, height: h } = sizeRef.current;
      onChange(next.length > 0 && width > 0 ? toSvgDataUrl(next, width, h) : "");
    },
    [onChange],
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const d = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setStrokes((prev) => [...prev, d]);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          setStrokes((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            next[next.length - 1] += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
            return next;
          });
        },
        onPanResponderRelease: () => {
          emit(strokesRef.current);
        },
      }),
    [emit],
  );

  // Si el padre limpia el valor, reinicia los trazos.
  React.useEffect(() => {
    if (value === "") setStrokes([]);
  }, [value]);

  const handleClear = () => {
    setStrokes([]);
    onChange("");
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.pad, { height }]}
        onLayout={(e) =>
          setSize({ width: e.nativeEvent.layout.width, height })
        }
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {strokes.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={STROKE_COLOR}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </Svg>
        {strokes.length === 0 && (
          <View style={styles.placeholder} pointerEvents="none">
            <Ionicons name="create-outline" size={20} color={colors.textMuted} />
            <Text style={styles.placeholderText}>Firme aquí con el dedo</Text>
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.hint}>
          {strokes.length > 0 ? "Trazos capturados ✓" : "Sin firma"}
        </Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          disabled={strokes.length === 0}
        >
          <Ionicons name="trash-outline" size={14} color={colors.error} />
          <Text style={styles.clearText}>Limpiar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  pad: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    justifyContent: "center",
  },
  placeholder: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  placeholderText: { color: colors.textMuted, fontSize: fontSize.sm },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  hint: { color: colors.textMuted, fontSize: fontSize.xs },
  clearButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  clearText: { color: colors.error, fontSize: fontSize.xs, fontWeight: "600" },
});
