/**
 * BizPilot Mobile POS — PMSStatusIndicator Component
 *
 * Compact indicator showing PMS connection status.
 * Placed in the POS header bar when PMS integration is enabled.
 *
 * Why show PMS status separately from network status?
 * The device can be online but the PMS server can be unreachable
 * (e.g., PMS maintenance window). Staff need to know both states
 * to decide whether room charges will post immediately or queue.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePMSStore } from "@/stores/pmsStore";
import type { PMSConnectionStatus } from "@/types/pms";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PMSStatusIndicatorProps {
  /** Show label text alongside the icon */
  showLabel?: boolean;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusConfig(status: PMSConnectionStatus): {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
} {
  switch (status) {
    case "connected":
      return { color: "#22c55e", icon: "link", label: "PMS Connected" };
    case "disconnected":
      return { color: "#6b7280", icon: "unlink", label: "PMS Disconnected" };
    case "error":
      return { color: "#ef4444", icon: "alert-circle", label: "PMS Error" };
    case "unknown":
    default:
      return { color: "#6b7280", icon: "help-circle-outline", label: "PMS Unknown" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PMSStatusIndicator: React.FC<PMSStatusIndicatorProps> = React.memo(
  function PMSStatusIndicator({ showLabel = true, compact = false }) {
    const connectionStatus = usePMSStore((s) => s.connectionStatus);
    const isEnabled = usePMSStore((s) => s.isEnabled);
    const queueCount = usePMSStore((s) => s.chargeQueue.length);

    // Don't render anything if PMS is not enabled
    if (!isEnabled) return null;

    const config = getStatusConfig(connectionStatus);

    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <Ionicons
          name={config.icon}
          size={compact ? 14 : 16}
          color={config.color}
        />
        {showLabel && !compact && (
          <Text style={[styles.label, { color: config.color }]}>
            {config.label}
          </Text>
        )}
        {queueCount > 0 && (
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>{queueCount}</Text>
          </View>
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
  containerCompact: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
  queueBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  queueBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "700",
  },
});

export default PMSStatusIndicator;
