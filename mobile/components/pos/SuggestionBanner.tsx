/**
 * BizPilot Mobile POS — SuggestionBanner Component
 *
 * Displays product pairing suggestions at the bottom of the cart panel.
 * Non-intrusive design: a small banner that doesn't block the checkout flow.
 *
 * Why at the bottom of the cart (not the product grid)?
 * Staff are looking at the cart when deciding what to add next.
 * Showing suggestions near the cart total creates a natural upsell
 * moment: "Would you also like X?" before completing the sale.
 * Placing it at the bottom means it never covers existing cart items.
 *
 * Why dismissible with tracking?
 * If a suggestion is repeatedly dismissed, the backend can learn
 * and stop suggesting that pair. Tracking acceptance rate lets
 * the business owner see ROI of the smart suggestions feature.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";
import type { ProductSuggestion } from "@/services/SmartCartAssistant";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SuggestionBannerProps {
  /** Product suggestions to display */
  suggestions: ProductSuggestion[];
  /** Called when a suggestion is accepted (add to cart) */
  onAccept: (productId: string) => void;
  /** Called when a suggestion is dismissed */
  onDismiss: (productId: string) => void;
  /** Called when the entire banner is dismissed */
  onDismissAll: () => void;
}

// ---------------------------------------------------------------------------
// Suggestion chip sub-component
// ---------------------------------------------------------------------------

interface SuggestionChipProps {
  suggestion: ProductSuggestion;
  onAccept: (productId: string) => void;
  onDismiss: (productId: string) => void;
}

/**
 * A single suggestion chip showing the product name, price, and add/dismiss actions.
 * Memoized because the suggestion list can change frequently as cart updates.
 */
const SuggestionChip: React.FC<SuggestionChipProps> = React.memo(
  function SuggestionChip({ suggestion, onAccept, onDismiss }) {
    const handleAccept = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAccept(suggestion.product.id);
    }, [onAccept, suggestion.product.id]);

    const handleDismiss = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onDismiss(suggestion.product.id);
    }, [onDismiss, suggestion.product.id]);

    return (
      <View style={styles.chip}>
        {/* Product info */}
        <View style={styles.chipInfo}>
          <Text style={styles.chipName} numberOfLines={1}>
            {suggestion.product.name}
          </Text>
          <Text style={styles.chipReason} numberOfLines={1}>
            {suggestion.reason}
          </Text>
          <Text style={styles.chipPrice}>
            {formatCurrency(suggestion.product.price)}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.chipActions}>
          <Pressable
            onPress={handleAccept}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel={`Add ${suggestion.product.name} to cart`}
            hitSlop={8}
          >
            <Ionicons name="add-circle" size={28} color="#22c55e" />
          </Pressable>

          <Pressable
            onPress={handleDismiss}
            style={styles.dismissButton}
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${suggestion.product.name} suggestion`}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={20} color="#6b7280" />
          </Pressable>
        </View>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * SuggestionBanner displays a horizontal scrollable strip of product suggestions.
 * Only renders when there are suggestions available.
 */
const SuggestionBanner: React.FC<SuggestionBannerProps> = React.memo(
  function SuggestionBanner({
    suggestions,
    onAccept,
    onDismiss,
    onDismissAll,
  }) {
    // Don't render anything if no suggestions
    if (suggestions.length === 0) return null;

    const handleDismissAll = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onDismissAll();
    }, [onDismissAll]);

    return (
      <View style={styles.container}>
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="sparkles" size={14} color="#f59e0b" />
            <Text style={styles.headerText}>You might also want</Text>
          </View>
          <Pressable
            onPress={handleDismissAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss all suggestions"
          >
            <Ionicons name="close" size={16} color="#6b7280" />
          </Pressable>
        </View>

        {/* Suggestion chips — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
        >
          {suggestions.map((suggestion) => (
            <SuggestionChip
              key={suggestion.product.id}
              suggestion={suggestion}
              onAccept={onAccept}
              onDismiss={onDismiss}
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
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipList: {
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 10,
    minWidth: 180,
    maxWidth: 240,
    borderWidth: 1,
    borderColor: "#1e3a5f",
  },
  chipInfo: {
    flex: 1,
    marginRight: 8,
  },
  chipName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  chipReason: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  chipPrice: {
    color: "#22c55e",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  chipActions: {
    alignItems: "center",
    gap: 4,
  },
  addButton: {
    padding: 2,
  },
  dismissButton: {
    padding: 2,
  },
});

export default SuggestionBanner;
