/**
 * OrderHistoryScreen — searchable, filterable list of past orders.
 * (order-management task 13.1, 13.2)
 *
 * Layout: Full-screen with search bar + filter row at top, FlatList below.
 *
 * Why FlatList instead of ScrollView?
 * Order history can contain thousands of orders. FlatList virtualises
 * off-screen rows, keeping memory usage constant regardless of list size.
 *
 * Why local filtering in useMemo?
 * For a POS tablet, the most recent ~500 orders are already synced
 * locally via WatermelonDB. Filtering locally avoids network round-trips
 * and keeps the UI responsive even when offline.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import {
  HistoricalOrder,
  OrderHistoryFilters,
  SortField,
  ORDER_STATUS_OPTIONS,
  ORDER_TYPE_OPTIONS,
  STATUS_COLORS,
  filterOrders,
  sortOrders,
  formatOrderDate,
} from "@/services/orders/OrderHistoryService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OrderHistoryScreenProps {
  /** All orders available locally. */
  orders: HistoricalOrder[];
  /** Called when user taps an order to view details. */
  onSelectOrder: (order: HistoricalOrder) => void;
  /** Called when user requests reprint. */
  onReprint?: (order: HistoricalOrder) => void;
  /** Called when user requests refund. */
  onRefund?: (order: HistoricalOrder) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function OrderHistoryScreenInner({
  orders,
  onSelectOrder,
  onReprint,
  onRefund,
}: OrderHistoryScreenProps) {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [filters, setFilters] = useState<OrderHistoryFilters>({
    searchQuery: "",
    status: "all",
    orderType: "all",
  });
  const [sortField, setSortField] = useState<SortField>("date_desc");
  const [showFilters, setShowFilters] = useState(false);

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------
  const filteredOrders = useMemo(() => {
    const filtered = filterOrders(orders, filters);
    return sortOrders(filtered, sortField);
  }, [orders, filters, sortField]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleSearchChange = useCallback((text: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: text }));
  }, []);

  const handleStatusChange = useCallback((status: typeof filters.status) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const handleTypeChange = useCallback((orderType: typeof filters.orderType) => {
    setFilters((prev) => ({ ...prev, orderType }));
  }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  // -------------------------------------------------------------------------
  // Render item
  // -------------------------------------------------------------------------
  const renderOrderRow = useCallback(
    ({ item }: ListRenderItemInfo<HistoricalOrder>) => {
      const statusColor = STATUS_COLORS[item.status];
      return (
        <TouchableOpacity
          style={styles.orderRow}
          onPress={() => onSelectOrder(item)}
          testID={`order-row-${item.id}`}
        >
          <View style={styles.orderRowLeft}>
            <View style={styles.orderNumberRow}>
              <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {item.status.replace("_", " ")}
                </Text>
              </View>
            </View>
            <Text style={styles.orderMeta}>
              {formatOrderDate(item.createdAt)} · {item.orderType.replace("_", " ")} · {item.staffName}
            </Text>
            {item.customerName && (
              <Text style={styles.customerName}>{item.customerName}</Text>
            )}
            <Text style={styles.itemCount}>
              {item.items.length} item{item.items.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <View style={styles.orderRowRight}>
            <Text style={styles.orderTotal}>{formatCurrency(item.total)}</Text>
            {item.paymentMethod && (
              <Text style={styles.paymentMethod}>{item.paymentMethod}</Text>
            )}
            <View style={styles.actionRow}>
              {onReprint && (
                <TouchableOpacity
                  onPress={() => onReprint(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  testID={`reprint-${item.id}`}
                >
                  <Ionicons name="print-outline" size={20} color="#6b7280" />
                </TouchableOpacity>
              )}
              {onRefund && item.status === "completed" && (
                <TouchableOpacity
                  onPress={() => onRefund(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  testID={`refund-${item.id}`}
                >
                  <Ionicons name="arrow-undo-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [onSelectOrder, onReprint, onRefund]
  );

  const keyExtractor = useCallback((item: HistoricalOrder) => item.id, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <View style={styles.container} testID="order-history-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order History</Text>
        <Text style={styles.headerCount}>{filteredOrders.length} orders</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders, customers, items..."
            placeholderTextColor="#6b7280"
            value={filters.searchQuery}
            onChangeText={handleSearchChange}
            testID="search-input"
          />
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={toggleFilters}
          testID="filter-toggle"
        >
          <Ionicons name="options" size={20} color={showFilters ? "#3b82f6" : "#9ca3af"} />
        </TouchableOpacity>
      </View>

      {/* Filter row (collapsible) */}
      {showFilters && (
        <View style={styles.filterRow} testID="filter-panel">
          {/* Status pills */}
          <View style={styles.pillRow}>
            {ORDER_STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pill,
                  filters.status === opt.value && styles.pillActive,
                ]}
                onPress={() => handleStatusChange(opt.value)}
                testID={`filter-status-${opt.value}`}
              >
                <Text
                  style={[
                    styles.pillText,
                    filters.status === opt.value && styles.pillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Type pills */}
          <View style={styles.pillRow}>
            {ORDER_TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pill,
                  filters.orderType === opt.value && styles.pillActive,
                ]}
                onPress={() => handleTypeChange(opt.value)}
                testID={`filter-type-${opt.value}`}
              >
                <Text
                  style={[
                    styles.pillText,
                    filters.orderType === opt.value && styles.pillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Order list */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderRow}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        }
        testID="order-list"
      />
    </View>
  );
}

export const OrderHistoryScreen = React.memo(OrderHistoryScreenInner);

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
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#f3f4f6" },
  headerCount: { fontSize: 14, color: "#9ca3af" },
  /* Search */
  searchRow: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 16,
    paddingVertical: 12,
  },
  filterToggle: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f2937",
    borderRadius: 10,
  },
  filterToggleActive: {
    backgroundColor: "#1e3a5f",
  },
  /* Filters */
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1f2937",
  },
  pillActive: {
    backgroundColor: "#1e3a5f",
  },
  pillText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "500",
  },
  pillTextActive: {
    color: "#3b82f6",
  },
  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 64,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    marginTop: 12,
  },
  /* Order row */
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  orderRowLeft: { flex: 1, gap: 4 },
  orderRowRight: { alignItems: "flex-end", gap: 6 },
  orderNumberRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderNumber: { fontSize: 16, fontWeight: "700", color: "#f3f4f6" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  orderMeta: { fontSize: 12, color: "#6b7280" },
  customerName: { fontSize: 13, color: "#d1d5db" },
  itemCount: { fontSize: 12, color: "#6b7280" },
  orderTotal: { fontSize: 18, fontWeight: "700", color: "#f3f4f6" },
  paymentMethod: { fontSize: 12, color: "#9ca3af", textTransform: "capitalize" },
  actionRow: { flexDirection: "row", gap: 16 },
});
