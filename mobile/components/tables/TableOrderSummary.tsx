/**
 * TableOrderSummary — pop-up card showing the active order at a table.
 * (order-management task 4.4)
 *
 * Layout: An overlay card anchored near the selected table tile, showing:
 *   - Table name and status
 *   - Order items (scrollable if many)
 *   - Order total
 *   - Quick action buttons (view full order, transfer table, close)
 *
 * Why a floating card instead of a full modal?
 * The operator glances at a table summary dozens of times per shift. A
 * lightweight card keeps the floor plan visible underneath so they can
 * quickly tap another table. A full modal would be too heavyweight for
 * this high-frequency micro-interaction.
 */

import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TableRecord, TableStatus } from "@/services/order/TableService";
import type { ManagedOrder } from "@/services/order/OrderManagementService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableOrderSummaryProps {
  /** The selected table. */
  table: TableRecord;
  /** The active order at this table, or null if none. */
  order: ManagedOrder | null;
  /** Called to view the full order in the order screen. */
  onViewOrder?: (orderId: string) => void;
  /** Called to transfer the order to another table. */
  onTransferTable?: (orderId: string) => void;
  /** Called to close/dismiss this summary card. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<TableStatus, string> = {
  available: "#22c55e",
  occupied: "#3b82f6",
  reserved: "#fbbf24",
  dirty: "#6b7280",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const TableOrderSummary: React.FC<TableOrderSummaryProps> = React.memo(
  function TableOrderSummary({
    table,
    order,
    onViewOrder,
    onTransferTable,
    onClose,
  }) {
    const total = useMemo(() => {
      if (!order) return 0;
      return order.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
    }, [order]);

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View
              style={[styles.statusDot, { backgroundColor: STATUS_COLORS[table.status] }]}
            />
            <Text style={styles.tableName}>{table.name}</Text>
            <Text style={styles.statusLabel}>({table.status})</Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close table summary">
            <Ionicons name="close" size={24} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {order ? (
          <>
            <Text style={styles.orderLabel}>
              Order #{order.id.slice(-6).toUpperCase()} · {order.orderType}
            </Text>
            <ScrollView style={styles.itemList} nestedScrollEnabled>
              {order.items.map((item, idx) => (
                <View key={`${item.name}-${idx}`} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{item.quantity}×</Text>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>
                    R {(item.quantity * item.unitPrice).toFixed(2)}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R {total.toFixed(2)}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {onViewOrder && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onViewOrder(order.id)}
                  accessibilityLabel="View full order"
                >
                  <Ionicons name="eye-outline" size={18} color="#3b82f6" />
                  <Text style={styles.actionText}>View</Text>
                </TouchableOpacity>
              )}
              {onTransferTable && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onTransferTable(order.id)}
                  accessibilityLabel="Transfer table"
                >
                  <Ionicons name="swap-horizontal" size={18} color="#fbbf24" />
                  <Text style={styles.actionText}>Transfer</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyOrder}>
            <Ionicons name="receipt-outline" size={32} color="#4b5563" />
            <Text style={styles.emptyText}>No active order</Text>
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
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 16,
    padding: 18,
    width: 320,
    maxHeight: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  tableName: { fontSize: 18, fontWeight: "700", color: "#f3f4f6" },
  statusLabel: { fontSize: 13, color: "#9ca3af" },
  orderLabel: { fontSize: 13, color: "#9ca3af", marginBottom: 8 },
  itemList: { maxHeight: 180 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  itemQty: { fontSize: 14, fontWeight: "600", color: "#d1d5db", width: 30 },
  itemName: { flex: 1, fontSize: 14, color: "#f3f4f6" },
  itemPrice: { fontSize: 14, color: "#d1d5db", fontWeight: "500" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#4b5563",
  },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#f3f4f6" },
  totalValue: { fontSize: 16, fontWeight: "700", color: "#22c55e" },
  actions: { flexDirection: "row", gap: 12, marginTop: 14 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
  },
  actionText: { fontSize: 13, color: "#d1d5db", fontWeight: "600" },
  emptyOrder: { alignItems: "center", paddingVertical: 24 },
  emptyText: { fontSize: 14, color: "#6b7280", marginTop: 8 },
});

export default TableOrderSummary;
