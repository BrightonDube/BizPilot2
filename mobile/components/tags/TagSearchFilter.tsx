/**
 * TagSearchFilter — Mobile tag search and filtering component.
 * (tag-management task 25.6)
 *
 * Combines a debounced text search with a tag-cloud filter to let POS users
 * narrow results by one or more tags. Supports AND/OR matching modes.
 *
 * Why debounce the search input (300ms)?
 * Tag lists can be large and the parent fires a potentially expensive
 * filter/query on every search. Debouncing avoids jank during fast typing,
 * especially on mid-range Android tablets.
 *
 * Why AND / OR toggle?
 * Some POS workflows need "all selected tags must match" (AND) — e.g.
 * finding a product that is both "Vegan" and "Promo". Others want "any of
 * these" (OR) — e.g. showing everything tagged "Starter" or "Special".
 * Letting the cashier choose keeps the component flexible.
 *
 * Why category tabs above the cloud?
 * Tags across product/customer/order categories are semantically different.
 * Pre-filtering by category reduces cognitive load so the cashier doesn't
 * have to scan 50+ pills at once.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Tag {
  id: string;
  name: string;
  /** Hex colour string, e.g. "#3b82f6" */
  color: string;
  /** Tag category: product, customer, or order */
  category: "product" | "customer" | "order";
  /** Number of items using this tag */
  count: number;
}

export interface TagSearchFilterProps {
  /** Available tags to display in the cloud */
  tags: Tag[];
  /** IDs of currently selected tags */
  selectedTagIds: string[];
  /** Toggle a single tag on/off */
  onTagToggle: (tagId: string) => void;
  /** Remove all selected tags at once */
  onClearAll: () => void;
  /** Current boolean matching mode */
  searchMode: "AND" | "OR";
  /** Flip between AND ↔ OR */
  onSearchModeToggle: () => void;
  /** Fire a search with the current query, selected tag IDs, and mode */
  onSearch: (query: string, tagIds: string[], mode: "AND" | "OR") => void;
  /** Placeholder text for the search input */
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Category filter options shown as tabs above the tag cloud */
const CATEGORY_TABS = [
  { key: "all", label: "All", testID: "tag-category-all" },
  { key: "product", label: "Product", testID: "tag-category-product" },
  { key: "customer", label: "Customer", testID: "tag-category-customer" },
  { key: "order", label: "Order", testID: "tag-category-order" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TagSearchFilterComponent: React.FC<TagSearchFilterProps> = function TagSearchFilterComponent({
    tags,
    selectedTagIds,
    onTagToggle,
    onClearAll,
    searchMode,
    onSearchModeToggle,
    onSearch,
    placeholder = "Search…",
  }) {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Debounced query value passed to filtering logic */
    const [debouncedQuery, setDebouncedQuery] = useState("");

    // -----------------------------------------------------------------------
    // Debounce — 300ms pause before updating filtered results
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        setDebouncedQuery(query.trim());
      }, 300);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [query]);

    // -----------------------------------------------------------------------
    // Derived data
    // -----------------------------------------------------------------------

    /** Tags filtered by the active category tab */
    const categoryFilteredTags = useMemo(
      () =>
        activeCategory === "all"
          ? tags
          : tags.filter((t) => t.category === activeCategory),
      [tags, activeCategory],
    );

    /** Tags further filtered by the debounced text query */
    const visibleTags = useMemo(() => {
      if (!debouncedQuery) return categoryFilteredTags;
      const q = debouncedQuery.toLowerCase();
      return categoryFilteredTags.filter((t) =>
        t.name.toLowerCase().includes(q),
      );
    }, [categoryFilteredTags, debouncedQuery]);

    /** Only the tags that are currently selected (for the selected-tags bar) */
    const selectedTags = useMemo(
      () => tags.filter((t) => selectedTagIds.includes(t.id)),
      [tags, selectedTagIds],
    );

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    const handleTagToggle = useCallback(
      (tagId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTagToggle(tagId);
      },
      [onTagToggle],
    );

    const handleCategoryPress = useCallback((key: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveCategory(key);
    }, []);

    const handleModeToggle = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSearchModeToggle();
    }, [onSearchModeToggle]);

    const handleClearAll = useCallback(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onClearAll();
    }, [onClearAll]);

    const handleSearch = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSearch(query.trim(), selectedTagIds, searchMode);
    }, [onSearch, query, selectedTagIds, searchMode]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
      <View style={styles.container} testID="tag-search-filter">
        {/* ---- Search input ---- */}
        <View style={styles.searchRow}>
          <Ionicons
            name="search"
            size={20}
            color="#9ca3af"
            style={styles.searchIcon}
          />
          <TextInput
            testID="tag-search-input"
            style={styles.searchInput}
            placeholder={placeholder}
            placeholderTextColor="#6b7280"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search tags"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              hitSlop={8}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={18} color="#6b7280" />
            </Pressable>
          )}
        </View>

        {/* ---- AND / OR mode toggle ---- */}
        <View style={styles.modeRow}>
          <Text style={styles.modeLabel}>Match:</Text>
          <Pressable
            testID="tag-mode-toggle"
            style={[
              styles.modePill,
              searchMode === "AND" ? styles.modePillActive : null,
            ]}
            onPress={handleModeToggle}
            accessibilityLabel={`Search mode: ${searchMode}. Tap to toggle.`}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.modePillText,
                searchMode === "AND" ? styles.modePillTextActive : null,
              ]}
            >
              AND
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modePill,
              searchMode === "OR" ? styles.modePillActive : null,
            ]}
            onPress={handleModeToggle}
            accessibilityLabel={`Search mode: ${searchMode}. Tap to toggle.`}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.modePillText,
                searchMode === "OR" ? styles.modePillTextActive : null,
              ]}
            >
              OR
            </Text>
          </Pressable>
        </View>

        {/* ---- Category tabs ---- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.key;
            return (
              <Pressable
                key={tab.key}
                testID={tab.testID}
                style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                onPress={() => handleCategoryPress(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${tab.label} category${isActive ? ", selected" : ""}`}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    isActive && styles.categoryTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ---- Tag cloud ---- */}
        <ScrollView style={styles.cloudScroll} nestedScrollEnabled>
          <View style={styles.cloud}>
            {visibleTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  testID={`tag-pill-${tag.id}`}
                  style={[
                    styles.pill,
                    isSelected && { borderColor: tag.color, borderWidth: 2 },
                  ]}
                  onPress={() => handleTagToggle(tag.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${tag.name}, ${tag.count} items${isSelected ? ", selected" : ""}`}
                >
                  {/* Colour indicator dot */}
                  <View
                    style={[styles.pillDot, { backgroundColor: tag.color }]}
                  />
                  <Text style={styles.pillName}>{tag.name}</Text>
                  <View style={styles.pillCountBadge}>
                    <Text style={styles.pillCountText}>{tag.count}</Text>
                  </View>
                </Pressable>
              );
            })}

            {visibleTags.length === 0 && (
              <Text style={styles.emptyText}>No tags found</Text>
            )}
          </View>
        </ScrollView>

        {/* ---- Selected tags bar (visible only when tags are selected) ---- */}
        {selectedTags.length > 0 && (
          <View style={styles.selectedBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedContent}
            >
              {selectedTags.map((tag) => (
                <Pressable
                  key={tag.id}
                  testID={`tag-selected-${tag.id}`}
                  style={[styles.selectedPill, { borderColor: tag.color }]}
                  onPress={() => handleTagToggle(tag.id)}
                  accessibilityLabel={`Remove ${tag.name} tag`}
                  accessibilityRole="button"
                >
                  <Text style={styles.selectedPillText}>{tag.name}</Text>
                  <Ionicons name="close" size={14} color="#f3f4f6" />
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              testID="tag-clear-all"
              style={styles.clearBtn}
              onPress={handleClearAll}
              accessibilityLabel="Clear all selected tags"
              accessibilityRole="button"
            >
              <Text style={styles.clearBtnText}>Clear All</Text>
            </Pressable>
          </View>
        )}

        {/* ---- Search button ---- */}
        <Pressable
          testID="tag-search-btn"
          style={styles.searchBtn}
          onPress={handleSearch}
          accessibilityLabel="Search with selected tags"
          accessibilityRole="button"
        >
          <Ionicons name="search" size={18} color="#ffffff" />
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>
    );
  };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 12,
  },

  // Search input
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: "#f3f4f6",
  },

  // AND / OR toggle
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  modePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
  },
  modePillActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  modePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
  },
  modePillTextActive: {
    color: "#ffffff",
  },

  // Category tabs
  categoryScroll: {
    maxHeight: 44,
    marginBottom: 12,
  },
  categoryContent: {
    gap: 8,
    alignItems: "center",
    paddingVertical: 4,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1f2937",
  },
  categoryTabActive: {
    backgroundColor: "#3b82f6",
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  categoryTabTextActive: {
    color: "#ffffff",
  },

  // Tag cloud
  cloudScroll: {
    maxHeight: 200,
    marginBottom: 12,
  },
  cloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#374151",
    gap: 6,
  },
  pillDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pillName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  pillCountBadge: {
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: "center",
  },
  pillCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    paddingVertical: 16,
  },

  // Selected tags bar
  selectedBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
  },
  selectedContent: {
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  selectedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 4,
  },
  selectedPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ef4444",
  },

  // Search button
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
  },
  searchBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
});

export default React.memo(TagSearchFilterComponent) as typeof TagSearchFilterComponent;
