/**
 * OrderStatusTracker — real-time order status list with age timers and alerts.
 * (order-management tasks 6.1, 6.2, 6.3, 6.4)
 *
 * Layout: A vertical list of order cards, each showing:
 *   - Order ID (truncated), order type, table name
 *   - Current status with colour-coded badge
 *   - Age/wait time (auto-updating via setInterval)
 *   - Red highlight when order exceeds the alert threshold
 *
 * Why setInterval for timers instead of a single global timer?
 * Each card needs its own "age" display, but we use a single global interval
 * in the parent hook to avoid N timers for N orders. The component re-renders
 * every tick with the new `now` prop, and each card computes its own age via
 * simple subtraction. This is O(1) per card per tick with no Date.now() calls
 * inside the render loop.
 *
 * Why does this accept `now` as a prop?
 * Injecting `now` makes the component pure and testable — tests can freeze
 * time without mocking Date.now().
 */

import React, { useCallback, useMemo } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ManagedOrder, OrderStatus } from "@/services/order/OrderManagementService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderStatusTrackerProps {
  /** All active orders (not yet paid/cancelled). */
  orders: ManagedOrder[];
  /** Current timestamp (ms). Parent drives this via setInterval for live age. */
  now: number;
  /** Alert threshold in minutes. Orders older than this show a warning. */
  alertThresholdMinutes?: number;
  /** Called when a specific order card is tapped. */
  onSelectOrder: (order: ManagedOrder) => void;
  /** Filter by order status. If omitted, all orders shown. */
  statusFilter?: OrderStatus;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<OrderStatus, string> = {
  new: "#3b82f6",
  sent: "#8b5cf6",
  preparing: "#f97316",
  ready: "#22c55e",
  served: "#14b8a6",
  paid: "#6b7280",
  cancelled: "#ef4444",
};

const STATUS_ICONS: Record<OrderStatus, string> = {
  new: "add-circle",
  sent: "paper-plane",
  preparing: "flame",
  ready: "checkmark-circle",
  served: "restaurant",
  paid: "card",
  cancelled: "close-circle",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAge(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface OrderCardProps {
  order: ManagedOrder;
  ageMs: number;
  isAlert: boolean;
  onPress: (order: ManagedOrder) => void;
}

const OrderCard = React.memo(function OrderCard({
  order,
  ageMs,
  isAlert,
  onPress,
}: OrderCardProps) {
  const color = STATUS_COLORS[order.status];
  const icon = STATUS_ICONS[order.status];

  return (
    <TouchableOpacity
      style={[styles.card, isAlert && styles.cardAlert]}
      onPress={() => onPress(order)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id.slice(-6)}, status ${order.status}, age ${formatAge(ageMs)}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={styles.orderId}>#{order.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.orderType}>{order.orderType}</Text>
          {order.tableId && (
            <Text style={styles.tableName}>Table {order.tableId.slice(-4)}</Text>
          )}
        </View>
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: color }]}>
            <Ionicons name={icon as any} size={14} color="#fff" />
            <Text style={styles.statusText}>{order.status}</Text>
          </View>
          <Text style={[styles.ageText, isAlert && styles.ageAlert]}>
            {formatAge(ageMs)}
          </Text>
          {isAlert && (
            <Ionicons
              name="warning"
              size={18}
              color="#ef4444"
              style={styles.alertIcon}
            />
          )}
        </View>
      </View>
      {/* Item preview */}
      <Text style={styles.itemPreview} numberOfLines={1}>
        {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
      </Text>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const OrderStatusTracker: React.FC<OrderStatusTrackerProps> = React.memo(
  function OrderStatusTracker({
    orders,
    now,
    alertThresholdMinutes = 15,
    onSelectOrder,
    statusFilter,
  }) {
    const alertThresholdMs = alertThresholdMinutes * 60000;

    const filteredOrders = useMemo(() => {
      if (!statusFilter) return orders;
      return orders.filter((o) => o.status === statusFilter);
    }, [orders, statusFilter]);

    // Sort by oldest first (longest wait at top)
    const sortedOrders = useMemo(
      () =>
        [...filteredOrders].sort(
          (a, b) =>
            new Date(a.statusHistory[0]?.timestamp ?? a.id).getTime() -
            new Date(b.statusHistory[0]?.timestamp ?? b.id).getTime()
        ),
      [filteredOrders]
    );

    const alertCount = useMemo(() => {
      return sortedOrders.filter((o) => {
        const created = new Date(o.statusHistory[0]?.timestamp ?? now).getTime();
        return now - created > alertThresholdMs;
      }).length;
    }, [sortedOrders, now, alertThresholdMs]);

    const handlePress = useCallback(
      (order: ManagedOrder) => onSelectOrder(order),
      [onSelectOrder]
    );

    const renderItem = useCallback(
      ({ item }: { item: ManagedOrder }) => {
        const created = new Date(
          item.statusHistory[0]?.timestamp ?? now
        ).getTime();
        const ageMs = now - created;
        const isAlert = ageMs > alertThresholdMs;

        return (
          <OrderCard
            order={item}
            ageMs={ageMs}
            isAlert={isAlert}
            onPress={handlePress}
          />
        );
      },
      [now, alertThresholdMs, handlePress]
    );

    const keyExtractor = useCallback((item: ManagedOrder) => item.id, []);

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Active Orders</Text>
          {alertCount > 0 && (
            <View style={styles.alertBadge}>
              <Ionicons name="warning" size={14} color="#fff" />
              <Text style={styles.alertBadgeText}>{alertCount} overdue</Text>
            </View>
          )}
        </View>

        {/* Order list */}
        {sortedOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>No active orders</Text>
          </View>
        ) : (
          <FlatList
            data={sortedOrders}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#f3f4f6" },
  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  list: { paddingBottom: 24 },
  card: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#374151",
  },
  cardAlert: {
    borderLeftColor: "#ef4444",
    backgroundColor: "#1c1917",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: "flex-end" },
  orderId: { fontSize: 16, fontWeight: "700", color: "#f3f4f6" },
  orderType: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  tableName: { fontSize: 12, color: "#9ca3af" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: "700", color: "#fff", textTransform: "uppercase" },
  ageText: { fontSize: 13, color: "#d1d5db", marginTop: 4 },
  ageAlert: { color: "#ef4444", fontWeight: "700" },
  alertIcon: { marginTop: 2 },
  itemPreview: { fontSize: 13, color: "#6b7280" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: { fontSize: 16, color: "#6b7280", marginTop: 12 },
});

export default OrderStatusTracker;
