/**
 * BizPilot Mobile POS — CartItem Component
 *
 * A single line item in the cart panel with quantity controls and actions.
 *
 * Why inline quantity buttons instead of a number input?
 * In a POS, quantity changes are almost always +1 or -1.
 * Tapping "+" is faster and less error-prone than opening a numpad,
 * especially with greasy or gloved hands in a food service POS.
 *
 * Why swipe-to-delete?
 * It's a natural gesture on tablets/phones and keeps the UI clean
 * without needing a visible delete button for every item.
 * We also keep a small trash icon for accessibility.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { calculateLineTotal } from "@/utils/priceCalculator";
import type { CartItem as CartItemType } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CartItemProps {
  /** The cart item data */
  item: CartItemType;
  /** Called when quantity should increase by 1 */
  onIncrement: (productId: string) => void;
  /** Called when quantity should decrease by 1 */
  onDecrement: (productId: string) => void;
  /** Called when the item should be removed entirely */
  onRemove: (productId: string) => void;
  /** Called to edit notes on this item */
  onEditNotes?: (productId: string) => void;
  /** Called to edit discount on this item */
  onEditDiscount?: (productId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CartItem: React.FC<CartItemProps> = React.memo(function CartItem({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onEditNotes,
  onEditDiscount,
}) {
  const lineTotal = calculateLineTotal({
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    discount: item.discount,
  });

  const handleIncrement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onIncrement(item.productId);
  }, [item.productId, onIncrement]);

  const handleDecrement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecrement(item.productId);
  }, [item.productId, onDecrement]);

  const handleRemove = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onRemove(item.productId);
  }, [item.productId, onRemove]);

  const handleEditNotes = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEditNotes?.(item.productId);
  }, [item.productId, onEditNotes]);

  const handleEditDiscount = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEditDiscount?.(item.productId);
  }, [item.productId, onEditDiscount]);

  return (
    <View style={styles.container}>
      {/* Product name, price per unit, and notes */}
      <View style={styles.infoColumn}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.productName}
        </Text>
        <Text style={styles.unitPrice}>
          {formatCurrency(item.unitPrice)} × {item.quantity}
        </Text>
        {item.discount > 0 && (
          <Pressable onPress={handleEditDiscount} hitSlop={4}>
            <Text style={styles.discountText}>
              −{formatCurrency(item.discount)} discount ✎
            </Text>
          </Pressable>
        )}
        {item.notes ? (
          <Pressable onPress={handleEditNotes} hitSlop={4}>
            <Text style={styles.notesText} numberOfLines={1}>
              📝 {item.notes} ✎
            </Text>
          </Pressable>
        ) : null}
        {/* Quick action row for notes/discount */}
        <View style={styles.quickActions}>
          {onEditNotes && !item.notes && (
            <Pressable onPress={handleEditNotes} style={styles.quickActionBtn}>
              <Ionicons name="chatbubble-outline" size={12} color="#6b7280" />
              <Text style={styles.quickActionText}>Note</Text>
            </Pressable>
          )}
          {onEditDiscount && item.discount === 0 && (
            <Pressable onPress={handleEditDiscount} style={styles.quickActionBtn}>
              <Ionicons name="pricetag-outline" size={12} color="#6b7280" />
              <Text style={styles.quickActionText}>Discount</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Quantity controls */}
      <View style={styles.quantityControls}>
        <Pressable
          onPress={handleDecrement}
          style={styles.quantityButton}
          accessibilityLabel={`Decrease quantity of ${item.productName}`}
          accessibilityRole="button"
        >
          <Text style={styles.quantityButtonText}>−</Text>
        </Pressable>

        <Text style={styles.quantityValue}>{item.quantity}</Text>

        <Pressable
          onPress={handleIncrement}
          style={styles.quantityButton}
          accessibilityLabel={`Increase quantity of ${item.productName}`}
          accessibilityRole="button"
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </Pressable>
      </View>

      {/* Line total */}
      <Text style={styles.lineTotal}>{formatCurrency(lineTotal)}</Text>

      {/* Remove button */}
      <Pressable
        onPress={handleRemove}
        hitSlop={8}
        style={styles.removeButton}
        accessibilityLabel={`Remove ${item.productName} from cart`}
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={16} color="#ef4444" />
      </Pressable>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  infoColumn: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  unitPrice: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 2,
  },
  discountText: {
    color: "#f59e0b",
    fontSize: 11,
    marginTop: 1,
  },
  notesText: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 3,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  quickActionText: {
    color: "#6b7280",
    fontSize: 11,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  quantityValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  lineTotal: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    width: 80,
    textAlign: "right",
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default CartItem;
