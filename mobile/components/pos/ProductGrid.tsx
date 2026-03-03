/**
 * BizPilot Mobile POS — ProductGrid Component
 *
 * Virtualized grid of ProductCards for the main POS selling screen.
 * Uses FlashList for smooth 60fps scrolling with 1000+ products.
 *
 * Why FlashList over FlatList?
 * FlatList creates all cells up front and uses React.createElement
 * for recycling. FlashList reuses native views directly, which is
 * measurably faster for grids with 100+ items on mid-range tablets.
 * Shopify benchmarks show 5× fewer blank cells during fast scrolling.
 *
 * Why numColumns as a prop instead of hardcoded?
 * Tablets get 3-4 columns, phones get 2. The parent screen determines
 * the column count based on useWindowDimensions().width.
 */

import React, { useCallback } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import ProductCard from "./ProductCard";
import type { MobileProduct } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProductGridProps {
  /** Products to display in the grid */
  products: MobileProduct[];
  /** Number of columns in the grid */
  numColumns?: number;
  /** Called when a product card is tapped */
  onProductPress: (productId: string) => void;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Optional header component (e.g., search bar above grid) */
  ListHeaderComponent?: React.ReactElement;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="grid-outline" size={48} color="#374151" />
      <Text style={styles.emptyText}>No products found</Text>
      <Text style={styles.emptySubtext}>
        Try a different category or search term
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton({ columns }: { columns: number }) {
  const skeletons = Array.from({ length: columns * 3 }, (_, i) => i);

  return (
    <View style={styles.skeletonGrid}>
      {skeletons.map((i) => (
        <View
          key={i}
          style={[
            styles.skeletonCard,
            { width: `${Math.floor(100 / columns) - 2}%` },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProductGrid: React.FC<ProductGridProps> = React.memo(
  function ProductGrid({
    products,
    numColumns,
    onProductPress,
    loading = false,
    ListHeaderComponent,
  }) {
    const { width } = useWindowDimensions();

    // Default column count based on screen width
    const columns = numColumns ?? (width >= 768 ? 4 : 2);

    const renderItem = useCallback(
      ({ item }: { item: MobileProduct }) => (
        <ProductCard
          id={item.id}
          name={item.name}
          price={item.price}
          imageUrl={item.imageUrl}
          stockQuantity={item.stockQuantity}
          trackInventory={item.trackInventory}
          isActive={item.isActive}
          onPress={onProductPress}
        />
      ),
      [onProductPress]
    );

    const keyExtractor = useCallback((item: MobileProduct) => item.id, []);

    if (loading) {
      return <LoadingSkeleton columns={columns} />;
    }

    return (
      <FlashList
        data={products}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={columns}
        estimatedItemSize={130}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={<EmptyState />}
      />
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  listContent: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubtext: {
    color: "#4b5563",
    fontSize: 14,
    marginTop: 4,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    gap: 8,
  },
  skeletonCard: {
    height: 120,
    backgroundColor: "#374151",
    borderRadius: 12,
    opacity: 0.5,
  },
});

export default ProductGrid;
