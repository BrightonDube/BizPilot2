/**
 * BizPilot Mobile POS — Main POS/Sales Screen
 *
 * Split-pane layout: product grid (left) + cart panel (right).
 * This is THE primary screen — staff spend 90%+ of their time here.
 *
 * Why split-pane and not full-screen grid with a bottom sheet cart?
 * On a tablet (the primary device), a split-pane shows both the
 * product grid AND the cart simultaneously. This eliminates the
 * need to switch between views, saving ~2 seconds per transaction.
 * At 200+ transactions/day, that's 6+ minutes saved daily.
 *
 * Architecture:
 * This screen is now a thin orchestrator. All UI lives in extracted
 * components (ProductGrid, CartPanel, etc.) and all data comes from
 * hooks (useProducts, useCategories). This keeps the screen testable
 * and each component independently reusable.
 */

import React, { useState, useCallback, useMemo } from "react";
import { View, useWindowDimensions, StyleSheet, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import {
  ProductGrid,
  CategoryTabs,
  SearchBar,
  CartPanel,
  PaymentModal,
  CustomerSelector,
  Receipt,
  FavoriteProducts,
  SearchResultsDropdown,
} from "@/components/pos";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useCustomers } from "@/hooks/useCustomers";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import { useFavoriteProducts } from "@/hooks/useFavoriteProducts";
import { useLastCategory } from "@/hooks/useLastCategory";
import { createOrder, validateOrderInput } from "@/services/OrderService";
import type { MobileProduct, MobileOrder, MobileOrderItem, MobileCustomer } from "@/types";
import type { PaymentMethod } from "@/components/pos/PaymentModal";

// ---------------------------------------------------------------------------
// Main POS Screen
// ---------------------------------------------------------------------------

export default function PosScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Persist and restore last selected category
  const { lastCategoryId, setLastCategory, loaded: categoryLoaded } = useLastCategory();

  // Data hooks
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Sync persisted category once loaded
  const effectiveCategory = categoryLoaded ? selectedCategory : lastCategoryId;

  // Initialize selectedCategory from persisted value (only on first load)
  React.useEffect(() => {
    if (categoryLoaded && lastCategoryId !== "all") {
      setSelectedCategory(lastCategoryId);
    }
  }, [categoryLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const { products, loading: productsLoading } = useProducts({
    categoryId: effectiveCategory,
    searchQuery,
  });
  const { categories } = useCategories();
  const { customers } = useCustomers();

  // Recent searches
  const {
    recentSearches,
    addSearch,
    removeSearch: removeRecentSearch,
    clearAll: clearRecentSearches,
  } = useRecentSearches();

  // Favorite products
  const user = useAuthStore((s) => s.user);
  const { favoriteIds, toggleFavorite } = useFavoriteProducts(user?.id ?? null);

  // All products (unfiltered) for favorites and search results
  const { products: allProducts } = useProducts({
    categoryId: "all",
    searchQuery: "",
  });

  // Search results for the dropdown (match by name, SKU, barcode)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length === 0) return [];
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [searchQuery, allProducts]);

  // Cart store
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const cartDiscount = useCartStore((s) => s.discount);
  const clear = useCartStore((s) => s.clear);
  const getTotal = useCartStore((s) => s.getTotal);

  // Auth store (for order creation)
  const businessName = useSettingsStore((s) => s.businessName);

  // Modal states
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [customerSelectorVisible, setCustomerSelectorVisible] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);

  // Customer selection
  const [selectedCustomer, setSelectedCustomer] = useState<MobileCustomer | null>(null);

  // Last completed order (for receipt)
  const [lastOrder, setLastOrder] = useState<MobileOrder | null>(null);
  const [lastOrderItems, setLastOrderItems] = useState<MobileOrderItem[]>([]);
  const [lastChange, setLastChange] = useState(0);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      setSelectedCategory(categoryId);
      setLastCategory(categoryId);
    },
    [setLastCategory]
  );

  const handleAddProduct = useCallback(
    (productId: string) => {
      const product = allProducts.find((p) => p.id === productId);
      if (!product) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addItem({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        discount: 0,
        notes: null,
      });
    },
    [allProducts, addItem]
  );

  const handleAddFavoriteToCart = useCallback(
    (product: MobileProduct) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addItem({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        discount: 0,
        notes: null,
      });
    },
    [addItem]
  );

  const handleSearchSubmit = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.trim().length > 0) {
        addSearch(query.trim());
      }
    },
    [addSearch]
  );

  const handleSelectSearchResult = useCallback(
    (product: MobileProduct) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addItem({
        productId: product.id,
        productName: product.name,
        unitPrice: product.price,
        discount: 0,
        notes: null,
      });
      setSearchFocused(false);
      if (searchQuery.trim().length > 0) {
        addSearch(searchQuery.trim());
      }
    },
    [addItem, searchQuery, addSearch]
  );

  const handleSelectRecentSearch = useCallback(
    (term: string) => {
      setSearchQuery(term);
      handleSearchSubmit(term);
    },
    [handleSearchSubmit]
  );

  const handleCheckout = useCallback(() => {
    if (items.length === 0) return;
    setPaymentVisible(true);
  }, [items.length]);

  const handleSelectCustomer = useCallback((customer: MobileCustomer) => {
    setSelectedCustomer(customer);
    useCartStore.getState().setCustomer(customer.id);
  }, []);

  const handleConfirmPayment = useCallback(
    (payment: { method: PaymentMethod; amountTendered: number; change: number }) => {
      // Validate order
      const validation = validateOrderInput({
        items,
        paymentMethod: payment.method,
        createdBy: user?.id ?? "unknown",
      });

      if (!validation.valid) {
        Alert.alert("Order Error", validation.errors.join("\n"));
        return;
      }

      // Create order
      const result = createOrder({
        items,
        cartDiscount,
        customerId: selectedCustomer?.id ?? null,
        paymentMethod: payment.method,
        amountTendered: payment.amountTendered,
        change: payment.change,
        notes: useCartStore.getState().notes,
        createdBy: user?.id ?? "unknown",
      });

      // Store for receipt display
      setLastOrder(result.order);
      setLastOrderItems(result.orderItems);
      setLastChange(payment.change);

      // Close payment modal, show receipt
      setPaymentVisible(false);
      setReceiptVisible(true);
    },
    [items, cartDiscount, selectedCustomer, user]
  );

  const handleNewSale = useCallback(() => {
    clear();
    setSelectedCustomer(null);
    setLastOrder(null);
    setLastOrderItems([]);
    setLastChange(0);
    setReceiptVisible(false);
  }, [clear]);

  // ------------------------------------------------------------------
  // Layout
  // ------------------------------------------------------------------

  return (
    <View style={[styles.root, { flexDirection: isTablet ? "row" : "column" }]}>
      {/* Product grid section */}
      <View style={{ flex: isTablet ? 2 : 1 }}>
        {/* Favorite products strip */}
        <FavoriteProducts
          favoriteIds={favoriteIds}
          products={allProducts}
          onAddToCart={handleAddFavoriteToCart}
          onToggleFavorite={toggleFavorite}
        />

        <CategoryTabs
          categories={categories}
          selectedId={effectiveCategory}
          onSelect={handleCategorySelect}
        />
        <SearchBar
          placeholder="Search by name, SKU, barcode..."
          onSearch={handleSearchSubmit}
          inputProps={{
            onFocus: () => setSearchFocused(true),
            onBlur: () => {
              // Delay hiding dropdown so tap on result registers
              setTimeout(() => setSearchFocused(false), 200);
            },
          }}
        />

        {/* Search results dropdown (overlays product grid) */}
        {searchFocused && (
          <SearchResultsDropdown
            query={searchQuery}
            results={searchResults}
            recentSearches={recentSearches}
            onSelectProduct={handleSelectSearchResult}
            onSelectRecentSearch={handleSelectRecentSearch}
            onClearRecentSearches={clearRecentSearches}
            onRemoveRecentSearch={removeRecentSearch}
          />
        )}

        <ProductGrid
          products={products}
          onProductPress={handleAddProduct}
          loading={productsLoading}
          numColumns={isTablet ? 3 : 2}
        />
      </View>

      {/* Cart panel */}
      <CartPanel
        isTablet={isTablet}
        width={320}
        onCheckout={handleCheckout}
        onSelectCustomer={() => setCustomerSelectorVisible(true)}
        customerName={selectedCustomer?.name ?? null}
      />

      {/* Payment modal */}
      <PaymentModal
        visible={paymentVisible}
        onClose={() => setPaymentVisible(false)}
        totalDue={getTotal()}
        onConfirmPayment={handleConfirmPayment}
      />

      {/* Customer selector modal */}
      <CustomerSelector
        visible={customerSelectorVisible}
        onClose={() => setCustomerSelectorVisible(false)}
        onSelect={handleSelectCustomer}
        customers={customers}
        selectedCustomerId={selectedCustomer?.id ?? null}
      />

      {/* Receipt modal */}
      {lastOrder && (
        <Receipt
          visible={receiptVisible}
          onClose={() => setReceiptVisible(false)}
          order={lastOrder}
          items={lastOrderItems}
          customerName={selectedCustomer?.name ?? null}
          businessName={businessName}
          change={lastChange}
          onNewSale={handleNewSale}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1f2937",
  },
});
