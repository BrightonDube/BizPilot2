/**
 * OrderDisplay — Customer-facing order display showing cart items in real-time.
 *
 * Designed for tablet-mounted customer displays at POS terminals.
 * Uses dark theme for readability in varied lighting conditions.
 * New items animate in with a blue highlight that fades after 2 seconds
 * to draw customer attention without being distracting.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ─── Types ───────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  modifiers?: string[];
}

interface OrderDisplayProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  /** ID of the most-recently added item; triggers a 2-second highlight. */
  newItemId?: string | null;
  customerName?: string;
  isLoading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Format a number as South African Rand for customer-facing display. */
const formatCurrency = (value: number): string =>
  `R ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

// ─── Theme ───────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  text: "#f3f4f6",
  muted: "#9ca3af",
  accent: "#3b82f6",
  green: "#22c55e",
  border: "#374151",
} as const;

// ─── Sub-components ──────────────────────────────────────────────────

interface OrderItemRowProps {
  item: CartItem;
  isNew: boolean;
}

/**
 * Single cart-item row.
 * Memoised so only the affected row re-renders when the cart changes.
 */
const OrderItemRow = React.memo<OrderItemRowProps>(({ item, isNew }) => (
  <View
    testID={isNew ? "order-new-item" : `order-item-${item.id}`}
    style={[styles.itemRow, isNew && styles.itemRowHighlight]}
  >
    <View style={styles.itemLeft}>
      <View style={styles.itemNameRow}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.quantityBadge}>
          <Text style={styles.quantityText}>×{item.quantity}</Text>
        </View>
      </View>

      {item.modifiers && item.modifiers.length > 0 && (
        <Text style={styles.modifiers} numberOfLines={1}>
          {item.modifiers.join(", ")}
        </Text>
      )}
    </View>

    <Text style={styles.lineTotal}>{formatCurrency(item.lineTotal)}</Text>
  </View>
));

OrderItemRow.displayName = "OrderItemRow";

// ─── Main Component ──────────────────────────────────────────────────

const OrderDisplay: React.FC<OrderDisplayProps> = ({
  items,
  subtotal,
  tax,
  discount,
  total,
  newItemId = null,
  customerName,
  isLoading = false,
}) => {
  // Track highlighted item locally so it auto-clears after 2 s
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    if (!newItemId) return;

    setHighlightedId(newItemId);

    // Clear highlight after 2 s to avoid stale visual cues
    const timer = setTimeout(() => setHighlightedId(null), 2000);
    return () => clearTimeout(timer);
  }, [newItemId]);

  const renderItem = useCallback(
    ({ item }: { item: CartItem }) => (
      <OrderItemRow item={item} isNew={item.id === highlightedId} />
    ),
    [highlightedId],
  );

  const keyExtractor = useCallback((item: CartItem) => item.id, []);

  // ── Loading state ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View testID="order-loading" style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View testID="order-display" style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Order</Text>
        {customerName ? (
          <Text testID="order-customer-name" style={styles.greeting}>
            Welcome, {customerName}
          </Text>
        ) : null}
      </View>

      {/* ── Items ──────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={48} color={COLORS.muted} />
          <Text testID="order-empty" style={styles.emptyText}>
            Scan or add items to begin
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Totals ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text testID="order-subtotal" style={styles.totalValue}>
              {formatCurrency(subtotal)}
            </Text>
          </View>

          {discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text testID="order-discount" style={styles.discountValue}>
                −{formatCurrency(discount)}
              </Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text testID="order-tax" style={styles.totalValue}>
              {formatCurrency(tax)}
            </Text>
          </View>

          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text testID="order-total" style={styles.grandTotalValue}>
              {formatCurrency(total)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 24,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  // Header
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  greeting: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 4,
  },

  // Items list
  listContent: {
    paddingBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  /** Blue left-border highlight draws the eye to the newly added item. */
  itemRowHighlight: {
    borderColor: COLORS.accent,
    borderLeftWidth: 4,
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    flexShrink: 1,
  },
  quantityBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  quantityText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  modifiers: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 4,
  },
  lineTotal: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 12,
  },

  // Totals
  totalsSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
    marginTop: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 15,
    color: COLORS.muted,
  },
  totalValue: {
    fontSize: 15,
    color: COLORS.text,
  },
  discountValue: {
    fontSize: 15,
    color: COLORS.green,
    fontWeight: "600",
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
});

export default React.memo(OrderDisplay);
