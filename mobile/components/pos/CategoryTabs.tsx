/**
 * CategoryTabs.tsx — Horizontal category filter bar
 */

import { ScrollView, Pressable, Text, View } from "react-native";
import type { POSCategory } from "@/types/pos";

interface CategoryTabsProps {
  categories: POSCategory[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * Horizontal scrollable category tabs with "All" option
 */
export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-2">
      <Pressable
        onPress={() => onSelect(null)}
        className={`px-4 py-2 rounded-full mr-2 ${
          selectedId === null ? "bg-emerald-600" : "bg-gray-200"
        }`}
      >
        <Text className={`text-sm font-medium ${selectedId === null ? "text-white" : "text-gray-700"}`}>
          All
        </Text>
      </Pressable>
      {sorted.map((cat) => {
        const isActive = selectedId === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            className={`px-4 py-2 rounded-full mr-2 ${
              isActive ? "bg-emerald-600" : "bg-gray-200"
            }`}
            style={!isActive && cat.color ? { backgroundColor: cat.color } : undefined}
          >
            <Text className={`text-sm font-medium ${isActive ? "text-white" : "text-gray-700"}`}>
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
