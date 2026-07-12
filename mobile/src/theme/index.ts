/**
 * AutomotiveOS Mobile — Theme colors
 * Matches the web Tailwind design system.
 */

export const colors = {
  // Primary
  primary: "#f97316", // orange-500
  primaryDark: "#ea580c", // orange-600
  primaryLight: "#fed7aa", // orange-200

  // Backgrounds
  background: "#ffffff",
  backgroundMuted: "#f8fafc", // slate-50
  card: "#ffffff",
  cardBorder: "#e2e8f0", // slate-200

  // Text
  text: "#0f172a", // slate-900
  textSecondary: "#64748b", // slate-500
  textMuted: "#94a3b8", // slate-400
  textInverse: "#ffffff",

  // Status
  success: "#10b981", // emerald-500
  warning: "#f59e0b", // amber-500
  error: "#ef4444", // red-500
  info: "#3b82f6", // blue-500

  // Borders
  border: "#e2e8f0", // slate-200
  borderLight: "#f1f5f9", // slate-100

  // Misc
  overlay: "rgba(0,0,0,0.5)",
  shadow: "rgba(0,0,0,0.1)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
} as const;
