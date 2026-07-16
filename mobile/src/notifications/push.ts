/**
 * AutomotiveOS Mobile — Push notification registration.
 *
 * On login (or app foreground) we obtain the Expo push token and register it
 * with the backend (/mobile/push-token) so the workshop can target this
 * device with OT assignments, HV lockout reminders, etc.
 *
 * Best-effort: any failure is swallowed so it never blocks the user from
 * using the app (offline-first principle).
 */

import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Application from "expo-application";
import {
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-notifications";
import { api } from "../api/client";

/** Stable per-install device id (falls back to a generated uuid). */
function getDeviceId(): string {
  const id = Application.androidId ?? Application.getIosIdForVendorAsync?.() ?? null;
  return (id as string) ?? `dev-${Math.random().toString(36).slice(2)}`;
}

/**
 * Register this device's push token with the backend.
 * No-ops gracefully if push is unavailable (emulator, permissions denied).
 */
export async function registerPushToken(profileEmail?: string): Promise<void> {
  try {
    if (!Device.isDevice) return; // push requires a physical device

    const { status } = await getPermissionsAsync();
    if (status !== "granted") {
      const req = await requestPermissionsAsync();
      if (req.status !== "granted") return;
    }

    const token = await getExpoPushTokenAsync();
    const deviceId = getDeviceId();

    await api.registerPushToken({
      deviceId,
      pushToken: token.data,
      platform: Platform.OS as "ios" | "android" | "web",
      profileEmail,
    });
  } catch {
    // Offline or permission denied — non-fatal.
  }
}

/** Remove this device's push token from the backend (logout). */
export async function unregisterPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const deviceId = getDeviceId();
    await api.unregisterPushToken(deviceId);
  } catch {
    // Non-fatal.
  }
}
