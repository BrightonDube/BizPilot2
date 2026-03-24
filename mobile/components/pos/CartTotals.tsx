/**
 * CartTotals.tsx — Subtotal, tax, discount, and grand total
 */

import { View, Text } from "react-native";

interface CartTotalsProps {
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  discountAmount: number;
  grandTotal: number;
}

/**
 * Cart totals breakdown with ZAR formatting
 */
export function CartTotals({ subtotal, taxAmount, taxRate, discountAmount, grandTotal }: CartTotalsProps) {
  return (
    <View className="border-t border-gray-200 pt-3 mt-2">
      <View className="flex-row justify-between py-1">
        <Text className="text-sm text-gray-600">Subtotal:</Text>
        <Text className="text-sm text-gray-800">R{subtotal.toFixed(2)}</Text>
      </View>
      <View className="flex-row justify-between py-1">
        <Text className="text-sm text-gray-600">Tax ({taxRate}%):</Text>
        <Text className="text-sm text-gray-800">R{taxAmount.toFixed(2)}</Text>
      </View>
      {discountAmount > 0 && (
        <View className="flex-row justify-between py-1">
          <Text className="text-sm text-gray-600">Discount:</Text>
          <Text className="text-sm text-red-500">-R{discountAmount.toFixed(2)}</Text>
        </View>
      )}
      <View className="flex-row justify-between py-2 mt-1 border-t border-gray-200">
        <Text className="text-lg font-bold text-gray-800">TOTAL:</Text>
        <Text className="text-lg font-bold text-emerald-600">R{grandTotal.toFixed(2)}</Text>
      </View>
    </View>
  );
}
