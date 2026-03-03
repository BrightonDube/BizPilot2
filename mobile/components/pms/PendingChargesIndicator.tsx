/**
 * BizPilot Mobile POS — PendingChargesIndicator Component
 *
 * Shows the number of room charges waiting in the offline queue.
 * Tapping opens a list of queued charges with their status.
 *
 * Why show pending charges prominently?
 * Queued room charges are a liability — the hotel hasn't received
 * them yet. If the device dies before syncing, those charges are lost.
 * Showing a persistent count creates urgency to sync or ensures
 * staff are aware when operating offline.
 */

import React, { useState, useCallback } from "react";
import { View, Text, Pressable, FlatList, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import { usePMSStore } from "@/stores/pmsStore";
import type { PMSChargeQueueItem } from "@/types/pms";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PendingChargesIndicatorProps {
  /** Hide when queue is empty. Defaults to true. */
  hideWhenEmpty?: boolean;
}

// ---------------------------------------------------------------------------
// Queue item row
// ---------------------------------------------------------------------------

interface QueueItemRowProps {
  item: PMSChargeQueueItem;
}

const QueueItemRow: React.FC<QueueItemRowProps> = React.memo(function QueueItemRow({ item }) {
  return (
    <View style={styles.queueItemRow}>
      <View style={styles.queueItemInfo}>
        <Text style={styles.queueItemGuest}>
          {item.charge.guestName} · Room {item.charge.roomNumber}
        </Text>
        <Text style={styles.queueItemDesc}>{item.charge.description}</Text>
        <Text style={styles.queueItemMeta}>
          Queued: {new Date(item.queuedAt).toLocaleTimeString()} · Attempts: {item.attempts}
        </Text>
        {item.lastError && (
          <Text style={styles.queueItemError}>{item.lastError}</Text>
        )}
      </View>
      <Text style={styles.queueItemAmount}>
        {formatCurrency(item.charge.amount)}
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PendingChargesIndicator: React.FC<PendingChargesIndicatorProps> = React.memo(
  function PendingChargesIndicator({ hideWhenEmpty = true }) {
    const chargeQueue = usePMSStore((s) => s.chargeQueue);
    const isEnabled = usePMSStore((s) => s.isEnabled);
    const [detailVisible, setDetailVisible] = useState(false);

    const handlePress = useCallback(() => {
      if (chargeQueue.length === 0) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDetailVisible(true);
    }, [chargeQueue.length]);

    if (!isEnabled) return null;
    if (hideWhenEmpty && chargeQueue.length === 0) return null;

    const totalAmount = chargeQueue.reduce((sum, item) => sum + item.charge.amount, 0);

    return (
      <>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.indicator,
            pressed && styles.indicatorPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${chargeQueue.length} pending room charges`}
        >
          <Ionicons name="hourglass-outline" size={16} color="#f59e0b" />
          <Text style={styles.indicatorText}>
            {chargeQueue.length} pending charge{chargeQueue.length !== 1 ? "s" : ""}
          </Text>
          <Text style={styles.indicatorAmount}>{formatCurrency(totalAmount)}</Text>
        </Pressable>

        {/* Detail modal */}
        <Modal
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          title="Pending Room Charges"
        >
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>
              {chargeQueue.length} charges · Total: {formatCurrency(totalAmount)}
            </Text>
          </View>

          <FlatList
            data={chargeQueue}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <QueueItemRow item={item} />}
            contentContainerStyle={{ paddingBottom: 16 }}
            style={{ maxHeight: 400 }}
          />

          <Text style={styles.helpText}>
            These charges will be posted to the PMS automatically when connectivity is restored.
          </Text>
        </Modal>
      </>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  indicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1c1917",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#78350f",
  },
  indicatorPressed: {
    backgroundColor: "#292524",
  },
  indicatorText: {
    color: "#f59e0b",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  indicatorAmount: {
    color: "#fbbf24",
    fontSize: 13,
    fontWeight: "700",
  },
  summaryBar: {
    backgroundColor: "#1f2937",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  summaryText: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  queueItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemGuest: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  queueItemDesc: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  queueItemMeta: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 4,
  },
  queueItemError: {
    color: "#ef4444",
    fontSize: 11,
    marginTop: 2,
  },
  queueItemAmount: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 12,
  },
  helpText: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    fontStyle: "italic",
  },
});

export default PendingChargesIndicator;
