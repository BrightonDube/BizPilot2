/**
 * OrderDetailView — expanded view of a single historical order.
 * (order-management task 13.3)
 *
 * Displays: order header (number, status, date, staff), item table,
 * payment summary, and action buttons (reprint, refund).
 *
 * Why a separate detail component?
 * The list row shows a summary; tapping it opens the full detail.
 * This pattern keeps the list lightweight and lets the detail view
 * lazy-load additional data (e.g., payment transactions) if needed.
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  HistoricalOrder,
  STATUS_COLORS,
  calculateOrderDuration,
  formatOrderDate,
} from "@/services/orders/OrderHistoryService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OrderDetailViewProps {
  order: HistoricalOrder;
  onClose: () => void;
  onReprint?: (order: HistoricalOrder) => void;
  onRefund?: (order: HistoricalOrder) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function OrderDetailViewInner({
  order,
  onClose,
  onReprint,
  onRefund,
}: OrderDetailViewProps) {
  const statusColor = STATUS_COLORS[order.status];
  const duration = useMemo(() => calculateOrderDuration(order), [order]);

  return (
    <View style={styles.container} testID="order-detail-view">
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
          <Text style={styles.orderDate}>{formatOrderDate(order.createdAt)}</Text>
        </View>
        <TouchableOpacity onPress={onClose} testID="close-detail">
          <Ionicons name="close" size={28} color="#f3f4f6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* Info cards */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {order.status.replace("_", " ")}
              </Text>
            </View>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>{order.orderType.replace("_", " ")}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Staff</Text>
            <Text style={styles.infoValue}>{order.staffName}</Text>
          </View>
          {duration && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{duration}</Text>
            </View>
          )}
        </View>

        {/* Customer & table */}
        {(order.customerName || order.tableName) && (
          <View style={styles.section}>
            {order.customerName && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color="#6b7280" />
                <Text style={styles.detailText}>{order.customerName}</Text>
              </View>
            )}
            {order.tableName && (
              <View style={styles.detailRow}>
                <Ionicons name="grid-outline" size={16} color="#6b7280" />
                <Text style={styles.detailText}>{order.tableName}</Text>
              </View>
            )}
          </View>
        )}

        {/* Items table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items.map((item, index) => (
            <View key={item.id} style={styles.itemRow} testID={`item-row-${index}`}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemQty}>{item.quantity}×</Text>
                <View>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <Text style={styles.itemModifiers}>
                      {item.modifiers.join(", ")}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.itemTotal}>{formatCurrency(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.tax)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(order.total)}</Text>
          </View>
          {order.paymentMethod && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Payment</Text>
              <Text style={styles.totalValue}>{order.paymentMethod}</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {order.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        )}
      </ScrollView>

      {/* Actions */}
      <View style={styles.footer}>
        {onReprint && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onReprint(order)}
            testID="reprint-button"
          >
            <Ionicons name="print-outline" size={20} color="#f3f4f6" />
            <Text style={styles.actionButtonText}>Reprint</Text>
          </TouchableOpacity>
        )}
        {onRefund && order.status === "completed" && (
          <TouchableOpacity
            style={[styles.actionButton, styles.refundButton]}
            onPress={() => onRefund(order)}
            testID="refund-button"
          >
            <Ionicons name="arrow-undo-outline" size={20} color="#ef4444" />
            <Text style={[styles.actionButtonText, styles.refundButtonText]}>
              Refund
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export const OrderDetailView = React.memo(OrderDetailViewInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  orderNumber: { fontSize: 20, fontWeight: "700", color: "#f3f4f6" },
  orderDate: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 16 },
  /* Info cards */
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  infoCard: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 12,
    minWidth: 100,
    alignItems: "center",
  },
  infoLabel: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f3f4f6",
    textTransform: "capitalize",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  /* Detail rows */
  section: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 12,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  detailText: { color: "#d1d5db", fontSize: 14 },
  /* Items */
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  itemLeft: { flexDirection: "row", gap: 10, flex: 1 },
  itemQty: { color: "#9ca3af", fontSize: 14, fontWeight: "600", minWidth: 30 },
  itemName: { color: "#f3f4f6", fontSize: 14 },
  itemModifiers: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  itemTotal: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  /* Totals */
  totalsSection: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: { color: "#9ca3af", fontSize: 14 },
  totalValue: { color: "#f3f4f6", fontSize: 14, fontWeight: "500" },
  divider: { height: 1, backgroundColor: "#374151", marginVertical: 8 },
  grandTotalLabel: { color: "#f3f4f6", fontSize: 16, fontWeight: "700" },
  grandTotalValue: { color: "#f3f4f6", fontSize: 18, fontWeight: "700" },
  notesText: { color: "#d1d5db", fontSize: 14, lineHeight: 20 },
  /* Footer */
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#1e293b",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#374151",
  },
  actionButtonText: { color: "#f3f4f6", fontSize: 16, fontWeight: "600" },
  refundButton: { borderWidth: 1, borderColor: "#ef4444", backgroundColor: "transparent" },
  refundButtonText: { color: "#ef4444" },
});
