/**
 * CartItemRow.tsx — One row in the cart panel with quantity stepper
 */

import { View, Text, Pressable, TextInput, Alert } from "react-native";
import type { CartItem } from "@/types";
import { useCartStore } from "@/stores/cartStore";

interface CartItemRowProps {
  item: CartItem;
}

/**
 * Cart item row with quantity stepper and inline editing
 */
export function CartItemRow({ item }: CartItemRowProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const lineTotal = (item.unitPrice * item.quantity - item.discount).toFixed(2);

  const handleMinus = () => {
    if (item.quantity <= 1) {
      removeItem(item.productId);
    } else {
      updateQuantity(item.productId, item.quantity - 1);
    }
  };

  const handlePlus = () => {
    updateQuantity(item.productId, item.quantity + 1);
  };

  const handleEditQuantity = () => {
    Alert.prompt(
      "Edit Quantity",
      "Enter new quantity:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          onPress: (val) => {
            const qty = parseInt(val || "1", 10);
            if (qty > 0) updateQuantity(item.productId, qty);
            else removeItem(item.productId);
          },
        },
      ],
      "plain-text",
      String(item.quantity)
    );
  };

  return (
    <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
      <View className="flex-1">
        <Text numberOfLines={1} className="text-sm font-medium text-gray-800">
          {item.productName}
        </Text>
        <Text className="text-xs text-gray-500">R{item.unitPrice.toFixed(2)} each</Text>
      </View>
      <View className="flex-row items-center">
        <Pressable onPress={handleMinus} className="w-8 h-8 bg-gray-200 rounded-full justify-center items-center">
          <Text className="text-gray-600 font-bold">−</Text>
        </Pressable>
        <Pressable onPress={handleEditQuantity} className="w-10 h-8 justify-center items-center">
          <Text className="text-sm font-medium text-gray-800">{item.quantity}</Text>
        </Pressable>
        <Pressable onPress={handlePlus} className="w-8 h-8 bg-emerald-600 rounded-full justify-center items-center">
          <Text className="text-white font-bold">+</Text>
        </Pressable>
      </View>
      <Text className="w-16 text-right text-sm font-medium text-gray-800">R{lineTotal}</Text>
    </View>
  );
}
