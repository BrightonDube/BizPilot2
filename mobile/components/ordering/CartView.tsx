/**
 * CartView — Shopping cart for the online ordering flow.
 *
 * Why a full-screen cart view instead of a bottom-sheet:
 * - Tablet-first layout needs generous touch targets for quantity
 *   changes and clear visual separation of line items.
 * - A dedicated view lets customers review modifiers, notes, and the
 *   full cost breakdown (subtotal → tax → delivery → total) before
 *   committing, reducing abandoned checkouts.
 * - The empty-state with a shop icon nudges users back to browsing
 *   rather than showing a blank screen.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Optional modifier labels (e.g. "Extra cheese", "No onions"). */
  modifiers?: string[];
  /** Free-text customer notes for this line item. */
  notes?: string;
}

export interface CartViewProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
  onClearCart: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** Minimum quantity allowed — going below triggers a remove prompt. */
const MIN_QUANTITY = 1;

// ──────────────────────────────────────────────
// Sub-component: single cart line item
// ──────────────────────────────────────────────

interface CartLineProps {
  item: CartItem;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
}

const CartLine: React.FC<CartLineProps> = React.memo(function CartLine({
  item,
  onUpdateQuantity,
  onRemoveItem,
}) {
  const handleDecrease = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.quantity <= MIN_QUANTITY) return;
    onUpdateQuantity(item.id, item.quantity - 1);
  }, [onUpdateQuantity, item.id, item.quantity]);

  const handleIncrease = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateQuantity(item.id, item.quantity + 1);
  }, [onUpdateQuantity, item.id, item.quantity]);

  const handleRemove = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onRemoveItem(item.id);
  }, [onRemoveItem, item.id]);

  return (
    <View style={styles.lineContainer} testID={`cart-item-${item.id}`}>
      {/* Left column: product info */}
      <View style={styles.lineInfo}>
        <Text style={styles.lineName} numberOfLines={2}>
          {item.productName}
        </Text>

        {item.modifiers && item.modifiers.length > 0 && (
          <Text style={styles.lineModifiers} numberOfLines={2}>
            {item.modifiers.join(", ")}
          </Text>
        )}

        {item.notes ? (
          <Text style={styles.lineNotes} numberOfLines={1}>
            "{item.notes}"
          </Text>
        ) : null}

        {/* Quantity stepper */}
        <View style={styles.quantityStepper}>
          <Pressable
            style={[
              styles.stepperBtn,
              item.quantity <= MIN_QUANTITY && styles.stepperBtnDisabled,
            ]}
            onPress={handleDecrease}
            disabled={item.quantity <= MIN_QUANTITY}
            testID={`cart-qty-decrease-${item.id}`}
            accessibilityLabel={`Decrease quantity of ${item.productName}`}
            accessibilityRole="button"
          >
            <Ionicons
              name="remove"
              size={18}
              color={item.quantity <= MIN_QUANTITY ? "#4b5563" : "#f3f4f6"}
            />
          </Pressable>

          <Text style={styles.quantityText}>{item.quantity}</Text>

          <Pressable
            style={styles.stepperBtn}
            onPress={handleIncrease}
            testID={`cart-qty-increase-${item.id}`}
            accessibilityLabel={`Increase quantity of ${item.productName}`}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={18} color="#f3f4f6" />
          </Pressable>
        </View>
      </View>

      {/* Right column: line total + remove */}
      <View style={styles.lineRight}>
        <Text style={styles.lineTotal}>
          {formatCurrency(item.lineTotal)}
        </Text>

        <Pressable
          style={styles.removeBtn}
          onPress={handleRemove}
          testID={`cart-remove-${item.id}`}
          accessibilityLabel={`Remove ${item.productName} from cart`}
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={22} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );
});

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

const CartView: React.FC<CartViewProps> = React.memo(function CartView({
  items,
  subtotal,
  tax,
  deliveryFee,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onClearCart,
  onBack,
  isLoading = false,
}) {
  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const isEmpty = items.length === 0;

  // ── Handlers ──

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  }, [onBack]);

  const handleClearCart = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onClearCart();
  }, [onClearCart]);

  const handleCheckout = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCheckout();
  }, [onCheckout]);

  // ── FlatList helpers ──

  const keyExtractor = useCallback((item: CartItem) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: CartItem }) => (
      <CartLine
        item={item}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={onRemoveItem}
      />
    ),
    [onUpdateQuantity, onRemoveItem],
  );

  // ── Sub-renders ──

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable
        style={styles.headerBtn}
        onPress={handleBack}
        testID="cart-back-btn"
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Ionicons name="arrow-back" size={24} color="#f3f4f6" />
      </Pressable>

      <View style={styles.headerTitleRow}>
        <Text style={styles.headerTitle}>Cart</Text>
        {itemCount > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{itemCount}</Text>
          </View>
        )}
      </View>

      {!isEmpty && (
        <Pressable
          style={styles.headerBtn}
          onPress={handleClearCart}
          testID="cart-clear-btn"
          accessibilityLabel="Clear cart"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </Pressable>
      )}
    </View>
  );

  const renderTotals = () => (
    <View style={styles.totalsSection}>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Subtotal</Text>
        <Text style={styles.totalsValue} testID="cart-subtotal">
          {formatCurrency(subtotal)}
        </Text>
      </View>

      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Tax</Text>
        <Text style={styles.totalsValue} testID="cart-tax">
          {formatCurrency(tax)}
        </Text>
      </View>

      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Delivery Fee</Text>
        <Text style={styles.totalsValue} testID="cart-delivery">
          {formatCurrency(deliveryFee)}
        </Text>
      </View>

      <View style={styles.totalsDivider} />

      <View style={styles.totalsRow}>
        <Text style={styles.grandTotalLabel}>Total</Text>
        <Text style={styles.grandTotalValue} testID="cart-total">
          {formatCurrency(total)}
        </Text>
      </View>
    </View>
  );

  const renderCheckoutButton = () => (
    <Pressable
      style={[
        styles.checkoutBtn,
        (isEmpty || isLoading) && styles.checkoutBtnDisabled,
      ]}
      onPress={handleCheckout}
      disabled={isEmpty || isLoading}
      testID="cart-checkout-btn"
      accessibilityLabel="Proceed to checkout"
      accessibilityRole="button"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <>
          <Ionicons name="card-outline" size={20} color="#ffffff" />
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
        </>
      )}
    </Pressable>
  );

  /** Empty state — friendly nudge to start shopping. */
  const renderEmptyState = () => (
    <View style={styles.emptyState} testID="cart-empty">
      <Ionicons name="storefront-outline" size={64} color="#4b5563" />
      <Text style={styles.emptyTitle}>Your cart is empty</Text>
      <Text style={styles.emptySubtitle}>
        Browse the menu and add items to get started.
      </Text>
    </View>
  );

  // ── Main render ──

  return (
    <View style={styles.container} testID="cart-view">
      {renderHeader()}

      {isEmpty ? (
        renderEmptyState()
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
          {renderTotals()}
          {renderCheckoutButton()}
        </>
      )}
    </View>
  );
});

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  // -- Container --
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // -- Header --
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1f2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  countBadge: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },

  // -- List --
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },

  // -- Line item --
  lineContainer: {
    flexDirection: "row",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  lineInfo: {
    flex: 1,
    gap: 4,
  },
  lineName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  lineModifiers: {
    fontSize: 12,
    color: "#9ca3af",
  },
  lineNotes: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#fbbf24",
  },

  // -- Quantity stepper --
  quantityStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 8,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#374151",
    borderRadius: 10,
  },
  stepperBtnDisabled: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
    minWidth: 36,
    textAlign: "center",
  },

  // -- Line right column --
  lineRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginLeft: 12,
  },
  lineTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#22c55e",
  },
  removeBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  // -- Totals section --
  totalsSection: {
    backgroundColor: "#1f2937",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalsLabel: {
    fontSize: 14,
    color: "#9ca3af",
  },
  totalsValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#f3f4f6",
  },
  totalsDivider: {
    height: 1,
    backgroundColor: "#374151",
    marginVertical: 4,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  grandTotalValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#22c55e",
  },

  // -- Checkout button --
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22c55e",
    borderRadius: 12,
    margin: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  checkoutBtnDisabled: {
    backgroundColor: "#374151",
  },
  checkoutBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },

  // -- Empty state --
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
});

export default CartView;
