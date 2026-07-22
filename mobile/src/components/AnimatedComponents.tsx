/**
 * Animated Components — Reusable animation utilities for mobile.
 *
 * Uses React Native's built-in Animated API (no extra dependencies).
 * Provides: LoadingSpinner, FadeInView, AnimatedEmptyState, PulsingDot
 *
 * @module mobile/src/components/AnimatedComponents
 */

import * as React from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, borderRadius, fontSize } from "../theme";

/* ── Loading Spinner with pulse ─────────────── */

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function LoadingSpinner({
  message = "Cargando...",
  size = 36,
  color = colors.primary,
  style,
}: LoadingSpinnerProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const spinAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => spin.stop();
  }, [spinAnim]);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.loadingContainer, style]}>
      <Animated.View
        style={{
          opacity: pulseAnim,
          transform: [{ rotate: spinInterpolation }],
        }}
      >
        <Ionicons name="sync" size={size} color={color} />
      </Animated.View>
      <Animated.Text style={[styles.loadingText, { opacity: pulseAnim }]}>
        {message}
      </Animated.Text>
    </View>
  );
}

/* ── Fade In View for list items ────────────── */

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeInView({
  children,
  delay = 0,
  duration = 400,
  style,
}: FadeInViewProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ── Animated Empty State ───────────────────── */

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function AnimatedEmptyState({
  icon = "cube-outline",
  title,
  subtitle,
}: EmptyStateProps) {
  const bounceAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [bounceAnim]);

  const iconScale = bounceAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1.2, 1],
  });

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        <Ionicons
          name={icon as any}
          size={64}
          color={colors.textMuted}
        />
      </Animated.View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

/* ── Pulsing Dot (for status indicators) ────── */

interface PulsingDotProps {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function PulsingDot({
  color = colors.success,
  size = 8,
  style,
}: PulsingDotProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

/* ── Staggered Fade List — animates children one by one ── */

interface StaggerListProps {
  children: React.ReactNode[];
  baseDelay?: number;
  staggerDelay?: number;
  style?: StyleProp<ViewStyle>;
}

export function StaggerList({
  children,
  baseDelay = 50,
  staggerDelay = 80,
  style,
}: StaggerListProps) {
  return (
    <View style={style}>
      {React.Children.map(children, (child, i) => (
        <FadeInView key={i} delay={baseDelay + i * staggerDelay}>
          {child}
        </FadeInView>
      ))}
    </View>
  );
}

/* ── Styles ──────────────────────────────────── */

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: "center",
    lineHeight: 20,
  },
});
