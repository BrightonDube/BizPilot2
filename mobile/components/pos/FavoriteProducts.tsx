/**
 * BizPilot Mobile POS — FavoriteProducts Component
 *
 * A compact horizontal strip of favorited/pinned products shown at the
 * top of the POS product grid for quick one-tap ordering.
 *
 * Why a horizontal strip instead of a grid section?
 * Favorites need to be visible without scrolling. A horizontal strip at
 * the top takes minimal vertical space while allowing quick access to
 * the 8–12 most-ordered products. This mirrors the "quick menu" bar
 * found in Square, Toast, and Lightspeed POS terminals.
 *
 * Why persist favorites per user?
 * Different staff members have different ordering patterns. A barista
 * favorites coffee drinks, while a kitchen cashier favorites food items.
 * Per-user favorites keep the quick strip relevant.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";
import type { MobileProduct } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FavoriteProductsProps {
  /** IDs of favorited products */
  favoriteIds: string[];
  /** All available products (filtered to favorites internally) */
  products: MobileProduct[];
  /** Called when a favorite product is tapped to add to cart */
  onAddToCart: (product: MobileProduct) => void;
  /** Called to toggle a product's favorite status */
  onToggleFavorite: (productId: string) => void;
  /** Whether the strip is in edit mode (shows remove buttons) */
  editMode?: boolean;
}

// ---------------------------------------------------------------------------
// Sub-component: single favorite product chip
// ---------------------------------------------------------------------------

interface FavoriteChipProps {
  product: MobileProduct;
  onPress: () => void;
  onRemove: () => void;
  editMode: boolean;
}

const FavoriteChip = React.memo(function FavoriteChip({
  product,
  onPress,
  onRemove,
  editMode,
}: FavoriteChipProps) {
  return (
    <Pressable
      onPress={editMode ? onRemove : onPress}
      style={[
        styles.chip,
        !product.isActive && styles.chipInactive,
        product.trackInventory &&
          product.stockQuantity <= 0 &&
          styles.chipOutOfStock,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${editMode ? "Remove" : "Add"} ${product.name}`}
    >
      {editMode && (
        <View style={styles.removeIcon}>
          <Ionicons name="close-circle" size={16} color="#ef4444" />
        </View>
      )}
      <Text style={styles.chipName} numberOfLines={1}>
        {product.name}
      </Text>
      <Text style={styles.chipPrice}>{formatCurrency(product.price)}</Text>
      {product.trackInventory && product.stockQuantity <= 0 && (
        <Text style={styles.chipOos}>Out of stock</Text>
      )}
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FavoriteProducts: React.FC<FavoriteProductsProps> = React.memo(
  function FavoriteProducts({
    favoriteIds,
    products,
    onAddToCart,
    onToggleFavorite,
    editMode = false,
  }) {
    // Filter and sort favorite products in the order they were favorited
    const favoriteProducts = useMemo(() => {
      const productMap = new Map(products.map((p) => [p.id, p]));
      return favoriteIds
        .map((id) => productMap.get(id))
        .filter((p): p is MobileProduct => p != null && p.isActive);
    }, [favoriteIds, products]);

    const handleAddToCart = useCallback(
      (product: MobileProduct) => {
        if (product.trackInventory && product.stockQuantity <= 0) {
          return; // Don't add out-of-stock items
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onAddToCart(product);
      },
      [onAddToCart]
    );

    const handleRemoveFavorite = useCallback(
      (productId: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onToggleFavorite(productId);
      },
      [onToggleFavorite]
    );

    // Don't render if no favorites
    if (favoriteProducts.length === 0) {
      return null;
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="star" size={14} color="#f59e0b" />
          <Text style={styles.headerText}>Favorites</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {favoriteProducts.map((product) => (
            <FavoriteChip
              key={product.id}
              product={product}
              onPress={() => handleAddToCart(product)}
              onRemove={() => handleRemoveFavorite(product.id)}
              editMode={editMode}
            />
          ))}
        </ScrollView>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    backgroundColor: "#111827",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
  },
  headerText: {
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  chip: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#374151",
  },
  chipInactive: {
    opacity: 0.5,
  },
  chipOutOfStock: {
    borderColor: "#ef4444",
    opacity: 0.7,
  },
  chipName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 100,
  },
  chipPrice: {
    color: "#3b82f6",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  chipOos: {
    color: "#ef4444",
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
  },
  removeIcon: {
    position: "absolute",
    top: -4,
    right: -4,
    zIndex: 1,
  },
});

export default FavoriteProducts;
