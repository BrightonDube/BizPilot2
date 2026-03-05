/**
 * ProductCard — Product display card for the online ordering storefront.
 *
 * Why a dedicated card component:
 * - Online ordering products need richer presentation than POS items
 *   (images, prep time, allergens, popularity badges) to drive customer
 *   engagement and reduce support queries about ingredients.
 * - Supports compact (horizontal) mode for search results and category
 *   listings where vertical space is limited on tablets.
 * - Unavailable overlay prevents accidental orders while keeping the
 *   product visible so customers know it exists.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/** Product data required by the card. */
export interface ProductCardProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  category: string;
  isAvailable: boolean;
  isPopular: boolean;
  /** Estimated preparation time in minutes. */
  preparationTime: number;
  /** Optional allergen list displayed below the description. */
  allergens?: string[];
}

export interface ProductCardProps {
  product: ProductCardProduct;
  /** Called when the card body is pressed (navigate to detail). */
  onPress: (productId: string) => void;
  /** Quick add-to-cart action; omitted if the storefront requires options first. */
  onAddToCart?: (productId: string) => void;
  /** Compact horizontal layout for list views. */
  compact?: boolean;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

const ProductCard: React.FC<ProductCardProps> = React.memo(
  function ProductCard({ product, onPress, onAddToCart, compact = false }) {
    const {
      id,
      name,
      description,
      price,
      imageUrl,
      category,
      isAvailable,
      isPopular,
      preparationTime,
      allergens,
    } = product;

    // ── Handlers ──

    const handlePress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress(id);
    }, [onPress, id]);

    const handleAddToCart = useCallback(() => {
      if (!isAvailable) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAddToCart?.(id);
    }, [onAddToCart, id, isAvailable]);

    // ── Sub-renders ──

    /** Grey placeholder when no product image is available. */
    const renderImage = () => (
      <View
        style={[
          styles.imageContainer,
          compact && styles.imageContainerCompact,
        ]}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="camera-outline" size={32} color="#6b7280" />
          </View>
        )}

        {/* Popular badge floats over the top-right corner of the image */}
        {isPopular && (
          <View
            style={styles.popularBadge}
            testID={`product-popular-${id}`}
          >
            <Ionicons name="flame" size={12} color="#0f172a" />
            <Text style={styles.popularBadgeText}>Popular</Text>
          </View>
        )}
      </View>
    );

    const renderDetails = () => (
      <View style={[styles.details, compact && styles.detailsCompact]}>
        {/* Name */}
        <Text
          style={styles.name}
          numberOfLines={compact ? 1 : 2}
          testID={`product-name-${id}`}
        >
          {name}
        </Text>

        {/* Description — capped at 2 lines to keep cards uniform */}
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>

        {/* Price */}
        <Text style={styles.price} testID={`product-price-${id}`}>
          {formatCurrency(price)}
        </Text>

        {/* Meta row: category + prep time */}
        <View style={styles.metaRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{category}</Text>
          </View>

          <View style={styles.prepTime}>
            <Ionicons name="time-outline" size={14} color="#9ca3af" />
            <Text style={styles.prepTimeText}>
              {preparationTime} min
            </Text>
          </View>
        </View>

        {/* Allergens */}
        {allergens && allergens.length > 0 && (
          <Text style={styles.allergens} numberOfLines={1}>
            Allergens: {allergens.join(", ")}
          </Text>
        )}

        {/* Add to Cart button */}
        {onAddToCart && (
          <Pressable
            style={[
              styles.addToCartBtn,
              !isAvailable && styles.addToCartBtnDisabled,
            ]}
            onPress={handleAddToCart}
            disabled={!isAvailable}
            testID={`product-add-${id}`}
            accessibilityLabel={`Add ${name} to cart`}
            accessibilityRole="button"
          >
            <Ionicons
              name="cart-outline"
              size={18}
              color={isAvailable ? "#ffffff" : "#6b7280"}
            />
            <Text
              style={[
                styles.addToCartText,
                !isAvailable && styles.addToCartTextDisabled,
              ]}
            >
              Add to Cart
            </Text>
          </Pressable>
        )}
      </View>
    );

    // ── Main render ──

    return (
      <Pressable
        style={[styles.container, compact && styles.containerCompact]}
        onPress={handlePress}
        testID={`product-card-${id}`}
        accessibilityLabel={`${name}, ${formatCurrency(price)}`}
        accessibilityRole="button"
      >
        {renderImage()}
        {renderDetails()}

        {/* Unavailable overlay — keeps product visible but clearly disabled */}
        {!isAvailable && (
          <View
            style={styles.unavailableOverlay}
            testID={`product-unavailable-${id}`}
          >
            <Ionicons name="close-circle" size={28} color="#ef4444" />
            <Text style={styles.unavailableText}>Unavailable</Text>
          </View>
        )}
      </Pressable>
    );
  },
);

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  // -- Container --
  container: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  containerCompact: {
    flexDirection: "row",
    height: 140,
  },

  // -- Image --
  imageContainer: {
    height: 160,
    backgroundColor: "#374151",
  },
  imageContainerCompact: {
    width: 140,
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#374151",
  },

  // -- Popular badge --
  popularBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fbbf24",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f172a",
  },

  // -- Details --
  details: {
    padding: 12,
    gap: 6,
  },
  detailsCompact: {
    flex: 1,
    justifyContent: "center",
  },

  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f4f6",
  },
  description: {
    fontSize: 13,
    color: "#9ca3af",
    lineHeight: 18,
  },
  price: {
    fontSize: 20,
    fontWeight: "800",
    color: "#22c55e",
    marginTop: 2,
  },

  // -- Meta row --
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  categoryBadge: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  },
  prepTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  prepTimeText: {
    fontSize: 12,
    color: "#9ca3af",
  },

  // -- Allergens --
  allergens: {
    fontSize: 11,
    color: "#fbbf24",
    marginTop: 2,
  },

  // -- Add to Cart --
  addToCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 10,
    minHeight: 48,
    marginTop: 8,
  },
  addToCartBtnDisabled: {
    backgroundColor: "#374151",
  },
  addToCartText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  addToCartTextDisabled: {
    color: "#6b7280",
  },

  // -- Unavailable overlay --
  unavailableOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  unavailableText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ef4444",
  },
});

export default ProductCard;
