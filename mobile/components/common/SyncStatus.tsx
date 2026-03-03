/**
 * BizPilot Mobile POS — Sync Status Indicator
 *
 * Shows the current sync state in a compact bar.
 * Appears at the top of screens to inform the operator
 * about connectivity and pending changes.
 *
 * Why always visible?
 * In a POS environment, staff need constant awareness of
 * whether the device is synced. A hidden indicator means
 * they might process transactions without realizing data
 * hasn't been pushed to the server.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSyncStore } from "@/stores/syncStore";
import { formatRelativeTime } from "@/utils/formatters";

const SyncStatus: React.FC = React.memo(function SyncStatus() {
  const status = useSyncStore((s) => s.status);
  const isOnline = useSyncStore((s) => s.isOnline);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const pendingChanges = useSyncStore((s) => s.pendingChanges);

  // Color coding for quick visual assessment
  const dotColor = !isOnline
    ? "#ef4444" // Red: offline
    : status === "syncing"
    ? "#f59e0b" // Amber: syncing
    : status === "error"
    ? "#ef4444" // Red: error
    : pendingChanges > 0
    ? "#f59e0b" // Amber: has pending changes
    : "#22c55e"; // Green: all synced

  const statusText = !isOnline
    ? "Offline"
    : status === "syncing"
    ? "Syncing..."
    : status === "error"
    ? "Sync Error"
    : pendingChanges > 0
    ? `${pendingChanges} pending`
    : "Synced";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: "#111827",
        borderBottomWidth: 1,
        borderBottomColor: "#1f2937",
      }}
    >
      {/* Status dot */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dotColor,
          marginRight: 8,
        }}
      />

      {/* Status text */}
      <Text style={{ color: "#9ca3af", fontSize: 12, flex: 1 }}>
        {statusText}
      </Text>

      {/* Last sync time */}
      {lastSyncAt && (
        <Text style={{ color: "#6b7280", fontSize: 11 }}>
          Last: {formatRelativeTime(lastSyncAt)}
        </Text>
      )}
    </View>
  );
});

export default SyncStatus;
