/**
 * FloatingCartButton.tsx — Phone-only FAB showing item count and total
 */

import { View, Text, Pressable } from "react-native";

interface FloatingCartButtonProps {
  itemCount: number;
  grandTotal: number;
  onPress: () => void;
}

/**
 * Floating action button for cart on phone layout
 */
export function FloatingCartButton({ itemCount, grandTotal, onPress }: FloatingCartButtonProps) {
  if (itemCount === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      className="absolute bottom-6 right-6 flex-row items-center bg-emerald-600 px-4 py-3 rounded-full shadow-lg"
    >
      <Text className="text-white text-lg mr-2">🛒</Text>
      <View className="bg-white rounded-full w-6 h-6 justify-center items-center mr-2">
        <Text className="text-emerald-600 text-xs font-bold">{itemCount}</Text>
      </View>
      <Text className="text-white font-bold">R{grandTotal.toFixed(2)}</Text>
    </Pressable>
  );
}
