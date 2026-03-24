/**
 * CartPanel.tsx — Full cart: items + totals + charge button
 */

import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { useCartStore } from "@/stores/cartStore";
import { CartItemRow } from "./CartItemRow";
import { CartTotals } from "./CartTotals";
import { DEFAULT_VAT_RATE } from "@/utils/constants";

interface CartPanelProps {
  onCharge: () => void;
}

/**
 * Cart panel with items list, totals, and charge button
 */
export function CartPanel({ onCharge }: CartPanelProps) {
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTaxAmount = useCartStore((s) => s.getTaxAmount);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const clearCart = useCartStore((s) => s.clear);
  const discount = useCartStore((s) => s.discount);

  const subtotal = getSubtotal();
  const taxAmount = getTaxAmount();
  const grandTotal = getTotal();
  const itemCount = getItemCount();
  const isEmpty = items.length === 0;

  const handleClear = () => {
    Alert.alert("Clear Cart", "Are you sure you want to clear all items?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearCart },
    ]);
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1">
        {isEmpty ? (
          <View className="flex-1 justify-center items-center px-4">
            <Text className="text-gray-500 text-center">Cart is empty — tap a product to add it</Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-3">
            {items.map((item) => (
              <CartItemRow key={item.productId} item={item} />
            ))}
          </ScrollView>
        )}
      </View>

      {!isEmpty && (
        <Pressable onPress={handleClear} className="px-3 py-2">
          <Text className="text-sm text-red-500 text-center">Clear</Text>
        </Pressable>
      )}

      <View className="px-3 pb-3">
        <CartTotals
          subtotal={subtotal}
          taxAmount={taxAmount}
          taxRate={DEFAULT_VAT_RATE * 100}
          discountAmount={discount}
          grandTotal={grandTotal}
        />
        <Pressable
          onPress={onCharge}
          disabled={isEmpty}
          className={`mt-3 py-3 rounded-lg ${
            isEmpty ? "bg-gray-300" : "bg-emerald-600"
          }`}
        >
          <Text className={`text-center font-bold text-lg ${isEmpty ? "text-gray-500" : "text-white"}`}>
            Charge R{grandTotal.toFixed(2)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
