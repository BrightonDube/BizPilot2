/**
 * ComboBuilder — Builder interface for creating meal combos/deals in the POS.
 *
 * Lets managers define combo meals by assembling components (e.g., "Choose a Burger",
 * "Choose a Side", "Choose a Drink") with individual choices, required/optional flags,
 * and max-selection limits. Shows a live savings summary vs buying items individually.
 *
 * Why a builder pattern instead of a form?
 * Combos are inherently hierarchical (combo → components → choices). A flat form
 * would be confusing for staff. The builder gives a visual, card-based approach
 * that mirrors how combos are conceptually assembled.
 *
 * @module ComboBuilder
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

interface ComboChoice {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
}

interface ComboComponent {
  id: string;
  categoryName: string;
  choices: ComboChoice[];
  required: boolean;
  maxSelections: number;
}

interface ComboBuilderProps {
  comboName: string;
  onComboNameChange: (name: string) => void;
  comboPrice: number;
  onComboPriceChange: (price: number) => void;
  components: ComboComponent[];
  onAddComponent: () => void;
  onRemoveComponent: (componentId: string) => void;
  onUpdateComponent: (componentId: string, updates: Partial<ComboComponent>) => void;
  onAddChoice: (componentId: string) => void;
  onRemoveChoice: (componentId: string, choiceId: string) => void;
  onToggleDefault: (componentId: string, choiceId: string) => void;
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
 * Single choice row inside a combo component card.
 */
const ChoiceRow = React.memo(function ChoiceRow({
  choice,
  componentId,
  onToggleDefault,
  onRemoveChoice,
}: {
  choice: ComboChoice;
  componentId: string;
  onToggleDefault: (componentId: string, choiceId: string) => void;
  onRemoveChoice: (componentId: string, choiceId: string) => void;
}) {
  const handleToggleDefault = useCallback(() => {
    triggerHaptic("selection");
    onToggleDefault(componentId, choice.id);
  }, [componentId, choice.id, onToggleDefault]);

  const handleRemove = useCallback(() => {
    triggerHaptic("tap");
    onRemoveChoice(componentId, choice.id);
  }, [componentId, choice.id, onRemoveChoice]);

  return (
    <View
      testID={`combo-choice-${componentId}-${choice.id}`}
      style={styles.choiceRow}
    >
      <View style={styles.choiceInfo}>
        <Text style={styles.choiceName} numberOfLines={1}>
          {choice.name || "Unnamed Choice"}
        </Text>
        <Text style={styles.choicePrice}>{formatCurrency(choice.price)}</Text>
      </View>

      <View style={styles.choiceActions}>
        {/* Default star — highlights the pre-selected choice for this component */}
        <TouchableOpacity
          testID={`combo-choice-default-${componentId}-${choice.id}`}
          onPress={handleToggleDefault}
          style={styles.starButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={choice.isDefault ? "star" : "star-outline"}
            size={20}
            color={choice.isDefault ? COLORS.amber : COLORS.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRemove}
          style={styles.removeChoiceButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={20} color={COLORS.red} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

/**
 * Max-selections stepper — lets the user increment/decrement the
 * maximum number of choices a customer can pick for this component.
 */
const MaxSelectionsStepper = React.memo(function MaxSelectionsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const handleDecrement = useCallback(() => {
    if (value > 1) {
      triggerHaptic("tap");
      onChange(value - 1);
    }
  }, [value, onChange]);

  const handleIncrement = useCallback(() => {
    triggerHaptic("tap");
    onChange(value + 1);
  }, [value, onChange]);

  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>Max selections</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity
          onPress={handleDecrement}
          style={[styles.stepperBtn, value <= 1 && styles.stepperBtnDisabled]}
          disabled={value <= 1}
        >
          <Ionicons
            name="remove"
            size={16}
            color={value <= 1 ? COLORS.textMuted : COLORS.text}
          />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity onPress={handleIncrement} style={styles.stepperBtn}>
          <Ionicons name="add" size={16} color={COLORS.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

/**
 * Card for a single combo component (e.g., "Choose a Burger").
 * Contains category name, required toggle, choices list, and action buttons.
 */
const ComponentCard = React.memo(function ComponentCard({
  component,
  onUpdateComponent,
  onAddChoice,
  onRemoveChoice,
  onToggleDefault,
  onRemoveComponent,
}: {
  component: ComboComponent;
  onUpdateComponent: (componentId: string, updates: Partial<ComboComponent>) => void;
  onAddChoice: (componentId: string) => void;
  onRemoveChoice: (componentId: string, choiceId: string) => void;
  onToggleDefault: (componentId: string, choiceId: string) => void;
  onRemoveComponent: (componentId: string) => void;
}) {
  const handleCategoryChange = useCallback(
    (text: string) => onUpdateComponent(component.id, { categoryName: text }),
    [component.id, onUpdateComponent]
  );

  const handleRequiredToggle = useCallback(
    (val: boolean) => {
      triggerHaptic("selection");
      onUpdateComponent(component.id, { required: val });
    },
    [component.id, onUpdateComponent]
  );

  const handleMaxSelectionsChange = useCallback(
    (next: number) => onUpdateComponent(component.id, { maxSelections: next }),
    [component.id, onUpdateComponent]
  );

  const handleAddChoice = useCallback(() => {
    triggerHaptic("tap");
    onAddChoice(component.id);
  }, [component.id, onAddChoice]);

  const handleRemoveComponent = useCallback(() => {
    triggerHaptic("heavy");
    onRemoveComponent(component.id);
  }, [component.id, onRemoveComponent]);

  return (
    <View
      testID={`combo-component-${component.id}`}
      style={styles.componentCard}
    >
      {/* Component header */}
      <View style={styles.componentHeader}>
        <TextInput
          style={styles.categoryInput}
          value={component.categoryName}
          onChangeText={handleCategoryChange}
          placeholder="Category name (e.g., Choose a Burger)"
          placeholderTextColor={COLORS.textMuted}
        />
        <TouchableOpacity
          testID={`combo-component-remove-${component.id}`}
          onPress={handleRemoveComponent}
          style={styles.removeComponentButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.red} />
        </TouchableOpacity>
      </View>

      {/* Required toggle + max selections */}
      <View style={styles.componentSettings}>
        <View style={styles.requiredToggle}>
          <Text style={styles.settingLabel}>Required</Text>
          <Switch
            value={component.required}
            onValueChange={handleRequiredToggle}
            trackColor={{ false: COLORS.border, true: COLORS.green }}
            thumbColor={COLORS.text}
          />
        </View>
        <MaxSelectionsStepper
          value={component.maxSelections}
          onChange={handleMaxSelectionsChange}
        />
      </View>

      {/* Choices list */}
      <View style={styles.choicesList}>
        {component.choices.length === 0 ? (
          <Text style={styles.noChoicesText}>
            No choices yet — add one below
          </Text>
        ) : (
          component.choices.map((choice) => (
            <ChoiceRow
              key={choice.id}
              choice={choice}
              componentId={component.id}
              onToggleDefault={onToggleDefault}
              onRemoveChoice={onRemoveChoice}
            />
          ))
        )}
      </View>

      {/* Add choice button */}
      <TouchableOpacity
        testID={`combo-add-choice-${component.id}`}
        onPress={handleAddChoice}
        style={styles.addChoiceButton}
      >
        <Ionicons name="add-circle-outline" size={18} color={COLORS.blue} />
        <Text style={styles.addChoiceText}>Add Choice</Text>
      </TouchableOpacity>
    </View>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function ComboBuilder({
  comboName,
  onComboNameChange,
  comboPrice,
  onComboPriceChange,
  components,
  onAddComponent,
  onRemoveComponent,
  onUpdateComponent,
  onAddChoice,
  onRemoveChoice,
  onToggleDefault,
  onSave,
  onCancel,
  isSaving = false,
}: ComboBuilderProps) {
  // ── Price summary ────────────────────────────────────────────────────────
  // Sum the default choice prices across all components to show what the
  // customer would pay buying items individually vs the combo price.
  const individualTotal = useMemo(() => {
    return components.reduce((sum, comp) => {
      const defaultChoice = comp.choices.find((c) => c.isDefault);
      return sum + (defaultChoice?.price ?? 0);
    }, 0);
  }, [components]);

  const savings = useMemo(
    () => Math.max(0, individualTotal - comboPrice),
    [individualTotal, comboPrice]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePriceChange = useCallback(
    (text: string) => {
      const parsed = parseFloat(text.replace(/[^0-9.]/g, ""));
      onComboPriceChange(isNaN(parsed) ? 0 : parsed);
    },
    [onComboPriceChange]
  );

  const handleAddComponent = useCallback(() => {
    triggerHaptic("tap");
    onAddComponent();
  }, [onAddComponent]);

  const handleSave = useCallback(() => {
    triggerHaptic("success");
    onSave();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderComponent = useCallback(
    ({ item }: ListRenderItemInfo<ComboComponent>) => (
      <ComponentCard
        component={item}
        onUpdateComponent={onUpdateComponent}
        onAddChoice={onAddChoice}
        onRemoveChoice={onRemoveChoice}
        onToggleDefault={onToggleDefault}
        onRemoveComponent={onRemoveComponent}
      />
    ),
    [onUpdateComponent, onAddChoice, onRemoveChoice, onToggleDefault, onRemoveComponent]
  );

  const keyExtractor = useCallback((item: ComboComponent) => item.id, []);

  // ── Header component for FlatList ────────────────────────────────────────

  const ListHeader = useMemo(
    () => (
      <View>
        {/* Title row */}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Ionicons name="fast-food-outline" size={24} color={COLORS.purple} />
            <Text style={styles.title}>Build Combo</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              testID="combo-cancel"
              onPress={handleCancel}
              style={styles.cancelButton}
              disabled={isSaving}
            >
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="combo-save"
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

        {/* Combo name + price inputs */}
        <View style={styles.inputRow}>
          <View style={styles.nameInputWrapper}>
            <Text style={styles.inputLabel}>Combo Name</Text>
            <TextInput
              testID="combo-name"
              style={styles.textInput}
              value={comboName}
              onChangeText={onComboNameChange}
              placeholder="e.g., Family Feast Deal"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={styles.priceInputWrapper}>
            <Text style={styles.inputLabel}>Combo Price</Text>
            <TextInput
              testID="combo-price"
              style={styles.textInput}
              value={comboPrice > 0 ? comboPrice.toString() : ""}
              onChangeText={handlePriceChange}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Section label */}
        <Text style={styles.sectionLabel}>Components</Text>
      </View>
    ),
    [comboName, comboPrice, onComboNameChange, handlePriceChange, handleCancel, handleSave, isSaving]
  );

  // ── Footer — add component button + price summary ───────────────────────

  const ListFooter = useMemo(
    () => (
      <View>
        {/* Add component button */}
        <TouchableOpacity
          testID="combo-add-component"
          onPress={handleAddComponent}
          style={styles.addComponentButton}
        >
          <Ionicons name="add-circle" size={22} color={COLORS.purple} />
          <Text style={styles.addComponentText}>Add Component</Text>
        </TouchableOpacity>

        {/* Price summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Price Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Individual items total</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(individualTotal)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Combo price</Text>
            <Text style={[styles.summaryValue, { color: COLORS.blue }]}>
              {formatCurrency(comboPrice)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.savingsRow]}>
            <Text style={styles.savingsLabel}>Customer saves</Text>
            <Text
              style={[
                styles.savingsValue,
                { color: savings > 0 ? COLORS.green : COLORS.textMuted },
              ]}
            >
              {formatCurrency(savings)}
            </Text>
          </View>
        </View>
      </View>
    ),
    [handleAddComponent, individualTotal, comboPrice, savings]
  );

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <View testID="combo-builder" style={styles.container}>
      <FlatList
        data={components}
        renderItem={renderComponent}
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
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  nameInputWrapper: {
    flex: 2,
  },
  priceInputWrapper: {
    flex: 1,
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

  // Section
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Component card
  componentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  componentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  categoryInput: {
    flex: 1,
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  removeComponentButton: {
    padding: 6,
  },

  // Component settings
  componentSettings: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  requiredToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingLabel: {
    color: COLORS.text,
    fontSize: 14,
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

  // Choices
  choicesList: {
    marginBottom: 10,
  },
  noChoicesText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  choiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  choiceInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  choiceName: {
    color: COLORS.text,
    fontSize: 14,
    flex: 1,
  },
  choicePrice: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  choiceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  starButton: {
    padding: 2,
  },
  removeChoiceButton: {
    padding: 2,
  },

  // Add choice
  addChoiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.blue,
    borderStyle: "dashed",
  },
  addChoiceText: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: "600",
  },

  // Add component
  addComponentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.purple,
    borderStyle: "dashed",
    marginTop: 4,
    marginBottom: 20,
  },
  addComponentText: {
    color: COLORS.purple,
    fontSize: 15,
    fontWeight: "600",
  },

  // Price summary
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  savingsRow: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 0,
  },
  savingsLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  savingsValue: {
    fontSize: 16,
    fontWeight: "700",
  },
});

export default React.memo(ComboBuilder);
