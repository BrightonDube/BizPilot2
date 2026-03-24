/**
 * ProductCard.tsx — Single product tile for POS grid
 */

import { View, Text, Pressable, Image } from "react-native";
import * as Haptics from "expo-haptics";
import type { POSProduct } from "@/types/pos";
import { useCartStore } from "@/stores/cartStore";

interface ProductCardProps {
  product: POSProduct;
  onPress: () => void;
}

/**
 * Product card with touch feedback and haptic response
 * Minimum touch target: 100x100 points
 */
export function ProductCard({ product, onPress }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const isOutOfStock = !product.is_in_stock;

  const handlePress = async () => {
    if (isOutOfStock) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addItem({
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
    });
    onPress();
  };

  return (
    <Pressable
      testID={`product-${product.id}`}
      onPress={handlePress}
      disabled={isOutOfStock}
      className={`min-w-[100] min-h-[100] m-1 rounded-lg overflow-hidden bg-white border border-gray-200 ${
        isOutOfStock ? "opacity-40" : ""
      }`}
    >
      <View className="w-full h-24 bg-gray-100 justify-center items-center">
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Text className="text-3xl">📦</Text>
        )}
        {isOutOfStock && (
          <View className="absolute bottom-0 left-0 right-0 bg-red-500 py-1">
            <Text className="text-white text-xs text-center font-medium">Out of Stock</Text>
          </View>
        )}
      </View>
      <View className="p-2">
        <Text numberOfLines={2} className="text-sm font-medium text-gray-800">
          {product.name}
        </Text>
        <Text className="text-sm font-bold text-emerald-600 mt-1">R{product.price.toFixed(2)}</Text>
      </View>
    </Pressable>
  );
}
