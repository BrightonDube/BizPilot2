/**
 * index.tsx — Mobile POS Selling Screen
 * Main tab. Left/top: search + categories + product grid.
 * Right/bottom (tablet) or modal (phone): cart.
 * All cart state managed by cartStore (Zustand).
 * Route: /(tabs)/index
 */

import { useState, useCallback } from "react";
import { View, useWindowDimensions, Modal, Pressable, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CategoryTabs } from "@/components/pos/CategoryTabs";
import { ProductSearchBar } from "@/components/pos/ProductSearchBar";
import { CartPanel } from "@/components/pos/CartPanel";
import { FloatingCartButton } from "@/components/pos/FloatingCartButton";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useCartStore } from "@/stores/cartStore";

export default function POSScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width > 768;
  const router = useRouter();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [cartVisible, setCartVisible] = useState(false);

  const { products, isLoading } = useProducts(selectedCategoryId ?? undefined, searchText);
  const { categories } = useCategories();

  const getItemCount = useCartStore((s) => s.getItemCount);
  const getTotal = useCartStore((s) => s.getTotal);

  const itemCount = getItemCount();
  const grandTotal = getTotal();

  const handleCategorySelect = useCallback((id: string | null) => {
    setSelectedCategoryId(id);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchText("");
  }, []);

  const handleCharge = useCallback(() => {
    router.push("/(tabs)/payment");
  }, [router]);

  if (isTablet) {
    return (
      <View className="flex-1 flex-row bg-gray-50">
        {/* Left 65%: Search + Categories + Product Grid */}
        <View className="flex-[0.65] p-3">
          <ProductSearchBar
            value={searchText}
            onChange={handleSearchChange}
            onClear={handleSearchClear}
          />
          <CategoryTabs
            categories={categories}
            selectedId={selectedCategoryId}
            onSelect={handleCategorySelect}
          />
          <ProductGrid products={products} isLoading={isLoading} />
        </View>

        {/* Right 35%: Cart Panel */}
        <View className="flex-[0.35] border-l border-gray-200 bg-white">
          <CartPanel onCharge={handleCharge} />
        </View>
      </View>
    );
  }

  // Phone layout
  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-3">
        <ProductSearchBar
          value={searchText}
          onChange={handleSearchChange}
          onClear={handleSearchClear}
        />
        <CategoryTabs
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={handleCategorySelect}
        />
      </View>

      <ProductGrid products={products} isLoading={isLoading} />

      <FloatingCartButton
        itemCount={itemCount}
        grandTotal={grandTotal}
        onPress={() => setCartVisible(true)}
      />

      <Modal visible={cartVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl h-[80%]">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-lg font-bold text-gray-800">Cart</Text>
              <Pressable onPress={() => setCartVisible(false)}>
                <Text className="text-gray-500 text-xl">×</Text>
              </Pressable>
            </View>
            <CartPanel onCharge={handleCharge} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
