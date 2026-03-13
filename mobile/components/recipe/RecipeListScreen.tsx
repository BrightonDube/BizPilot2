/**
 * RecipeListScreen — displays all recipes with search and food-cost badges.
 * (recipe-management task 3.1)
 *
 * Layout: Flat list of recipe cards, searchable by name. Each card shows the
 * recipe name, portion count, food-cost % badge (colour-coded by industry
 * threshold: green ≤ 30%, amber 30-35%, red > 35%), and cost per portion.
 *
 * Why FlatList with getItemLayout?
 * Recipes in a hospitality setting can number 200+. Fixed-height cards let
 * FlatList recycle views efficiently and avoid layout thrashing on scroll.
 *
 * Why does this component accept recipes as a prop instead of fetching?
 * The data layer (WatermelonDB / API) varies by sync context. Keeping the
 * component pure lets us drive it from both the offline DB and the live API
 * without changing the UI code.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { calculateRecipeCost, calculateFoodCostPercentage } from "@/services/recipe/RecipeService";
import type { Recipe } from "@/services/recipe/RecipeService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecipeListScreenProps {
  /** All recipes to display (pre-loaded from DB/API). */
  recipes: Recipe[];
  /** Map of menuItemId → selling price, used to compute food-cost %. */
  sellingPrices: Record<string, number>;
  /** Called when the user taps a recipe card. */
  onSelectRecipe: (recipe: Recipe) => void;
  /** Called when the user taps "Add Recipe". */
  onAddRecipe?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed card height for getItemLayout optimisation. */
const CARD_HEIGHT = 96;
/** Spacing between cards. */
const CARD_GAP = 12;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FoodCostBadgeProps {
  percentage: number;
}

/**
 * Colour-coded badge showing food cost percentage.
 * Green ≤ 30%, amber 30-35%, red > 35%.
 */
const FoodCostBadge = React.memo(function FoodCostBadge({ percentage }: FoodCostBadgeProps) {
  let bg = "#22c55e"; // green
  if (percentage > 35) bg = "#ef4444"; // red
  else if (percentage > 30) bg = "#fbbf24"; // amber

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.badgeText}>{percentage.toFixed(1)}%</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const RecipeListScreen: React.FC<RecipeListScreenProps> = React.memo(
  function RecipeListScreen({ recipes, sellingPrices, onSelectRecipe, onAddRecipe }) {
    const [searchQuery, setSearchQuery] = useState("");

    // Filter recipes by search query (case-insensitive)
    const filteredRecipes = useMemo(() => {
      if (!searchQuery.trim()) return recipes;
      const q = searchQuery.toLowerCase();
      return recipes.filter((r) => r.name.toLowerCase().includes(q));
    }, [recipes, searchQuery]);

    const handlePress = useCallback(
      (recipe: Recipe) => {
        onSelectRecipe(recipe);
      },
      [onSelectRecipe]
    );

    // getItemLayout for fixed-height cards
    const getItemLayout = useCallback(
      (_data: unknown, index: number) => ({
        length: CARD_HEIGHT + CARD_GAP,
        offset: (CARD_HEIGHT + CARD_GAP) * index,
        index,
      }),
      []
    );

    const renderItem = useCallback(
      ({ item }: { item: Recipe }) => {
        const cost = calculateRecipeCost(item);
        const price = item.menuItemId ? sellingPrices[item.menuItemId] : undefined;
        const foodCostPct = price && price > 0
          ? calculateFoodCostPercentage(item, price)
          : null;

        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handlePress(item)}
            accessibilityRole="button"
            accessibilityLabel={`Recipe: ${item.name}`}
            activeOpacity={0.7}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.recipeName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.recipeDetail}>
                {item.ingredients.length} ingredients · {item.yield} portions
              </Text>
            </View>
            <View style={styles.cardRight}>
              {foodCostPct !== null && <FoodCostBadge percentage={foodCostPct} />}
              <Text style={styles.costText}>
                R {cost.costPerPortion.toFixed(2)}/portion
              </Text>
            </View>
          </TouchableOpacity>
        );
      },
      [handlePress, sellingPrices]
    );

    const keyExtractor = useCallback((item: Recipe) => item.id, []);

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Recipes</Text>
          {onAddRecipe && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={onAddRecipe}
              accessibilityLabel="Add recipe"
            >
              <Ionicons name="add-circle" size={28} color="#3b82f6" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes…"
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            accessibilityLabel="Search recipes"
          />
        </View>

        {/* List */}
        {filteredRecipes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyText}>
              {searchQuery ? "No recipes match your search" : "No recipes yet"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredRecipes}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#f3f4f6" },
  addBtn: { padding: 4 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: "#f3f4f6",
  },
  listContent: { paddingBottom: 24 },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    height: CARD_HEIGHT,
    marginBottom: CARD_GAP,
  },
  cardLeft: { flex: 1, marginRight: 12 },
  cardRight: { alignItems: "flex-end" },
  recipeName: { fontSize: 16, fontWeight: "600", color: "#f3f4f6" },
  recipeDetail: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  costText: { fontSize: 14, color: "#d1d5db", marginTop: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: { fontSize: 16, color: "#6b7280", marginTop: 12 },
});

export default RecipeListScreen;
