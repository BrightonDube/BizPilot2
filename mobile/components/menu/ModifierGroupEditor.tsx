/**
 * ModifierGroupEditor — Editor for managing modifier groups on menu items.
 *
 * Handles groups like "Choose your sauce", "Add extras" — each with configurable
 * required/optional status, min/max selection limits, and individual modifier
 * options with prices and default flags.
 *
 * Why a dedicated editor instead of inline fields on the menu item form?
 * Modifier groups are complex nested structures (group → modifiers) with
 * validation rules (min ≤ max, at least one modifier). A focused editor
 * keeps the main menu-item form clean and lets managers think about one
 * group at a time without cognitive overload.
 *
 * @module ModifierGroupEditor
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
  Switch,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Modifier {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

interface ModifierGroupEditorProps {
  groupName: string;
  onGroupNameChange: (name: string) => void;
  isRequired: boolean;
  onRequiredChange: (req: boolean) => void;
  minSelections: number;
  onMinSelectionsChange: (min: number) => void;
  maxSelections: number;
  onMaxSelectionsChange: (max: number) => void;
  modifiers: Modifier[];
  onAddModifier: () => void;
  onRemoveModifier: (modifierId: string) => void;
  onUpdateModifier: (modifierId: string, updates: Partial<Modifier>) => void;
  onToggleDefault: (modifierId: string) => void;
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
 * Stepper for min/max selection values.
 * Extracted to avoid re-rendering the whole list on stepper taps.
 */
const SelectionStepper = React.memo(function SelectionStepper({
  label,
  value,
  onChange,
  min,
  testID,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  testID: string;
}) {
  const handleDecrement = useCallback(() => {
    if (value > min) {
      triggerHaptic("tap");
      onChange(value - 1);
    }
  }, [value, min, onChange]);

  const handleIncrement = useCallback(() => {
    triggerHaptic("tap");
    onChange(value + 1);
  }, [value, onChange]);

  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          onPress={handleDecrement}
          style={[styles.stepperBtn, value <= min && styles.stepperBtnDisabled]}
          disabled={value <= min}
        >
          <Ionicons
            name="remove"
            size={16}
            color={value <= min ? COLORS.border : COLORS.text}
          />
        </TouchableOpacity>
        <Text testID={testID} style={styles.stepperValue}>
          {value}
        </Text>
        <TouchableOpacity onPress={handleIncrement} style={styles.stepperBtn}>
          <Ionicons name="add" size={16} color={COLORS.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

/**
 * Single modifier row — name input, price input, default toggle, remove.
 * Memoized so only the edited row re-renders when typing in an input.
 */
const ModifierRow = React.memo(function ModifierRow({
  modifier,
  onUpdateModifier,
  onToggleDefault,
  onRemoveModifier,
}: {
  modifier: Modifier;
  onUpdateModifier: (id: string, updates: Partial<Modifier>) => void;
  onToggleDefault: (id: string) => void;
  onRemoveModifier: (id: string) => void;
}) {
  const handleNameChange = useCallback(
    (text: string) => onUpdateModifier(modifier.id, { name: text }),
    [modifier.id, onUpdateModifier]
  );

  const handlePriceChange = useCallback(
    (text: string) => {
      const parsed = parseFloat(text);
      onUpdateModifier(modifier.id, { price: isNaN(parsed) ? 0 : parsed });
    },
    [modifier.id, onUpdateModifier]
  );

  const handleToggleDefault = useCallback(() => {
    triggerHaptic("selection");
    onToggleDefault(modifier.id);
  }, [modifier.id, onToggleDefault]);

  const handleRemove = useCallback(() => {
    triggerHaptic("tap");
    onRemoveModifier(modifier.id);
  }, [modifier.id, onRemoveModifier]);

  return (
    <View testID={`modifier-item-${modifier.id}`} style={styles.modifierRow}>
      <View style={styles.modifierInputs}>
        <TextInput
          style={[styles.textInput, styles.modifierNameInput]}
          value={modifier.name}
          onChangeText={handleNameChange}
          placeholder="Modifier name"
          placeholderTextColor={COLORS.textMuted}
        />
        <TextInput
          style={[styles.textInput, styles.modifierPriceInput]}
          value={modifier.price > 0 ? modifier.price.toString() : ""}
          onChangeText={handlePriceChange}
          placeholder="0.00"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.modifierActions}>
        {/* Default star — marks the pre-selected option for this group */}
        <TouchableOpacity
          testID={`modifier-default-${modifier.id}`}
          onPress={handleToggleDefault}
          style={styles.iconButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={modifier.isDefault ? "star" : "star-outline"}
            size={20}
            color={modifier.isDefault ? COLORS.amber : COLORS.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          testID={`modifier-remove-${modifier.id}`}
          onPress={handleRemove}
          style={styles.iconButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={20} color={COLORS.red} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function ModifierGroupEditor({
  groupName,
  onGroupNameChange,
  isRequired,
  onRequiredChange,
  minSelections,
  onMinSelectionsChange,
  maxSelections,
  onMaxSelectionsChange,
  modifiers,
  onAddModifier,
  onRemoveModifier,
  onUpdateModifier,
  onToggleDefault,
  onSave,
  onCancel,
  isSaving = false,
}: ModifierGroupEditorProps) {
  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    triggerHaptic("success");
    onSave();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  const handleAddModifier = useCallback(() => {
    triggerHaptic("tap");
    onAddModifier();
  }, [onAddModifier]);

  const handleRequiredChange = useCallback(
    (value: boolean) => {
      triggerHaptic("selection");
      onRequiredChange(value);
    },
    [onRequiredChange]
  );

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderModifier = useCallback(
    ({ item }: ListRenderItemInfo<Modifier>) => (
      <ModifierRow
        modifier={item}
        onUpdateModifier={onUpdateModifier}
        onToggleDefault={onToggleDefault}
        onRemoveModifier={onRemoveModifier}
      />
    ),
    [onUpdateModifier, onToggleDefault, onRemoveModifier]
  );

  const keyExtractor = useCallback((item: Modifier) => item.id, []);

  // ── Header — title, group name, settings ──────────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* Title row */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Ionicons name="options-outline" size={24} color={COLORS.purple} />
            <Text style={styles.title}>Modifier Group</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              testID="modifier-cancel"
              onPress={handleCancel}
              style={styles.cancelButton}
              disabled={isSaving}
            >
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="modifier-save"
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

        {/* Group name input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Group Name</Text>
          <TextInput
            testID="modifier-group-name"
            style={styles.textInput}
            value={groupName}
            onChangeText={onGroupNameChange}
            placeholder='e.g., "Choose your sauce"'
            placeholderTextColor={COLORS.textMuted}
          />
        </View>

        {/* Required toggle + min/max selection steppers */}
        <View style={styles.settingsCard}>
          <View style={styles.requiredRow}>
            <Text style={styles.settingLabel}>Required</Text>
            <Switch
              testID="modifier-required-toggle"
              value={isRequired}
              onValueChange={handleRequiredChange}
              trackColor={{ false: COLORS.border, true: COLORS.green }}
              thumbColor={COLORS.text}
            />
          </View>

          <View style={styles.selectionRow}>
            <SelectionStepper
              label="Min"
              value={minSelections}
              onChange={onMinSelectionsChange}
              min={0}
              testID="modifier-min-sel"
            />
            <SelectionStepper
              label="Max"
              value={maxSelections}
              onChange={onMaxSelectionsChange}
              min={1}
              testID="modifier-max-sel"
            />
          </View>
        </View>

        {/* Section label for modifier list */}
        <Text style={styles.sectionLabel}>Modifiers</Text>
      </View>
    ),
    [
      groupName,
      onGroupNameChange,
      isRequired,
      handleRequiredChange,
      minSelections,
      onMinSelectionsChange,
      maxSelections,
      onMaxSelectionsChange,
      handleCancel,
      handleSave,
      isSaving,
    ]
  );

  // ── Footer — add modifier button ─────────────────────────────────────────

  const ListFooter = useMemo(
    () => (
      <View>
        {modifiers.length === 0 && (
          <Text style={styles.emptyText}>
            No modifiers yet. Tap below to add one.
          </Text>
        )}

        <TouchableOpacity
          testID="modifier-add"
          onPress={handleAddModifier}
          style={styles.addButton}
        >
          <Ionicons name="add-circle" size={22} color={COLORS.blue} />
          <Text style={styles.addButtonText}>Add Modifier</Text>
        </TouchableOpacity>
      </View>
    ),
    [modifiers.length, handleAddModifier]
  );

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View testID="modifier-group-editor" style={styles.container}>
      <FlatList
        data={modifiers}
        renderItem={renderModifier}
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
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
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

  // Inputs
  inputSection: {
    marginBottom: 16,
  },
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

  // Settings card
  settingsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requiredRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },
  selectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  // Stepper
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.input,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
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

  // Modifier row
  modifierRow: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modifierInputs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  modifierNameInput: {
    flex: 2,
  },
  modifierPriceInput: {
    flex: 1,
  },
  modifierActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    padding: 2,
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
  },
  addButtonText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default React.memo(ModifierGroupEditor);
