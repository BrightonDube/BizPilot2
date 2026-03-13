/**
 * RecipeFormModal — create/edit a recipe with name, yield, waste, instructions.
 * (recipe-management task 3.2)
 *
 * Layout: Full-screen modal with form fields, ingredient list summary, and
 * save/cancel buttons. Ingredients are managed in a separate IngredientSelector
 * modal (task 3.3) — this component just displays a read-only summary of the
 * current ingredient list and a button to open the selector.
 *
 * Why a modal rather than a screen?
 * In a POS context, the user may be mid-order and quickly need to check or
 * adjust a recipe. A modal overlays the current workflow without losing the
 * active cart state.
 *
 * Why controlled form state vs formik/react-hook-form?
 * The recipe form has only 5 fields. Pulling in a 30 KB form library for
 * this would be over-engineering. Plain useState keeps the bundle small and
 * the component easy to debug at 2 AM.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Recipe, RecipeIngredient } from "@/services/recipe/RecipeService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecipeFormData {
  name: string;
  yield: number;
  wasteFactor: number;
  instructions: string;
  ingredients: RecipeIngredient[];
  menuItemId?: string;
}

export interface RecipeFormModalProps {
  /** Existing recipe to edit, or undefined for new. */
  recipe?: Recipe;
  /** Whether the modal is visible. */
  visible: boolean;
  /** Called on save with the form data. */
  onSave: (data: RecipeFormData) => void;
  /** Called when the modal is dismissed without saving. */
  onCancel: () => void;
  /** Opens the ingredient selector. */
  onOpenIngredientSelector: (currentIngredients: RecipeIngredient[]) => void;
  /** Externally-managed ingredient list (updated by IngredientSelector). */
  ingredients: RecipeIngredient[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationErrors {
  name?: string;
  yield?: string;
  wasteFactor?: string;
}

function validate(
  name: string,
  yieldStr: string,
  wasteStr: string
): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!name.trim()) errors.name = "Recipe name is required";
  const y = parseFloat(yieldStr);
  if (isNaN(y) || y <= 0) errors.yield = "Yield must be a positive number";
  const w = parseFloat(wasteStr);
  if (isNaN(w) || w < 0 || w > 1) errors.wasteFactor = "Waste factor must be 0–1 (e.g. 0.1 = 10%)";
  return errors;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const RecipeFormModal: React.FC<RecipeFormModalProps> = React.memo(
  function RecipeFormModal({
    recipe,
    visible,
    onSave,
    onCancel,
    onOpenIngredientSelector,
    ingredients,
  }) {
    // Form state — initialised from existing recipe or sensible defaults
    const [name, setName] = useState(recipe?.name ?? "");
    const [yieldStr, setYieldStr] = useState(String(recipe?.yield ?? 1));
    const [wasteStr, setWasteStr] = useState(String(recipe?.wasteFactor ?? 0.1));
    const [instructions, setInstructions] = useState(recipe?.instructions ?? "");
    const [errors, setErrors] = useState<ValidationErrors>({});

    const isEditing = !!recipe;

    const handleSave = useCallback(() => {
      const errs = validate(name, yieldStr, wasteStr);
      setErrors(errs);
      if (Object.keys(errs).length > 0) return;

      onSave({
        name: name.trim(),
        yield: parseFloat(yieldStr),
        wasteFactor: parseFloat(wasteStr),
        instructions: instructions.trim(),
        ingredients,
        menuItemId: recipe?.menuItemId,
      });
    }, [name, yieldStr, wasteStr, instructions, ingredients, onSave, recipe]);

    const ingredientSummary = useMemo(() => {
      if (ingredients.length === 0) return "No ingredients added";
      return `${ingredients.length} ingredient${ingredients.length > 1 ? "s" : ""}`;
    }, [ingredients]);

    if (!visible) return null;

    return (
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.modal}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {isEditing ? "Edit Recipe" : "New Recipe"}
              </Text>
              <TouchableOpacity onPress={onCancel} accessibilityLabel="Cancel">
                <Ionicons name="close" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={styles.label}>Recipe Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Classic Margherita Pizza"
              placeholderTextColor="#6b7280"
              accessibilityLabel="Recipe name"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            {/* Yield */}
            <Text style={styles.label}>Yield (portions) *</Text>
            <TextInput
              style={[styles.input, errors.yield && styles.inputError]}
              value={yieldStr}
              onChangeText={setYieldStr}
              keyboardType="decimal-pad"
              placeholder="e.g. 4"
              placeholderTextColor="#6b7280"
              accessibilityLabel="Yield portions"
            />
            {errors.yield && <Text style={styles.errorText}>{errors.yield}</Text>}

            {/* Waste factor */}
            <Text style={styles.label}>Waste Factor (0–1) *</Text>
            <TextInput
              style={[styles.input, errors.wasteFactor && styles.inputError]}
              value={wasteStr}
              onChangeText={setWasteStr}
              keyboardType="decimal-pad"
              placeholder="e.g. 0.1 for 10% waste"
              placeholderTextColor="#6b7280"
              accessibilityLabel="Waste factor"
            />
            {errors.wasteFactor && (
              <Text style={styles.errorText}>{errors.wasteFactor}</Text>
            )}

            {/* Ingredients summary */}
            <Text style={styles.label}>Ingredients</Text>
            <TouchableOpacity
              style={styles.ingredientBtn}
              onPress={() => onOpenIngredientSelector(ingredients)}
              accessibilityLabel="Open ingredient selector"
            >
              <Ionicons name="list-outline" size={20} color="#3b82f6" />
              <Text style={styles.ingredientBtnText}>{ingredientSummary}</Text>
              <Ionicons name="chevron-forward" size={20} color="#6b7280" />
            </TouchableOpacity>

            {/* Instructions */}
            <Text style={styles.label}>Instructions</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Optional preparation instructions…"
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="Recipe instructions"
            />

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                accessibilityLabel="Save recipe"
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>
                  {isEditing ? "Update" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    width: "90%",
    maxWidth: 520,
    maxHeight: "90%",
    backgroundColor: "#1f2937",
    borderRadius: 16,
    overflow: "hidden",
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#f3f4f6" },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#d1d5db",
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#374151",
  },
  inputError: { borderColor: "#ef4444" },
  textArea: { minHeight: 100 },
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 4 },
  ingredientBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#374151",
  },
  ingredientBtnText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#d1d5db",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 28,
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
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: "#3b82f6",
  },
  saveBtnText: { fontSize: 15, color: "#fff", fontWeight: "700" },
});

export default RecipeFormModal;
