/**
 * BizPilot Mobile POS — ProductCard Component
 *
 * Individual product tile displayed in the POS product grid.
 * Designed for large touch targets on tablets and phones.
 *
 * Why a separate component instead of inline in ProductGrid?
 * React.memo optimization: ProductCard only re-renders when its
 * own props change. In a grid of 100+ products, this prevents
 * the entire grid from re-rendering when one product updates.
 *
 * Why 100dp minimum height?
 * Apple HIG recommends 44pt minimum touch targets. A 100dp card
 * provides a comfortable tap area even for users with large fingers
 * in a fast-paced POS environment.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { Badge } from "@/components/ui";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProductCardProps {
  /** Unique product identifier */
  id: string;
  /** Product display name */
  name: string;
  /** Selling price */
  price: number;
  /** Optional product image URL */
  imageUrl?: string | null;
  /** Current stock quantity (used for out-of-stock indicator) */
  stockQuantity?: number;
  /** Whether this product tracks inventory */
  trackInventory?: boolean;
  /** Whether the product is active/available for sale */
  isActive?: boolean;
  /** Callback when the card is tapped */
  onPress: (productId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A single product tile for the POS grid.
 * Shows product name, price, image (if available), and stock status.
 */
const ProductCard: React.FC<ProductCardProps> = React.memo(
  function ProductCard({
    id,
    name,
    price,
    imageUrl,
    stockQuantity = 0,
    trackInventory = false,
    isActive = true,
    onPress,
  }) {
    const isOutOfStock = trackInventory && stockQuantity <= 0;
    const isLowStock = trackInventory && stockQuantity > 0 && stockQuantity <= 5;
    const isDisabled = !isActive || isOutOfStock;

    return (
      <Pressable
        onPress={() => {
          if (!isDisabled) {
            onPress(id);
          }
        }}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.container,
          pressed && !isDisabled && styles.containerPressed,
          isDisabled && styles.containerDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${formatCurrency(price)}${
          isOutOfStock ? ", out of stock" : ""
        }`}
        accessibilityState={{ disabled: isDisabled }}
      >
        {/* Product image or placeholder */}
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`${name} image`}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name="cube-outline"
              size={28}
              color={isDisabled ? "#4b5563" : "#6b7280"}
            />
          </View>
        )}

        {/* Product name */}
        <Text
          style={[styles.name, isDisabled && styles.nameDisabled]}
          numberOfLines={2}
        >
          {name}
        </Text>

        {/* Price */}
        <Text style={[styles.price, isDisabled && styles.priceDisabled]}>
          {formatCurrency(price)}
        </Text>

        {/* Stock indicators */}
        {isOutOfStock && (
          <View style={styles.badgeContainer}>
            <Badge label="Out of stock" variant="danger" />
          </View>
        )}
        {isLowStock && (
          <View style={styles.badgeContainer}>
            <Badge label={`${stockQuantity} left`} variant="warning" />
          </View>
        )}
      </Pressable>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#374151",
    borderRadius: 12,
    padding: 12,
    margin: 4,
    flex: 1,
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  containerPressed: {
    backgroundColor: "#4b5563",
    transform: [{ scale: 0.97 }],
  },
  containerDisabled: {
    opacity: 0.5,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginBottom: 8,
  },
  imagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  name: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  nameDisabled: {
    color: "#6b7280",
  },
  price: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "700",
  },
  priceDisabled: {
    color: "#4b5563",
  },
  badgeContainer: {
    marginTop: 6,
  },
});

export default ProductCard;
