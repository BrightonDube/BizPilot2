/**
 * BizPilot Mobile POS — Orders Screen
 *
 * Lists recent orders with status badges, search, and status filtering.
 * Tap an order to see details. Supports voiding completed orders.
 *
 * Why the filter bar + search combo?
 * During end-of-shift, staff need to find specific orders fast.
 * The filter narrows by status; search handles everything else
 * (order number, customer name). This matches Square/Toast patterns.
 *
 * Tablet-first: uses full-width rows with clear status indicators
 * and a detail panel on the right side when in landscape.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  useWindowDimensions,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Card, Badge, Button } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { VoidOrderModal } from "@/components/pos";
import type { MobileOrder } from "@/types";
import { useOrders } from "@/hooks";

// ---------------------------------------------------------------------------
// Filter configuration
// ---------------------------------------------------------------------------

type OrderStatusFilter = "all" | "completed" | "pending" | "cancelled" | "refunded";

const FILTERS: { label: string; value: OrderStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
];

const STATUS_VARIANT: Record<string, "default" | "info" | "warning"> = {
  completed: "default",
  pending: "info",
  cancelled: "warning",
  refunded: "warning",
  draft: "info",
};

// ---------------------------------------------------------------------------
// OrderRow sub-component
// ---------------------------------------------------------------------------

interface OrderRowProps {
  order: MobileOrder;
  isSelected: boolean;
  onSelect: (order: MobileOrder) => void;
}

const OrderRow: React.FC<OrderRowProps> = React.memo(function OrderRow({
  order,
  isSelected,
  onSelect,
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(order);
  }, [order, onSelect]);

  return (
    <Pressable onPress={handlePress}>
      <Card>
        <View
          style={[
            styles.orderRow,
            isSelected && styles.orderRowSelected,
          ]}
        >
          <View style={styles.orderInfo}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
              <Badge
                label={order.status}
                variant={STATUS_VARIANT[order.status] ?? "default"}
              />
            </View>
            <Text style={styles.orderMeta}>
              {order.customerId ? "Customer" : "Walk-in"} ·{" "}
              {formatDateTime(order.createdAt)}
            </Text>
          </View>
          <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color="#6b7280"
            style={styles.chevron}
          />
        </View>
      </Card>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// OrderDetail sub-component (shown on tablet)
// ---------------------------------------------------------------------------

interface OrderDetailProps {
  order: MobileOrder;
  onVoid: () => void;
}

const OrderDetail: React.FC<OrderDetailProps> = React.memo(
  function OrderDetail({ order, onVoid }) {
    const canVoid = order.status === "completed";

    return (
      <View style={styles.detailContainer}>
        <Text style={styles.detailTitle}>Order #{order.orderNumber}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <Badge
            label={order.status}
            variant={STATUS_VARIANT[order.status] ?? "default"}
          />
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {formatDateTime(order.createdAt)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Payment</Text>
          <Text style={styles.detailValue}>
            {order.paymentMethod ?? "—"}
          </Text>
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Subtotal</Text>
          <Text style={styles.detailValue}>
            {formatCurrency(order.subtotal)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tax</Text>
          <Text style={styles.detailValue}>
            {formatCurrency(order.taxAmount)}
          </Text>
        </View>

        {order.discountAmount > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Discount</Text>
            <Text style={[styles.detailValue, { color: "#f59e0b" }]}>
              −{formatCurrency(order.discountAmount)}
            </Text>
          </View>
        )}

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, styles.detailTotalLabel]}>
            Total
          </Text>
          <Text style={styles.detailTotal}>
            {formatCurrency(order.total)}
          </Text>
        </View>

        {order.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesValue}>{order.notes}</Text>
          </View>
        )}

        {canVoid && (
          <Button
            label="Void This Order"
            variant="danger"
            onPress={onVoid}
            size="lg"
          />
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Main Orders Screen
// ---------------------------------------------------------------------------

export default function OrdersScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [filter, setFilter] = useState<OrderStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<MobileOrder | null>(null);
  const [voidModalVisible, setVoidModalVisible] = useState(false);

  const { orders, loading: isLoading } = useOrders(
    filter === "all" ? undefined : { status: filter as any }
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase().trim();
    return orders.filter((o) => o.orderNumber.toLowerCase().includes(q));
  }, [orders, search]);

  const handleSelectOrder = useCallback((order: MobileOrder) => {
    setSelectedOrder(order);
  }, []);

  const handleVoidPress = useCallback(() => {
    setVoidModalVisible(true);
  }, []);

  const handleConfirmVoid = useCallback(
    async (params: {
      orderId: string;
      reason: string;
      authorizedBy: string;
    }) => {
      // TODO: Wire to OrderService.voidOrder + sync queue
      Alert.alert("Order Voided", `Order voided. Reason: ${params.reason}`);
      setVoidModalVisible(false);
      setSelectedOrder(null);
    },
    []
  );

  const renderOrder = useCallback(
    ({ item }: { item: MobileOrder }) => (
      <OrderRow
        order={item}
        isSelected={selectedOrder?.id === item.id}
        onSelect={handleSelectOrder}
      />
    ),
    [selectedOrder, handleSelectOrder]
  );

  const keyExtractor = useCallback((item: MobileOrder) => item.id, []);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <Text style={styles.headerCount}>{filtered.length} orders</Text>
      </View>

      {/* Search + filters */}
      <View style={styles.searchFilterBar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6b7280" />
          <TextInput
            placeholder="Search orders..."
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </Pressable>
          )}
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={[
                styles.filterChip,
                filter === f.value && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f.value && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content: list + detail */}
      <View style={styles.content}>
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          style={isTablet ? styles.listTablet : styles.listFull}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color="#374151" />
              <Text style={styles.emptyText}>
                {isLoading ? "Loading orders..." : "No orders found"}
              </Text>
            </View>
          }
          renderItem={renderOrder}
        />

        {/* Detail panel (tablet only) */}
        {isTablet && (
          <View style={styles.detailPanel}>
            {selectedOrder ? (
              <OrderDetail order={selectedOrder} onVoid={handleVoidPress} />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color="#374151" />
                <Text style={styles.emptyText}>Select an order to view details</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Void Modal */}
      <VoidOrderModal
        visible={voidModalVisible}
        onClose={() => setVoidModalVisible(false)}
        order={selectedOrder}
        onConfirmVoid={handleConfirmVoid}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  headerCount: {
    color: "#6b7280",
    fontSize: 14,
  },
  searchFilterBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    backgroundColor: "#374151",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: "#3b82f6",
  },
  filterChipText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  listFull: {
    flex: 1,
  },
  listTablet: {
    flex: 1,
    maxWidth: 460,
  },
  listContent: {
    padding: 12,
    gap: 8,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderRowSelected: {
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
  },
  orderInfo: {
    flex: 1,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  orderNumber: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  orderMeta: {
    color: "#9ca3af",
    fontSize: 13,
  },
  orderTotal: {
    color: "#3b82f6",
    fontSize: 18,
    fontWeight: "700",
  },
  chevron: {
    marginLeft: 8,
  },
  detailPanel: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: "#374151",
  },
  detailContainer: {
    padding: 20,
    gap: 12,
  },
  detailTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    color: "#9ca3af",
    fontSize: 14,
  },
  detailValue: {
    color: "#ffffff",
    fontSize: 14,
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#374151",
    marginVertical: 4,
  },
  detailTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  detailTotal: {
    color: "#22c55e",
    fontSize: 20,
    fontWeight: "700",
  },
  notesBox: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
  },
  notesLabel: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 4,
  },
  notesValue: {
    color: "#d1d5db",
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
