/**
 * Empty state with icon, title, and optional subtitle.
 */

import * as React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, fontSize } from "../theme";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export default function EmptyState({
  icon = "file-tray-outline",
  title,
  subtitle,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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
  title: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: "center",
  },
});
