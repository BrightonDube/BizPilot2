/**
 * BizPilot Mobile POS — RecentOrdersPanel Component
 *
 * Quick-access slide-out panel showing the last N completed orders.
 * Staff can view order details, reorder, or start a void.
 *
 * Why a quick-access panel instead of navigating to Orders tab?
 * During active service, switching tabs breaks the POS flow.
 * Common actions like "what was that last order?" or "the customer
 * wants the same again" need to be accessible without leaving the
 * POS screen. The Orders tab has full search/filter for end-of-day.
 *
 * Why limit to 10 orders?
 * More than 10 recent orders is unlikely to be needed during active
 * POS use. The FlatList keeps rendering efficient, and the full
 * orders list is available in the Orders tab.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Badge } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import type { MobileOrder } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecentOrdersPanelProps {
  /** Whether the panel is visible */
  visible: boolean;
  /** Called when the panel should close */
  onClose: () => void;
  /** Recent orders to display (max 10 recommended) */
  orders: MobileOrder[];
  /** Whether orders are loading */
  isLoading?: boolean;
  /** Called when an order is selected for detail view */
  onSelectOrder?: (order: MobileOrder) => void;
  /** Called when user wants to void an order */
  onVoidOrder?: (order: MobileOrder) => void;
  /** Called when user wants to reorder (add same items to cart) */
  onReorder?: (order: MobileOrder) => void;
}

// ---------------------------------------------------------------------------
// Status badge color mapping
// ---------------------------------------------------------------------------

const STATUS_VARIANTS: Record<string, "default" | "info" | "warning"> = {
  completed: "default",
  pending: "info",
  cancelled: "warning",
  refunded: "warning",
  draft: "info",
};

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

function formatOrderTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

// ---------------------------------------------------------------------------
// OrderRow sub-component
// ---------------------------------------------------------------------------

interface OrderRowProps {
  order: MobileOrder;
  onSelect?: (order: MobileOrder) => void;
  onVoid?: (order: MobileOrder) => void;
  onReorder?: (order: MobileOrder) => void;
}

const OrderRow: React.FC<OrderRowProps> = React.memo(function OrderRow({
  order,
  onSelect,
  onVoid,
  onReorder,
}) {
  const handleSelect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect?.(order);
  }, [order, onSelect]);

  const handleVoid = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onVoid?.(order);
  }, [order, onVoid]);

  const handleReorder = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReorder?.(order);
  }, [order, onReorder]);

  const canVoid = order.status === "completed";
  const canReorder = order.status === "completed";

  return (
    <Pressable onPress={handleSelect} style={styles.row}>
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <Badge
            label={order.status}
            variant={STATUS_VARIANTS[order.status] ?? "default"}
          />
        </View>

        <View style={styles.rowDetails}>
          <Text style={styles.orderTotal}>
            {formatCurrency(order.total)}
          </Text>
          <Text style={styles.orderMethod}>
            {order.paymentMethod ?? "—"}
          </Text>
          <Text style={styles.orderTime}>
            {formatOrderTime(order.createdAt)}
          </Text>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.rowActions}>
        {canReorder && onReorder && (
          <Pressable
            onPress={handleReorder}
            style={styles.actionButton}
            accessibilityLabel={`Reorder ${order.orderNumber}`}
          >
            <Ionicons name="repeat-outline" size={18} color="#3b82f6" />
          </Pressable>
        )}
        {canVoid && onVoid && (
          <Pressable
            onPress={handleVoid}
            style={styles.actionButton}
            accessibilityLabel={`Void order ${order.orderNumber}`}
          >
            <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const RecentOrdersPanel: React.FC<RecentOrdersPanelProps> = React.memo(
  function RecentOrdersPanel({
    visible,
    onClose,
    orders,
    isLoading = false,
    onSelectOrder,
    onVoidOrder,
    onReorder,
  }) {
    const recentOrders = useMemo(() => orders.slice(0, 10), [orders]);

    const renderItem = useCallback(
      ({ item }: { item: MobileOrder }) => (
        <OrderRow
          order={item}
          onSelect={onSelectOrder}
          onVoid={onVoidOrder}
          onReorder={onReorder}
        />
      ),
      [onSelectOrder, onVoidOrder, onReorder]
    );

    const keyExtractor = useCallback(
      (item: MobileOrder) => item.id,
      []
    );

    return (
      <Modal visible={visible} onClose={onClose} title="Recent Orders">
        {isLoading ? (
          <View style={styles.centeredContainer}>
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        ) : recentOrders.length === 0 ? (
          <View style={styles.centeredContainer}>
            <Ionicons name="receipt-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>No recent orders</Text>
            <Text style={styles.emptySubtext}>
              Completed orders will appear here
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.countText}>
              Last {recentOrders.length} order
              {recentOrders.length !== 1 ? "s" : ""}
            </Text>
            <FlatList
              data={recentOrders}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </Modal>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  countText: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 8,
  },
  list: {
    maxHeight: 400,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  rowMain: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  orderNumber: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  rowDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderTotal: {
    color: "#22c55e",
    fontSize: 15,
    fontWeight: "700",
  },
  orderMethod: {
    color: "#9ca3af",
    fontSize: 13,
  },
  orderTime: {
    color: "#6b7280",
    fontSize: 12,
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
  },
  centeredContainer: {
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtext: {
    color: "#4b5563",
    fontSize: 13,
    textAlign: "center",
  },
});

export default RecentOrdersPanel;
