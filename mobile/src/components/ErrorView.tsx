/**
 * Error state with icon, message, and retry button.
 */

import * as React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";

interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorView({ message = "Ocurrió un error", onRetry }: ErrorViewProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color={colors.textInverse} />
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundMuted,
    padding: spacing.xl,
  },
  message: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryText: {
    color: colors.textInverse,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
