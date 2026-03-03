/**
 * BizPilot Mobile POS — CategoryTabs Component
 *
 * Horizontal scrollable category filter for the POS product grid.
 * Always includes an "All" option as the first tab.
 * Supports nested (parent → child) categories with a two-row layout.
 *
 * Why horizontal scroll instead of a dropdown?
 * In a POS environment, speed matters. A scrollable tab bar lets
 * the cashier see and tap categories in one gesture. A dropdown
 * requires two taps (open → select) and obscures the product grid.
 *
 * Why colored backgrounds on active tabs?
 * Each category has an assigned color. Using it on the active tab
 * provides instant visual feedback about which filter is active,
 * even from peripheral vision during a busy shift.
 *
 * Why a two-row layout for subcategories?
 * Nesting subcategories inside a single scrollable row would make
 * the list too long. A second row only appears when the selected
 * parent has children, keeping the UI compact when unused.
 */

import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import type { MobileCategory } from "@/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CategoryTabsProps {
  /** Available categories to display as tabs */
  categories: Pick<MobileCategory, "id" | "name" | "color" | "parentId">[];
  /** Currently selected category ID ("all" for no filter) */
  selectedId: string;
  /** Called when a category tab is tapped */
  onSelect: (categoryId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CategoryTabs: React.FC<CategoryTabsProps> = React.memo(
  function CategoryTabs({ categories, selectedId, onSelect }) {
    const scrollRef = useRef<ScrollView>(null);
    const subScrollRef = useRef<ScrollView>(null);

    const handlePress = useCallback(
      (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(id);
      },
      [onSelect]
    );

    // Separate parent categories (parentId === null) from child categories
    const parentCategories = useMemo(
      () => categories.filter((c) => c.parentId == null),
      [categories]
    );

    // Find which parent is currently selected (or whose child is selected)
    const activeParentId = useMemo(() => {
      if (selectedId === "all") return "all";
      // Check if selectedId is a parent
      const isParent = parentCategories.some((c) => c.id === selectedId);
      if (isParent) return selectedId;
      // Check if selectedId is a child — find its parent
      const childCat = categories.find((c) => c.id === selectedId);
      return childCat?.parentId ?? "all";
    }, [selectedId, parentCategories, categories]);

    // Subcategories of the currently active parent
    const subcategories = useMemo(() => {
      if (activeParentId === "all") return [];
      return categories.filter((c) => c.parentId === activeParentId);
    }, [activeParentId, categories]);

    // Prepend "All" option to parents
    const allParents = useMemo(
      () => [
        { id: "all", name: "All", color: "#3b82f6", parentId: null },
        ...parentCategories,
      ],
      [parentCategories]
    );

    return (
      <View>
        {/* Parent category row */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollContainer}
          contentContainerStyle={styles.contentContainer}
        >
          {allParents.map((category) => {
            const isSelected = activeParentId === category.id;
            const bgColor = isSelected
              ? category.color ?? "#3b82f6"
              : "#374151";

            return (
              <Pressable
                key={category.id}
                onPress={() => handlePress(category.id)}
                style={[styles.tab, { backgroundColor: bgColor }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${category.name} category${
                  isSelected ? ", selected" : ""
                }`}
              >
                <Text
                  style={[
                    styles.tabText,
                    isSelected && styles.tabTextSelected,
                  ]}
                >
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Subcategory row — only shown when parent has children */}
        {subcategories.length > 0 && (
          <ScrollView
            ref={subScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.subScrollContainer}
            contentContainerStyle={styles.contentContainer}
          >
            {/* "All" within this parent */}
            <Pressable
              onPress={() => handlePress(activeParentId)}
              style={[
                styles.subTab,
                selectedId === activeParentId && styles.subTabSelected,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedId === activeParentId }}
            >
              <Text
                style={[
                  styles.subTabText,
                  selectedId === activeParentId && styles.subTabTextSelected,
                ]}
              >
                All
              </Text>
            </Pressable>

            {subcategories.map((sub) => {
              const isSubSelected = selectedId === sub.id;
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => handlePress(sub.id)}
                  style={[
                    styles.subTab,
                    isSubSelected && styles.subTabSelected,
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSubSelected }}
                  accessibilityLabel={`${sub.name} subcategory${
                    isSubSelected ? ", selected" : ""
                  }`}
                >
                  <Text
                    style={[
                      styles.subTabText,
                      isSubSelected && styles.subTabTextSelected,
                    ]}
                  >
                    {sub.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollContainer: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  contentContainer: {
    paddingHorizontal: 8,
    gap: 6,
    alignItems: "center",
    paddingVertical: 6,
  },
  tab: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabText: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextSelected: {
    color: "#ffffff",
  },
  // Subcategory row
  subScrollContainer: {
    maxHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    backgroundColor: "#1a1f2e",
  },
  subTab: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  subTabSelected: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  subTabText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "500",
  },
  subTabTextSelected: {
    color: "#ffffff",
  },
});

export default CategoryTabs;
