/**
 * IngredientSelector — add/edit ingredients for a recipe.
 * (recipe-management task 3.3)
 *
 * Layout: Full-screen modal with a searchable ingredient list on the left
 * (or top on phone) and the selected-ingredients form on the right (or
 * bottom on phone). For each selected ingredient, the user enters quantity
 * and unit. The component emits the final RecipeIngredient[] to the parent.
 *
 * Why a two-panel layout?
 * In a kitchen/back-office context on a tablet, the user needs to see
 * available ingredients and selected ones at the same time. A split pane
 * avoids constant navigation between screens.
 *
 * Why does this accept an available-ingredients list as a prop?
 * Ingredients come from the synced WatermelonDB (offline) or REST API
 * (online). Keeping the data source external makes this component reusable
 * regardless of connectivity state.
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
import type { RecipeIngredient } from "@/services/recipe/RecipeService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal ingredient record from inventory. */
export interface AvailableIngredient {
  id: string;
  name: string;
  /** Current unit cost from latest purchase price. */
  unitCost: number;
  /** Default unit of measure. */
  unit: string;
}

export interface IngredientSelectorProps {
  /** Full inventory ingredient list. */
  availableIngredients: AvailableIngredient[];
  /** Currently selected ingredients (pre-populated from recipe). */
  initialIngredients: RecipeIngredient[];
  /** Whether the selector is visible. */
  visible: boolean;
  /** Called with the finalised ingredient list. */
  onConfirm: (ingredients: RecipeIngredient[]) => void;
  /** Called when the user cancels without saving. */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const IngredientSelector: React.FC<IngredientSelectorProps> = React.memo(
  function IngredientSelector({
    availableIngredients,
    initialIngredients,
    visible,
    onConfirm,
    onCancel,
  }) {
    const [selected, setSelected] = useState<RecipeIngredient[]>(initialIngredients);
    const [searchQuery, setSearchQuery] = useState("");

    // Build a Set of selected ingredient IDs for quick lookup
    const selectedIds = useMemo(
      () => new Set(selected.map((s) => s.ingredientId)),
      [selected]
    );

    // Filter available ingredients by search query, excluding already-selected
    const filteredAvailable = useMemo(() => {
      const q = searchQuery.toLowerCase();
      return availableIngredients.filter(
        (ing) =>
          !selectedIds.has(ing.id) &&
          (q === "" || ing.name.toLowerCase().includes(q))
      );
    }, [availableIngredients, selectedIds, searchQuery]);

    // Add an ingredient to the selected list
    const handleAdd = useCallback((ingredient: AvailableIngredient) => {
      setSelected((prev) => [
        ...prev,
        {
          ingredientId: ingredient.id,
          name: ingredient.name,
          quantity: 1,
          unitCost: ingredient.unitCost,
          unit: ingredient.unit,
        },
      ]);
    }, []);

    // Remove an ingredient from the selected list
    const handleRemove = useCallback((ingredientId: string) => {
      setSelected((prev) => prev.filter((s) => s.ingredientId !== ingredientId));
    }, []);

    // Update quantity for a selected ingredient
    const handleQuantityChange = useCallback(
      (ingredientId: string, qtyStr: string) => {
        const qty = parseFloat(qtyStr);
        if (isNaN(qty)) return;
        setSelected((prev) =>
          prev.map((s) =>
            s.ingredientId === ingredientId ? { ...s, quantity: qty } : s
          )
        );
      },
      []
    );

    const handleConfirm = useCallback(() => {
      // Filter out any zero-quantity ingredients
      const valid = selected.filter((s) => s.quantity > 0);
      onConfirm(valid);
    }, [selected, onConfirm]);

    if (!visible) return null;

    return (
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Ingredients</Text>
            <TouchableOpacity onPress={onCancel} accessibilityLabel="Cancel ingredient selection">
              <Ionicons name="close" size={28} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {/* Available ingredients (left/top panel) */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Available</Text>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search ingredients…"
                  placeholderTextColor="#6b7280"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  accessibilityLabel="Search available ingredients"
                />
              </View>
              <FlatList
                data={filteredAvailable}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.availableItem}
                    onPress={() => handleAdd(item)}
                    accessibilityLabel={`Add ${item.name}`}
                  >
                    <View style={styles.availableInfo}>
                      <Text style={styles.ingredientName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.ingredientMeta}>
                        R {item.unitCost.toFixed(2)} / {item.unit}
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={24} color="#3b82f6" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {searchQuery ? "No matches" : "All ingredients added"}
                  </Text>
                }
                showsVerticalScrollIndicator={false}
              />
            </View>

            {/* Selected ingredients (right/bottom panel) */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Selected ({selected.length})
              </Text>
              <FlatList
                data={selected}
                keyExtractor={(item) => item.ingredientId}
                renderItem={({ item }) => (
                  <View style={styles.selectedItem}>
                    <View style={styles.selectedInfo}>
                      <Text style={styles.ingredientName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={styles.qtyRow}>
                        <TextInput
                          style={styles.qtyInput}
                          value={String(item.quantity)}
                          onChangeText={(v) =>
                            handleQuantityChange(item.ingredientId, v)
                          }
                          keyboardType="decimal-pad"
                          accessibilityLabel={`${item.name} quantity`}
                        />
                        <Text style={styles.unitLabel}>{item.unit}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemove(item.ingredientId)}
                      accessibilityLabel={`Remove ${item.name}`}
                    >
                      <Ionicons name="trash-outline" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No ingredients selected</Text>
                }
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={handleConfirm}
              accessibilityLabel="Confirm ingredients"
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.confirmBtnText}>
                Confirm ({selected.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "94%",
    maxWidth: 800,
    maxHeight: "92%",
    backgroundColor: "#1f2937",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#f3f4f6" },
  body: {
    flex: 1,
    flexDirection: "row",
  },
  panel: {
    flex: 1,
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: "#374151",
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: "#f3f4f6",
    marginLeft: 6,
  },
  availableItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  availableInfo: { flex: 1, marginRight: 8 },
  selectedItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  selectedInfo: { flex: 1, marginRight: 8 },
  ingredientName: { fontSize: 15, fontWeight: "500", color: "#f3f4f6" },
  ingredientMeta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  qtyInput: {
    backgroundColor: "#111827",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: "#f3f4f6",
    width: 80,
    borderWidth: 1,
    borderColor: "#374151",
  },
  unitLabel: { fontSize: 13, color: "#9ca3af", marginLeft: 8 },
  emptyText: { textAlign: "center", color: "#6b7280", marginTop: 20 },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#374151",
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  cancelBtnText: { fontSize: 15, color: "#9ca3af", fontWeight: "600" },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: "#3b82f6",
  },
  confirmBtnText: { fontSize: 15, color: "#fff", fontWeight: "700" },
});

export default IngredientSelector;
