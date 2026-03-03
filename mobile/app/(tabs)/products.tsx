/**
 * BizPilot Mobile POS — Products Screen
 *
 * Browse product catalog with search and category filtering.
 * Read-only on the POS — adding/editing products is done on the web dashboard.
 *
 * Why read-only?
 * Product management (pricing, images, descriptions) is complex and
 * better suited to a full desktop interface. The mobile app focuses
 * on selling, not catalog management. Staff can see stock levels
 * and product details, but changes flow from the web dashboard via sync.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Card, Badge } from "@/components/ui";
import { formatCurrency } from "@/utils/formatters";
import { useProducts, useCategories } from "@/hooks";
import type { MobileProduct } from "@/types";

// ---------------------------------------------------------------------------
// ProductRow sub-component
// ---------------------------------------------------------------------------

interface ProductRowProps {
  product: MobileProduct;
  isSelected: boolean;
  onSelect: (product: MobileProduct) => void;
}

const ProductRow: React.FC<ProductRowProps> = React.memo(function ProductRow({
  product,
  isSelected,
  onSelect,
}) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(product);
  }, [product, onSelect]);

  const stockColor =
    product.stockQuantity > 10
      ? "#22c55e"
      : product.stockQuantity > 0
      ? "#f59e0b"
      : "#ef4444";

  return (
    <Pressable onPress={handlePress}>
      <Card>
        <View
          style={[
            styles.productRow,
            isSelected && styles.productRowSelected,
          ]}
        >
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text style={styles.productName}>{product.name}</Text>
              {!product.isActive && <Badge label="Inactive" variant="warning" />}
            </View>
            <Text style={styles.productMeta}>
              {product.sku ? `SKU: ${product.sku} · ` : ""}
              {product.barcode ? `BC: ${product.barcode}` : ""}
            </Text>
          </View>

          {/* Stock */}
          <View style={styles.stockColumn}>
            <Text style={[styles.stockText, { color: stockColor }]}>
              {product.trackInventory
                ? product.stockQuantity > 0
                  ? `${product.stockQuantity} in stock`
                  : "Out of stock"
                : "Not tracked"}
            </Text>
          </View>

          {/* Price */}
          <Text style={styles.productPrice}>
            {formatCurrency(product.price)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// ProductDetail sub-component
// ---------------------------------------------------------------------------

interface ProductDetailProps {
  product: MobileProduct;
}

const ProductDetail: React.FC<ProductDetailProps> = React.memo(
  function ProductDetail({ product }) {
    const stockColor =
      product.stockQuantity > 10
        ? "#22c55e"
        : product.stockQuantity > 0
        ? "#f59e0b"
        : "#ef4444";

    return (
      <View style={styles.detailContainer}>
        <Text style={styles.detailTitle}>{product.name}</Text>

        {product.description && (
          <Text style={styles.detailDescription}>{product.description}</Text>
        )}

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.detailPrice}>{formatCurrency(product.price)}</Text>
        </View>

        {product.costPrice != null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cost Price</Text>
            <Text style={styles.detailValue}>
              {formatCurrency(product.costPrice)}
            </Text>
          </View>
        )}

        {product.costPrice != null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Margin</Text>
            <Text style={styles.detailValue}>
              {(
                ((product.price - product.costPrice) / product.price) *
                100
              ).toFixed(1)}
              %
            </Text>
          </View>
        )}

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>SKU</Text>
          <Text style={styles.detailValue}>{product.sku ?? "—"}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Barcode</Text>
          <Text style={styles.detailValue}>{product.barcode ?? "—"}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <Badge
            label={product.isActive ? "Active" : "Inactive"}
            variant={product.isActive ? "default" : "warning"}
          />
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Stock</Text>
          <Text style={[styles.detailValue, { color: stockColor, fontWeight: "700" }]}>
            {product.trackInventory
              ? `${product.stockQuantity} units`
              : "Not tracked"}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Last Updated</Text>
          <Text style={styles.detailValue}>
            {new Date(product.updatedAt).toLocaleDateString("en-ZA")}
          </Text>
        </View>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Main Products Screen
// ---------------------------------------------------------------------------

export default function ProductsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<MobileProduct | null>(
    null
  );

  const { products, loading: isLoading } = useProducts({ categoryId: selectedCategory ?? undefined, searchQuery: search });
  const { categories } = useCategories();

  const handleSelectProduct = useCallback((product: MobileProduct) => {
    setSelectedProduct(product);
  }, []);

  const renderProduct = useCallback(
    ({ item }: { item: MobileProduct }) => (
      <ProductRow
        product={item}
        isSelected={selectedProduct?.id === item.id}
        onSelect={handleSelectProduct}
      />
    ),
    [selectedProduct, handleSelectProduct]
  );

  const keyExtractor = useCallback((item: MobileProduct) => item.id, []);

  return (
    <View style={styles.screen}>
      {/* Header with search */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Products</Text>
        <Text style={styles.headerCount}>{products.length} products</Text>
      </View>

      <View style={styles.searchFilterBar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6b7280" />
          <TextInput
            placeholder="Search by name, SKU, or barcode..."
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </Pressable>
          )}
        </View>

        {/* Category filter chips */}
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={[
              styles.filterChip,
              selectedCategory === null && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategory === null && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              style={[
                styles.filterChip,
                selectedCategory === cat.id && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === cat.id && styles.filterChipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content: list + detail */}
      <View style={styles.content}>
        <FlatList
          data={products}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          style={isTablet ? styles.listTablet : styles.listFull}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="grid-outline" size={48} color="#374151" />
              <Text style={styles.emptyText}>
                {isLoading ? "Loading products..." : "No products found"}
              </Text>
            </View>
          }
          renderItem={renderProduct}
        />

        {/* Detail panel (tablet only) */}
        {isTablet && (
          <View style={styles.detailPanel}>
            {selectedProduct ? (
              <ProductDetail product={selectedProduct} />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={48} color="#374151" />
                <Text style={styles.emptyText}>Select a product to view details</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  headerCount: {
    color: "#6b7280",
    fontSize: 14,
  },
  searchFilterBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    backgroundColor: "#374151",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: "#3b82f6",
  },
  filterChipText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  listFull: {
    flex: 1,
  },
  listTablet: {
    flex: 1,
    maxWidth: 460,
  },
  listContent: {
    padding: 12,
    gap: 8,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  productRowSelected: {
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
  },
  productInfo: {
    flex: 1,
  },
  productHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  productName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  productMeta: {
    color: "#9ca3af",
    fontSize: 13,
  },
  stockColumn: {
    alignItems: "flex-end",
    marginRight: 16,
  },
  stockText: {
    fontSize: 13,
    fontWeight: "600",
  },
  productPrice: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "700",
  },
  detailPanel: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: "#374151",
  },
  detailContainer: {
    padding: 20,
    gap: 12,
  },
  detailTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  detailDescription: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    color: "#9ca3af",
    fontSize: 14,
  },
  detailValue: {
    color: "#ffffff",
    fontSize: 14,
  },
  detailPrice: {
    color: "#22c55e",
    fontSize: 20,
    fontWeight: "700",
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#374151",
    marginVertical: 4,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 14,
  },
});
