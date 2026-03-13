/**
 * BizPilot Mobile POS — CartPanel Component
 *
 * Right-side panel showing the current cart contents, totals,
 * and checkout actions. On tablets, this is always visible;
 * on phones, it slides up as a bottom sheet.
 *
 * Why a persistent panel on tablets?
 * The cart must be visible at all times during POS operation.
 * A slide-out drawer or modal would add friction to every
 * transaction. Side-by-side (product grid | cart) is the
 * standard POS layout used by Square, Toast, and Lightspeed.
 */

import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SwipeableCartItem from "./SwipeableCartItem";
import ItemNotesModal from "./ItemNotesModal";
import ItemDiscountModal from "./ItemDiscountModal";
import { Button, Badge } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import { calculateCartTotals, calculateLineTotal } from "@/utils/priceCalculator";
import { useCartStore } from "@/stores/cartStore";
import { DEFAULT_VAT_RATE } from "@/utils/constants";
import type { CartItem as CartItemType } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CartPanelProps {
  /** Whether the panel should use tablet (full width side panel) layout */
  isTablet?: boolean;
  /** Cart panel width in dp (only for tablet layout) */
  width?: number;
  /** Called when the "Pay Now" button is pressed */
  onCheckout: () => void;
  /** Called when a customer should be selected/changed */
  onSelectCustomer?: () => void;
  /** Called when the customer is removed (back to walk-in) */
  onRemoveCustomer?: () => void;
  /** Currently selected customer name (null = walk-in) */
  customerName?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CartPanel: React.FC<CartPanelProps> = React.memo(function CartPanel({
  isTablet = true,
  width = 320,
  onCheckout,
  onSelectCustomer,
  onRemoveCustomer,
  customerName = null,
}) {
  // Cart store selectors (each component only re-renders on its slice)
  const items = useCartStore((s) => s.items);
  const cartDiscount = useCartStore((s) => s.discount);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateItemNotes = useCartStore((s) => s.updateItemNotes);
  const updateItemDiscount = useCartStore((s) => s.updateItemDiscount);
  const clear = useCartStore((s) => s.clear);

  // Modal state for editing notes and discounts inline
  const [notesModalProductId, setNotesModalProductId] = useState<string | null>(null);
  const [discountModalProductId, setDiscountModalProductId] = useState<string | null>(null);

  const notesItem = items.find((i) => i.productId === notesModalProductId);
  const discountItem = items.find((i) => i.productId === discountModalProductId);

  // Calculate line total for the item being discounted
  const discountItemLineTotal = discountItem
    ? calculateLineTotal({
        unitPrice: discountItem.unitPrice,
        quantity: discountItem.quantity,
        discount: 0, // Show full total before discount
      })
    : 0;

  // Calculate totals using the price calculator
  const totals = calculateCartTotals({
    items: items.map((i) => ({
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      discount: i.discount,
    })),
    cartDiscount,
    vatRate: DEFAULT_VAT_RATE,
    taxInclusive: true,
  });

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  // Handlers
  const handleIncrement = useCallback(
    (productId: string) => {
      const item = items.find((i) => i.productId === productId);
      if (item) {
        updateQuantity(productId, item.quantity + 1);
      }
    },
    [items, updateQuantity]
  );

  const handleDecrement = useCallback(
    (productId: string) => {
      const item = items.find((i) => i.productId === productId);
      if (item) {
        updateQuantity(productId, item.quantity - 1);
      }
    },
    [items, updateQuantity]
  );

  const handleRemove = useCallback(
    (productId: string) => {
      removeItem(productId);
    },
    [removeItem]
  );

  // Notes/Discount editing handlers
  const handleEditNotes = useCallback((productId: string) => {
    setNotesModalProductId(productId);
  }, []);

  const handleEditDiscount = useCallback((productId: string) => {
    setDiscountModalProductId(productId);
  }, []);

  const handleSaveNotes = useCallback(
    (notes: string | null) => {
      if (notesModalProductId) {
        updateItemNotes(notesModalProductId, notes || null);
      }
      setNotesModalProductId(null);
    },
    [notesModalProductId, updateItemNotes]
  );

  const handleSaveDiscount = useCallback(
    (discount: number) => {
      if (discountModalProductId) {
        updateItemDiscount(discountModalProductId, discount);
      }
      setDiscountModalProductId(null);
    },
    [discountModalProductId, updateItemDiscount]
  );

  return (
    <View
      style={[
        styles.container,
        isTablet
          ? { width, borderLeftWidth: 1 }
          : { borderTopWidth: 1, flex: 1 },
      ]}
    >
      {/* Cart header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Cart</Text>
          <Badge
            label={`${itemCount} item${itemCount !== 1 ? "s" : ""}`}
            variant={items.length > 0 ? "info" : "default"}
          />
        </View>

        {/* Customer selector with remove action */}
        {onSelectCustomer && (
          <View style={styles.customerRow}>
            <Button
              label={customerName ?? "Walk-in"}
              onPress={onSelectCustomer}
              variant="secondary"
              size="sm"
            />
            {customerName && onRemoveCustomer && (
              <Pressable
                onPress={onRemoveCustomer}
                style={styles.removeCustomerBtn}
                accessibilityRole="button"
                accessibilityLabel="Remove customer (switch to walk-in)"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color="#ef4444" />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Cart items list */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={48} color="#374151" />
          <Text style={styles.emptyText}>Tap a product to add it</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.itemsList}
          contentContainerStyle={styles.itemsContent}
        >
          {items.map((item: CartItemType) => (
            <SwipeableCartItem
              key={item.productId}
              item={item}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onRemove={handleRemove}
              onEditNotes={handleEditNotes}
              onEditDiscount={handleEditDiscount}
              swipeEnabled={true}
            />
          ))}
        </ScrollView>
      )}

      {/* Totals and actions */}
      {items.length > 0 && (
        <View style={styles.footer}>
          {/* Subtotal */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(totals.subtotal)}
            </Text>
          </View>

          {/* Discount (if any) */}
          {totals.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.discountLabel}>Discount</Text>
              <Text style={styles.discountValue}>
                −{formatCurrency(totals.discount)}
              </Text>
            </View>
          )}

          {/* VAT */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              VAT ({(DEFAULT_VAT_RATE * 100).toFixed(0)}% incl.)
            </Text>
            <Text style={styles.totalValue}>
              {formatCurrency(totals.taxAmount)}
            </Text>
          </View>

          {/* Grand total */}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(totals.total)}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Button label="Pay Now" onPress={onCheckout} size="lg" />
            <Button
              label="Clear Cart"
              onPress={clear}
              variant="secondary"
              size="sm"
            />
          </View>
        </View>
      )}

      {/* Item Notes Modal */}
      <ItemNotesModal
        visible={notesModalProductId !== null}
        onClose={() => setNotesModalProductId(null)}
        onSave={handleSaveNotes}
        currentNotes={notesItem?.notes ?? null}
        productName={notesItem?.productName ?? ""}
      />

      {/* Item Discount Modal */}
      <ItemDiscountModal
        visible={discountModalProductId !== null}
        onClose={() => setDiscountModalProductId(null)}
        onApply={handleSaveDiscount}
        unitPrice={discountItem?.unitPrice ?? 0}
        quantity={discountItem?.quantity ?? 1}
        currentDiscount={discountItem?.discount ?? 0}
        productName={discountItem?.productName ?? ""}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  removeCustomerBtn: {
    padding: 2,
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  emptyText: {
    color: "#6b7280",
    marginTop: 12,
    fontSize: 14,
  },
  itemsList: {
    flex: 1,
  },
  itemsContent: {
    paddingHorizontal: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: {
    color: "#9ca3af",
    fontSize: 14,
  },
  totalValue: {
    color: "#ffffff",
    fontSize: 14,
  },
  discountLabel: {
    color: "#f59e0b",
    fontSize: 14,
  },
  discountValue: {
    color: "#f59e0b",
    fontSize: 14,
  },
  grandTotalRow: {
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  grandTotalLabel: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  grandTotalValue: {
    color: "#3b82f6",
    fontSize: 20,
    fontWeight: "700",
  },
  actions: {
    gap: 8,
  },
});

export default CartPanel;
