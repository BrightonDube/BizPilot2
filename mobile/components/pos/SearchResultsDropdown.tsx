/**
 * BizPilot Mobile POS — SearchResultsDropdown Component
 *
 * A dropdown overlay that appears below the search bar, showing matching
 * products and recent search history. Designed for fast product lookup.
 *
 * Why a dropdown instead of inline grid filtering?
 * When the user types a specific product name or SKU, a dropdown provides
 * immediate, focused results without navigating away from the current
 * category view. Tapping a result adds it to cart instantly (one less tap).
 * This is the standard pattern in modern POS systems like Clover and Toast.
 *
 * Why store recent searches?
 * POS operators often search for the same items repeatedly (e.g., "flat white",
 * "steak medium"). Showing recent searches below the input saves keystrokes
 * and speeds up repeat orders. We cap at 10 entries to keep the list manageable.
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";
import type { MobileProduct } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of recent searches to display */
const MAX_RECENT_SEARCHES = 10;

/** Maximum number of product results to show in the dropdown */
const MAX_RESULTS = 8;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SearchResultsDropdownProps {
  /** The current search query */
  query: string;
  /** Products matching the search query */
  results: MobileProduct[];
  /** Recent search terms (most recent first) */
  recentSearches: string[];
  /** Whether results are loading */
  loading?: boolean;
  /** Called when a product result is tapped */
  onSelectProduct: (product: MobileProduct) => void;
  /** Called when a recent search term is tapped (populates search) */
  onSelectRecentSearch: (term: string) => void;
  /** Called to clear all recent searches */
  onClearRecentSearches: () => void;
  /** Called to remove a single recent search */
  onRemoveRecentSearch: (term: string) => void;
}

// ---------------------------------------------------------------------------
// Sub-component: Product result row
// ---------------------------------------------------------------------------

interface ProductResultRowProps {
  product: MobileProduct;
  onSelect: () => void;
}

const ProductResultRow = React.memo(function ProductResultRow({
  product,
  onSelect,
}: ProductResultRowProps) {
  const isOutOfStock =
    product.trackInventory && product.stockQuantity <= 0;

  return (
    <Pressable
      onPress={onSelect}
      style={[styles.resultRow, isOutOfStock && styles.resultRowDisabled]}
      disabled={isOutOfStock}
      accessibilityRole="button"
      accessibilityLabel={`Add ${product.name} to cart`}
    >
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {product.name}
        </Text>
        <View style={styles.resultMeta}>
          {product.sku && (
            <Text style={styles.resultSku}>SKU: {product.sku}</Text>
          )}
          {product.barcode && (
            <Text style={styles.resultSku}>
              {product.barcode}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.resultPriceCol}>
        <Text style={styles.resultPrice}>
          {formatCurrency(product.price)}
        </Text>
        {isOutOfStock && (
          <Text style={styles.resultOos}>Out of stock</Text>
        )}
      </View>
      <Ionicons name="add-circle" size={24} color={isOutOfStock ? "#374151" : "#3b82f6"} />
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Sub-component: Recent search row
// ---------------------------------------------------------------------------

interface RecentSearchRowProps {
  term: string;
  onSelect: () => void;
  onRemove: () => void;
}

const RecentSearchRow = React.memo(function RecentSearchRow({
  term,
  onSelect,
  onRemove,
}: RecentSearchRowProps) {
  return (
    <View style={styles.recentRow}>
      <Pressable
        onPress={onSelect}
        style={styles.recentRowContent}
        accessibilityRole="button"
        accessibilityLabel={`Search for ${term}`}
      >
        <Ionicons name="time-outline" size={16} color="#6b7280" />
        <Text style={styles.recentText}>{term}</Text>
      </Pressable>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityLabel={`Remove "${term}" from recent searches`}
      >
        <Ionicons name="close" size={16} color="#6b7280" />
      </Pressable>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SearchResultsDropdown: React.FC<SearchResultsDropdownProps> = React.memo(
  function SearchResultsDropdown({
    query,
    results,
    recentSearches,
    loading = false,
    onSelectProduct,
    onSelectRecentSearch,
    onClearRecentSearches,
    onRemoveRecentSearch,
  }) {
    const trimmedQuery = query.trim();
    const isSearching = trimmedQuery.length > 0;

    // Limit results to keep dropdown manageable
    const limitedResults = useMemo(
      () => results.slice(0, MAX_RESULTS),
      [results]
    );

    const limitedRecentSearches = useMemo(
      () => recentSearches.slice(0, MAX_RECENT_SEARCHES),
      [recentSearches]
    );

    const handleSelectProduct = useCallback(
      (product: MobileProduct) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSelectProduct(product);
      },
      [onSelectProduct]
    );

    const handleSelectRecent = useCallback(
      (term: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectRecentSearch(term);
      },
      [onSelectRecentSearch]
    );

    const handleRemoveRecent = useCallback(
      (term: string) => {
        onRemoveRecentSearch(term);
      },
      [onRemoveRecentSearch]
    );

    // Show recent searches when input is focused but no query typed
    if (!isSearching) {
      if (limitedRecentSearches.length === 0) {
        return null;
      }

      return (
        <View style={styles.dropdown}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentHeaderText}>Recent Searches</Text>
            <Pressable
              onPress={onClearRecentSearches}
              hitSlop={8}
              accessibilityLabel="Clear all recent searches"
            >
              <Text style={styles.clearAllText}>Clear All</Text>
            </Pressable>
          </View>
          {limitedRecentSearches.map((term) => (
            <RecentSearchRow
              key={term}
              term={term}
              onSelect={() => handleSelectRecent(term)}
              onRemove={() => handleRemoveRecent(term)}
            />
          ))}
        </View>
      );
    }

    // Show search results
    return (
      <View style={styles.dropdown}>
        {loading && (
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        )}

        {!loading && limitedResults.length === 0 && (
          <View style={styles.noResultsRow}>
            <Ionicons name="search-outline" size={20} color="#6b7280" />
            <Text style={styles.noResultsText}>
              No products found for "{trimmedQuery}"
            </Text>
          </View>
        )}

        {limitedResults.map((product) => (
          <ProductResultRow
            key={product.id}
            product={product}
            onSelect={() => handleSelectProduct(product)}
          />
        ))}

        {results.length > MAX_RESULTS && (
          <View style={styles.moreRow}>
            <Text style={styles.moreText}>
              +{results.length - MAX_RESULTS} more results
            </Text>
          </View>
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  dropdown: {
    backgroundColor: "#1f2937",
    borderRadius: 10,
    marginHorizontal: 8,
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#374151",
    maxHeight: 360,
    overflow: "hidden",
    // Shadow for elevation above the product grid
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Product results
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    gap: 10,
  },
  resultRowDisabled: {
    opacity: 0.5,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  resultMeta: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  resultSku: {
    color: "#6b7280",
    fontSize: 11,
  },
  resultPriceCol: {
    alignItems: "flex-end",
    marginRight: 4,
  },
  resultPrice: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "700",
  },
  resultOos: {
    color: "#ef4444",
    fontSize: 10,
    fontWeight: "600",
  },
  // Recent searches
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  recentHeaderText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clearAllText: {
    color: "#3b82f6",
    fontSize: 12,
    fontWeight: "600",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  recentRowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recentText: {
    color: "#d1d5db",
    fontSize: 14,
  },
  // Loading & no results
  loadingRow: {
    padding: 16,
    alignItems: "center",
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 14,
  },
  noResultsRow: {
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  noResultsText: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
  },
  moreRow: {
    padding: 8,
    alignItems: "center",
  },
  moreText: {
    color: "#6b7280",
    fontSize: 12,
  },
});

export default SearchResultsDropdown;
