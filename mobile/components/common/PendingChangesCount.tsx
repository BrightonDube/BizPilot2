/**
 * BizPilot Mobile POS — PendingChangesCount Component
 *
 * A badge/pill showing the number of unsynced changes.
 *
 * Why show pending count prominently?
 * In a POS context, unsynced orders mean the server doesn't know
 * about them yet. If the device dies, those orders could be lost.
 * Showing the count creates urgency to sync (or at minimum, awareness).
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSyncStore } from "@/stores/syncStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PendingChangesCountProps {
  /** Show even when count is 0. Defaults to false (hidden at 0). */
  showZero?: boolean;
  /** Size variant for the badge */
  size?: "sm" | "md";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PendingChangesCount: React.FC<PendingChangesCountProps> = React.memo(
  function PendingChangesCount({ showZero = false, size = "md" }) {
    const pendingChanges = useSyncStore((s) => s.pendingChanges);

    if (pendingChanges === 0 && !showZero) return null;

    const isWarning = pendingChanges > 10;
    const isDanger = pendingChanges > 50;

    const bgColor = isDanger
      ? "#ef4444"
      : isWarning
      ? "#f59e0b"
      : "#3b82f6";

    return (
      <View
        style={[
          styles.badge,
          size === "sm" && styles.badgeSm,
          { backgroundColor: bgColor },
        ]}
        accessibilityLabel={`${pendingChanges} pending changes`}
        accessibilityRole="text"
      >
        <Text style={[styles.text, size === "sm" && styles.textSm]}>
          {pendingChanges}
        </Text>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeSm: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
  },
  text: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  textSm: {
    fontSize: 10,
  },
});

export default PendingChangesCount;
