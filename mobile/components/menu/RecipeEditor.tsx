/**
 * RecipeEditor — Editor for recipe ingredients and preparation steps.
 *
 * Enables managers to define the full recipe for a menu item: ingredients
 * with quantities, units, and per-unit costs; a yield (output quantity/unit);
 * and free-form preparation notes. Automatically calculates total recipe cost
 * and cost-per-portion to inform menu pricing decisions.
 *
 * Why show cost-per-portion prominently?
 * Food cost percentage is the most critical metric in menu engineering.
 * By surfacing cost-per-portion next to the selling price, managers can
 * instantly see whether their margin target is met — no spreadsheet needed.
 * This tight feedback loop reduces the "price it and pray" anti-pattern.
 *
 * @module RecipeEditor
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecipeIngredient {
  id: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
}

interface RecipeEditorProps {
  productName: string;
  ingredients: RecipeIngredient[];
  onAddIngredient: () => void;
  onRemoveIngredient: (ingredientId: string) => void;
  onUpdateIngredient: (
    ingredientId: string,
    updates: Partial<RecipeIngredient>
  ) => void;
  preparationNotes: string;
  onPreparationNotesChange: (notes: string) => void;
  yieldQuantity: string;
  onYieldQuantityChange: (qty: string) => void;
  yieldUnit: string;
  onYieldUnitChange: (unit: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  border: "#374151",
} as const;

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Single ingredient row — name, quantity, unit, cost-per-unit, line cost.
 * Memoized so edits to one ingredient don't cascade re-renders to siblings.
 */
const IngredientRow = React.memo(function IngredientRow({
  ingredient,
  onUpdateIngredient,
  onRemoveIngredient,
}: {
  ingredient: RecipeIngredient;
  onUpdateIngredient: (
    id: string,
    updates: Partial<RecipeIngredient>
  ) => void;
  onRemoveIngredient: (id: string) => void;
}) {
  const handleNameChange = useCallback(
    (text: string) =>
      onUpdateIngredient(ingredient.id, { ingredientName: text }),
    [ingredient.id, onUpdateIngredient]
  );

  const handleQuantityChange = useCallback(
    (text: string) => {
      const parsed = parseFloat(text);
      onUpdateIngredient(ingredient.id, {
        quantity: isNaN(parsed) ? 0 : parsed,
      });
    },
    [ingredient.id, onUpdateIngredient]
  );

  const handleUnitChange = useCallback(
    (text: string) => onUpdateIngredient(ingredient.id, { unit: text }),
    [ingredient.id, onUpdateIngredient]
  );

  const handleCostChange = useCallback(
    (text: string) => {
      const parsed = parseFloat(text);
      onUpdateIngredient(ingredient.id, {
        costPerUnit: isNaN(parsed) ? 0 : parsed,
      });
    },
    [ingredient.id, onUpdateIngredient]
  );

  const handleRemove = useCallback(() => {
    triggerHaptic("tap");
    onRemoveIngredient(ingredient.id);
  }, [ingredient.id, onRemoveIngredient]);

  // Line cost = quantity × costPerUnit
  const lineCost = useMemo(
    () => ingredient.quantity * ingredient.costPerUnit,
    [ingredient.quantity, ingredient.costPerUnit]
  );

  return (
    <View
      testID={`recipe-ingredient-${ingredient.id}`}
      style={styles.ingredientCard}
    >
      {/* Ingredient name — full width */}
      <TextInput
        style={[styles.textInput, styles.ingredientNameInput]}
        value={ingredient.ingredientName}
        onChangeText={handleNameChange}
        placeholder="Ingredient name"
        placeholderTextColor={COLORS.textMuted}
      />

      {/* Quantity + Unit row */}
      <View style={styles.ingredientMetrics}>
        <View style={styles.metricField}>
          <Text style={styles.inputLabel}>Qty</Text>
          <TextInput
            testID={`recipe-ingredient-qty-${ingredient.id}`}
            style={styles.textInput}
            value={ingredient.quantity > 0 ? ingredient.quantity.toString() : ""}
            onChangeText={handleQuantityChange}
            placeholder="0"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.metricField}>
          <Text style={styles.inputLabel}>Unit</Text>
          <TextInput
            style={styles.textInput}
            value={ingredient.unit}
            onChangeText={handleUnitChange}
            placeholder="kg"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
        <View style={styles.metricField}>
          <Text style={styles.inputLabel}>Cost/Unit</Text>
          <TextInput
            style={styles.textInput}
            value={
              ingredient.costPerUnit > 0
                ? ingredient.costPerUnit.toString()
                : ""
            }
            onChangeText={handleCostChange}
            placeholder="0.00"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Line cost + remove */}
      <View style={styles.ingredientFooter}>
        <View style={styles.lineCostBadge}>
          <Text style={styles.lineCostLabel}>Line cost</Text>
          <Text style={styles.lineCostValue}>{formatCurrency(lineCost)}</Text>
        </View>
        <TouchableOpacity
          testID={`recipe-ingredient-remove-${ingredient.id}`}
          onPress={handleRemove}
          style={styles.removeIngredientBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={20} color={COLORS.red} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function RecipeEditor({
  productName,
  ingredients,
  onAddIngredient,
  onRemoveIngredient,
  onUpdateIngredient,
  preparationNotes,
  onPreparationNotesChange,
  yieldQuantity,
  onYieldQuantityChange,
  yieldUnit,
  onYieldUnitChange,
  onSave,
  onCancel,
  isSaving = false,
}: RecipeEditorProps) {
  // ── Derived values ────────────────────────────────────────────────────────

  /** Total recipe cost — sum of all ingredient line costs. */
  const totalCost = useMemo(
    () =>
      ingredients.reduce(
        (sum, ing) => sum + ing.quantity * ing.costPerUnit,
        0
      ),
    [ingredients]
  );

  /**
   * Cost per portion — total divided by yield.
   * Guards against division by zero when yield is empty.
   */
  const costPerPortion = useMemo(() => {
    const yieldNum = parseFloat(yieldQuantity);
    if (!yieldNum || yieldNum <= 0) return 0;
    return totalCost / yieldNum;
  }, [totalCost, yieldQuantity]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    triggerHaptic("success");
    onSave();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  const handleAddIngredient = useCallback(() => {
    triggerHaptic("tap");
    onAddIngredient();
  }, [onAddIngredient]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderIngredient = useCallback(
    ({ item }: ListRenderItemInfo<RecipeIngredient>) => (
      <IngredientRow
        ingredient={item}
        onUpdateIngredient={onUpdateIngredient}
        onRemoveIngredient={onRemoveIngredient}
      />
    ),
    [onUpdateIngredient, onRemoveIngredient]
  );

  const keyExtractor = useCallback(
    (item: RecipeIngredient) => item.id,
    []
  );

  // ── Header — title, yield section ─────────────────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* Title row */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Ionicons name="restaurant-outline" size={24} color={COLORS.purple} />
            <Text style={styles.title} numberOfLines={1}>
              Recipe: {productName}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              testID="recipe-cancel"
              onPress={handleCancel}
              style={styles.cancelButton}
              disabled={isSaving}
            >
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="recipe-save"
              onPress={handleSave}
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={COLORS.text} />
                  <Text style={styles.saveText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Yield section */}
        <View style={styles.yieldCard}>
          <Text style={styles.yieldTitle}>Recipe Yield</Text>
          <View style={styles.yieldInputs}>
            <View style={styles.yieldField}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput
                testID="recipe-yield-qty"
                style={styles.textInput}
                value={yieldQuantity}
                onChangeText={onYieldQuantityChange}
                placeholder="e.g., 10"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.yieldField}>
              <Text style={styles.inputLabel}>Unit</Text>
              <TextInput
                testID="recipe-yield-unit"
                style={styles.textInput}
                value={yieldUnit}
                onChangeText={onYieldUnitChange}
                placeholder="e.g., portions"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>
        </View>

        {/* Section label */}
        <Text style={styles.sectionLabel}>
          Ingredients ({ingredients.length})
        </Text>
      </View>
    ),
    [
      productName,
      yieldQuantity,
      onYieldQuantityChange,
      yieldUnit,
      onYieldUnitChange,
      ingredients.length,
      handleCancel,
      handleSave,
      isSaving,
    ]
  );

  // ── Footer — add ingredient, cost summary, prep notes ─────────────────────

  const ListFooter = useMemo(
    () => (
      <View>
        {ingredients.length === 0 && (
          <Text style={styles.emptyText}>
            No ingredients yet. Tap below to add one.
          </Text>
        )}

        {/* Add ingredient button */}
        <TouchableOpacity
          testID="recipe-add-ingredient"
          onPress={handleAddIngredient}
          style={styles.addButton}
        >
          <Ionicons name="add-circle" size={22} color={COLORS.blue} />
          <Text style={styles.addButtonText}>Add Ingredient</Text>
        </TouchableOpacity>

        {/* Cost summary card */}
        <View style={styles.costSummary}>
          <Text style={styles.costSummaryTitle}>Cost Summary</Text>

          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Total recipe cost</Text>
            <Text testID="recipe-total-cost" style={styles.costValue}>
              {formatCurrency(totalCost)}
            </Text>
          </View>

          <View style={[styles.costRow, styles.costPerPortionRow]}>
            <Text style={styles.costPerPortionLabel}>Cost per portion</Text>
            <Text
              style={[
                styles.costPerPortionValue,
                {
                  color: costPerPortion > 0 ? COLORS.amber : COLORS.textMuted,
                },
              ]}
            >
              {formatCurrency(costPerPortion)}
            </Text>
          </View>
        </View>

        {/* Preparation notes */}
        <View style={styles.prepSection}>
          <Text style={styles.prepTitle}>Preparation Notes</Text>
          <TextInput
            testID="recipe-prep-notes"
            style={styles.prepInput}
            value={preparationNotes}
            onChangeText={onPreparationNotesChange}
            placeholder="Enter preparation steps, cooking tips, plating instructions…"
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>
      </View>
    ),
    [
      ingredients.length,
      handleAddIngredient,
      totalCost,
      costPerPortion,
      preparationNotes,
      onPreparationNotesChange,
    ]
  );

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View testID="recipe-editor" style={styles.container}>
      <FlatList
        data={ingredients}
        renderItem={renderIngredient}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.green,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  // Yield card
  yieldCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  yieldTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  yieldInputs: {
    flexDirection: "row",
    gap: 12,
  },
  yieldField: {
    flex: 1,
  },

  // Section
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Ingredient card
  ingredientCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ingredientNameInput: {
    marginBottom: 10,
  },
  ingredientMetrics: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  metricField: {
    flex: 1,
  },
  ingredientFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  lineCostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lineCostLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  lineCostValue: {
    color: COLORS.green,
    fontSize: 14,
    fontWeight: "600",
  },
  removeIngredientBtn: {
    padding: 4,
  },

  // Inputs
  inputLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Empty state
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12,
  },

  // Add button
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderStyle: "dashed",
    marginTop: 4,
    marginBottom: 20,
  },
  addButtonText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: "600",
  },

  // Cost summary
  costSummary: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  costSummaryTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  costLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  costValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  costPerPortionRow: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 0,
  },
  costPerPortionLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  costPerPortionValue: {
    fontSize: 16,
    fontWeight: "700",
  },

  // Preparation notes
  prepSection: {
    marginBottom: 4,
  },
  prepTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  prepInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 120,
  },
});

export default React.memo(RecipeEditor);
