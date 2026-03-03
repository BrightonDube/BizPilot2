/**
 * BizPilot Mobile POS — HeldCartsPanel Component
 *
 * Displays a list of "held" (parked) carts that can be recalled.
 * Each held cart shows a label, item count, total, and how long ago it was held.
 *
 * Why a slide-out panel?
 * Held carts are accessed infrequently (a few times per service).
 * A persistent panel would waste screen real estate. A modal or slide-out
 * matches how Square and Toast handle parked orders.
 *
 * Why show the time since hold?
 * In hospitality, a cart held for >30 min is likely abandoned. Visual
 * aging helps staff clean up stale carts and avoid confusion.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Modal, Button, Badge } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import {
  useHeldCartsStore,
  type HeldCart,
} from "@/stores/heldCartsStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HeldCartsPanelProps {
  /** Whether the panel is visible */
  visible: boolean;
  /** Called when the panel should close */
  onClose: () => void;
  /** Called when a held cart is recalled — consumer should load items into active cart */
  onRecallCart: (cart: HeldCart) => void;
}

// ---------------------------------------------------------------------------
// Time-ago helper
// ---------------------------------------------------------------------------

/**
 * Formats a timestamp as a relative time string.
 * E.g., "2 min ago", "1 hr ago", "Just now"
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day(s) ago`;
}

// ---------------------------------------------------------------------------
// HeldCartRow sub-component
// ---------------------------------------------------------------------------

interface HeldCartRowProps {
  cart: HeldCart;
  onRecall: (cart: HeldCart) => void;
  onRemove: (cartId: string) => void;
}

const HeldCartRow: React.FC<HeldCartRowProps> = React.memo(
  function HeldCartRow({ cart, onRecall, onRemove }) {
    const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    const total = cart.items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity - i.discount,
      0
    );
    const timeAgo = formatTimeAgo(cart.heldAt);
    const isStale = Date.now() - cart.heldAt > 30 * 60 * 1000; // > 30 min

    const handleRecall = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRecall(cart);
    }, [cart, onRecall]);

    const handleRemove = useCallback(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Remove Held Cart?",
        `Are you sure you want to discard "${cart.label}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: () => onRemove(cart.id) },
        ]
      );
    }, [cart, onRemove]);

    return (
      <View style={[styles.row, isStale && styles.rowStale]}>
        <View style={styles.rowInfo}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowLabel}>{cart.label}</Text>
            {isStale && <Badge label="Stale" variant="warning" />}
          </View>
          <Text style={styles.rowMeta}>
            {itemCount} item{itemCount !== 1 ? "s" : ""} · {formatCurrency(total)} ·{" "}
            {timeAgo}
          </Text>
          {cart.notes ? (
            <Text style={styles.rowNotes} numberOfLines={1}>
              📝 {cart.notes}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowActions}>
          <Pressable
            onPress={handleRecall}
            style={styles.recallButton}
            accessibilityLabel={`Recall cart ${cart.label}`}
          >
            <Ionicons name="arrow-undo-outline" size={20} color="#3b82f6" />
            <Text style={styles.recallText}>Recall</Text>
          </Pressable>
          <Pressable
            onPress={handleRemove}
            hitSlop={8}
            style={styles.removeButton}
            accessibilityLabel={`Remove cart ${cart.label}`}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </Pressable>
        </View>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const HeldCartsPanel: React.FC<HeldCartsPanelProps> = React.memo(
  function HeldCartsPanel({ visible, onClose, onRecallCart }) {
    const heldCarts = useHeldCartsStore((s) => s.heldCarts);
    const removeHeldCart = useHeldCartsStore((s) => s.removeHeldCart);

    const handleRecall = useCallback(
      (cart: HeldCart) => {
        onRecallCart(cart);
        onClose();
      },
      [onRecallCart, onClose]
    );

    const renderItem = useCallback(
      ({ item }: { item: HeldCart }) => (
        <HeldCartRow
          cart={item}
          onRecall={handleRecall}
          onRemove={removeHeldCart}
        />
      ),
      [handleRecall, removeHeldCart]
    );

    const keyExtractor = useCallback((item: HeldCart) => item.id, []);

    return (
      <Modal visible={visible} onClose={onClose} title="Held Orders">
        {heldCarts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="pause-circle-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>No held orders</Text>
            <Text style={styles.emptySubtext}>
              Hold the current cart to pause and start a new sale
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.countText}>
              {heldCarts.length} held order{heldCarts.length !== 1 ? "s" : ""}
            </Text>
            <FlatList
              data={heldCarts}
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
  rowStale: {
    borderWidth: 1,
    borderColor: "#f59e0b33",
  },
  rowInfo: {
    flex: 1,
    marginRight: 12,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  rowMeta: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  rowNotes: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#1e3a5f",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  recallText: {
    color: "#3b82f6",
    fontSize: 13,
    fontWeight: "600",
  },
  removeButton: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 32,
    gap: 8,
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

export default HeldCartsPanel;
