/**
 * CashDrawerButton — manual open button for the cash drawer.
 * (shift-management tasks 7.1, 7.2, 7.3)
 *
 * Task 7.1: Implement drawer kick command
 *   - Sends the ESC/POS `ESC p` command via the active printer connection.
 *   - Falls back to a platform-specific serial/USB kick if Bluetooth not available.
 *
 * Task 7.2: Log drawer opens
 *   - Every kick (automatic or manual) is recorded as a CashDrawerEvent of
 *     type "open" in WatermelonDB. This creates a full audit trail.
 *
 * Task 7.3: Add manual drawer open button
 *   - This component is the UI entry point for manual opens.
 *   - Requires a manager PIN override if the shift is already open (prevent
 *     casual opening mid-shift outside a sale context).
 *
 * Why ESC/POS for the kick command?
 * The vast majority of cash drawers used by BizPilot clients are
 * Star/Epson-compatible receipt printers with a kick port (DK-2 connector).
 * ESC/POS is the universal language for these devices. For USB/serial
 * drawers, we detect the drawer type from device settings.
 */

import React, { useCallback, useState } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a drawer kick attempt */
export interface DrawerKickResult {
  success: boolean;
  /** ISO timestamp of when the kick was sent */
  timestamp: string;
  /** Error message if kick failed */
  error?: string;
}

export interface CashDrawerButtonProps {
  /**
   * Called when the button is pressed.
   * The parent component:
   *   1. Checks if a manager PIN is needed (mid-shift manual open)
   *   2. Sends the ESC/POS kick command via BluetoothPrinterService / USB
   *   3. Logs the drawer event in WatermelonDB (Task 7.2)
   * Returns a DrawerKickResult.
   */
  onKickDrawer: () => Promise<DrawerKickResult>;
  /**
   * Whether this is a mid-shift manual open that should be logged
   * as a manual event (vs automatic open triggered by a cash sale).
   */
  isManual?: boolean;
  /**
   * Whether the drawer is currently available (printer connected, etc.).
   * Shows a warning state when false but still allows the attempt.
   */
  drawerAvailable?: boolean;
  /** Compact mode for toolbars — shows only icon */
  compact?: boolean;
  /** Additional container style */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CashDrawerButton renders a pressable button that kicks the cash drawer open.
 * It shows success/error feedback for 2 seconds after each kick attempt.
 */
const CashDrawerButton: React.FC<CashDrawerButtonProps> = React.memo(
  function CashDrawerButton({
    onKickDrawer,
    isManual = true,
    drawerAvailable = true,
    compact = false,
    style,
  }) {
    const [loading, setLoading] = useState(false);
    const [lastResult, setLastResult] = useState<"success" | "error" | null>(null);

    const handlePress = useCallback(async () => {
      if (loading) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setLoading(true);
      setLastResult(null);

      try {
        const result = await onKickDrawer();
        setLastResult(result.success ? "success" : "error");
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch {
        setLastResult("error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setLoading(false);
        // Clear result indicator after 2 seconds
        setTimeout(() => setLastResult(null), 2000);
      }
    }, [loading, onKickDrawer]);

    const { bgColor, iconColor, borderColor } = getButtonColors(
      lastResult,
      drawerAvailable
    );

    if (compact) {
      return (
        <Pressable
          style={({ pressed }) => [
            styles.compactButton,
            { backgroundColor: bgColor, borderColor },
            pressed && styles.pressed,
            style,
          ]}
          onPress={handlePress}
          disabled={loading}
          accessibilityLabel="Open cash drawer"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons
              name={lastResult === "success" ? "checkmark" : "archive-outline"}
              size={22}
              color={iconColor}
            />
          )}
        </Pressable>
      );
    }

    return (
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: bgColor, borderColor },
          pressed && styles.pressed,
          loading && styles.loading,
          style,
        ]}
        onPress={handlePress}
        disabled={loading}
        accessibilityLabel="Open cash drawer manually"
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Ionicons
            name={
              lastResult === "success"
                ? "checkmark-circle-outline"
                : lastResult === "error"
                ? "alert-circle-outline"
                : "archive-outline"
            }
            size={24}
            color={iconColor}
          />
        )}

        <View style={styles.textBlock}>
          <Text style={[styles.label, { color: iconColor }]}>
            {loading ? "Opening…" : "Open Drawer"}
          </Text>
          {!compact && (
            <Text style={styles.sublabel}>
              {lastResult === "success"
                ? "Drawer opened"
                : lastResult === "error"
                ? "Kick failed — check connection"
                : !drawerAvailable
                ? "Printer not connected"
                : isManual
                ? "Manual open (logged)"
                : "Auto-open on sale"}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }
);

// ---------------------------------------------------------------------------
// Helper: button colour scheme
// ---------------------------------------------------------------------------

function getButtonColors(
  result: "success" | "error" | null,
  available: boolean
): { bgColor: string; iconColor: string; borderColor: string } {
  if (result === "success") {
    return { bgColor: "#064e3b", iconColor: "#34d399", borderColor: "#059669" };
  }
  if (result === "error") {
    return { bgColor: "#7f1d1d", iconColor: "#fca5a5", borderColor: "#dc2626" };
  }
  if (!available) {
    return { bgColor: "#1f2937", iconColor: "#6b7280", borderColor: "#374151" };
  }
  return { bgColor: "#1f2937", iconColor: "#d1d5db", borderColor: "#374151" };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
    minWidth: 160,
  },
  compactButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
  },
  sublabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  loading: {
    opacity: 0.7,
  },
});

export default CashDrawerButton;
