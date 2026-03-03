/**
 * BizPilot Mobile POS — OnlineOfflineIndicator Component
 *
 * Compact inline indicator showing connected/disconnected state.
 * Intended for header bars and tab bars where space is limited.
 *
 * Why separate from SyncStatus?
 * SyncStatus is a full bar component with text. This is a minimal
 * icon-only indicator that can be embedded in tight spaces like
 * the navigation header or settings row.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSyncStore } from "@/stores/syncStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OnlineOfflineIndicatorProps {
  /** Show label text alongside the icon. Defaults to true. */
  showLabel?: boolean;
  /** Size of the icon */
  size?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const OnlineOfflineIndicator: React.FC<OnlineOfflineIndicatorProps> = React.memo(
  function OnlineOfflineIndicator({ showLabel = true, size = 16 }) {
    const isOnline = useSyncStore((s) => s.isOnline);

    return (
      <View style={styles.container} accessibilityLabel={isOnline ? "Online" : "Offline"}>
        <Ionicons
          name={isOnline ? "wifi" : "cloud-offline-outline"}
          size={size}
          color={isOnline ? "#22c55e" : "#ef4444"}
        />
        {showLabel && (
          <Text
            style={[
              styles.label,
              { color: isOnline ? "#22c55e" : "#ef4444" },
            ]}
          >
            {isOnline ? "Online" : "Offline"}
          </Text>
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export default OnlineOfflineIndicator;
