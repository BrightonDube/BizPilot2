/**
 * BizPilot Mobile POS — Haptic Feedback Utilities
 *
 * Wraps expo-haptics in a centralized, type-safe utility.
 * Every haptic call checks the user's settings first.
 *
 * Why centralize haptics?
 * 1. Single place to respect the "haptics enabled" user preference
 * 2. Consistent feedback patterns across the app
 * 3. Graceful no-op on platforms without haptic hardware (web, old Android)
 * 4. Easy to add analytics tracking for haptic usage patterns
 */

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useSettingsStore } from "@/stores/settingsStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HapticPattern =
  | "tap"         // Light impact — button press, list item select
  | "success"     // Success notification — payment complete, order placed
  | "warning"     // Warning notification — low stock alert
  | "error"       // Error notification — failed action, validation error
  | "heavy"       // Heavy impact — destructive action confirmation
  | "selection";  // Selection change — picker, toggle, tab switch

// ---------------------------------------------------------------------------
// Platform check
// ---------------------------------------------------------------------------

/**
 * Haptics only work on physical iOS/Android devices.
 * Web and simulators silently no-op.
 */
const isHapticSupported = Platform.OS === "ios" || Platform.OS === "android";

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Trigger haptic feedback if enabled in user settings.
 *
 * @param pattern - The type of haptic feedback to trigger
 *
 * Usage:
 *   triggerHaptic("tap")     — on button press
 *   triggerHaptic("success") — on payment complete
 *   triggerHaptic("error")   — on validation failure
 */
export function triggerHaptic(pattern: HapticPattern): void {
  // Check user preference — respect their choice to disable haptics
  const hapticsEnabled = useSettingsStore.getState().hapticsEnabled;
  if (!hapticsEnabled || !isHapticSupported) return;

  switch (pattern) {
    case "tap":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;

    case "success":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;

    case "warning":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;

    case "error":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;

    case "heavy":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;

    case "selection":
      Haptics.selectionAsync();
      break;

    default:
      // Unknown pattern — silently ignore to prevent crashes
      break;
  }
}

// ---------------------------------------------------------------------------
// Convenience functions (used in hot paths)
// ---------------------------------------------------------------------------

/** Light tap — use on every button press / list item tap */
export function hapticTap(): void {
  triggerHaptic("tap");
}

/** Success vibration — use after completing payment or placing order */
export function hapticSuccess(): void {
  triggerHaptic("success");
}

/** Error vibration — use on validation failure or network error */
export function hapticError(): void {
  triggerHaptic("error");
}

/** Selection feedback — use on picker changes, toggle switches */
export function hapticSelection(): void {
  triggerHaptic("selection");
}
