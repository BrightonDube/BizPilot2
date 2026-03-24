/**
 * ProductGrid.tsx — Grid of ProductCards with loading skeletons
 */

import { View, FlatList, Text, useWindowDimensions } from "react-native";
import type { POSProduct } from "@/types/pos";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: POSProduct[];
  isLoading: boolean;
  emptyMessage?: string;
}

/**
 * Responsive product grid: 3 columns on tablet, 2 on phone
 */
export function ProductGrid({ products, isLoading, emptyMessage = "No products found" }: ProductGridProps) {
  const { width } = useWindowDimensions();
  const numColumns = width > 768 ? 3 : 2;

  if (isLoading) {
    return (
      <View className="flex-row flex-wrap p-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} className="w-1/3 p-1">
            <View className="bg-gray-200 rounded-lg animate-pulse h-32" />
          </View>
        ))}
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View className="flex-1 justify-center items-center py-10">
        <Text className="text-gray-500 text-base">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      numColumns={numColumns}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View className="w-1/3 p-1">
          <ProductCard product={item} onPress={() => {}} />
        </View>
      )}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 4 }}
    />
  );
}
