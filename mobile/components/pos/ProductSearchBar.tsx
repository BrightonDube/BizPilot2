/**
 * ProductSearchBar.tsx — Debounced search input with clear button
 */

import { View, TextInput, Pressable, Text } from "react-native";

interface ProductSearchBarProps {
  value: string;
  onChange: (text: string) => void;
  onClear: () => void;
}

/**
 * Search input with clear button
 */
export function ProductSearchBar({ value, onChange, onClear }: ProductSearchBarProps) {
  return (
    <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
      <Text className="text-gray-400 mr-2">🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search products..."
        placeholderTextColor="#9CA3AF"
        className="flex-1 text-gray-800 text-base"
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={onClear} className="ml-2 p-1">
          <Text className="text-gray-400 text-lg">×</Text>
        </Pressable>
      )}
    </View>
  );
}
