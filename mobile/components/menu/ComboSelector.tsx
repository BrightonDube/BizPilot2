/**
 * ComboSelector — Customer-facing combo selection during ordering.
 *
 * Presents each combo component as a step/card where the customer (or cashier)
 * picks their choices. Supports required vs optional components, max-selection
 * limits, and price adjustments for premium swaps. Shows a running total and
 * disables confirmation until all required components have valid selections.
 *
 * Why separate from ComboBuilder?
 * The builder is a management/setup tool. This selector is an order-time UI
 * optimised for speed — large touch targets, clear visual feedback, minimal
 * cognitive load for counter staff.
 *
 * @module ComboSelector
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  type GestureResponderEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComboChoiceOption {
  id: string;
  name: string;
  priceAdjustment: number;
}

interface ComboSelection {
  componentId: string;
  categoryName: string;
  required: boolean;
  maxSelections: number;
  choices: ComboChoiceOption[];
  selectedChoiceIds: string[];
}

interface ComboSelectorProps {
  comboName: string;
  comboPrice: number;
  selections: ComboSelection[];
  onSelectChoice: (componentId: string, choiceId: string) => void;
  onDeselectChoice: (componentId: string, choiceId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** All required components have at least one selection */
  isValid: boolean;
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
 * Individual choice pill. Selected state uses blue background.
 * Tapping toggles selection (with haptic feedback).
 */
const ChoicePill = React.memo(function ChoicePill({
  choice,
  isSelected,
  componentId,
  onSelect,
  onDeselect,
}: {
  choice: ComboChoiceOption;
  isSelected: boolean;
  componentId: string;
  onSelect: (componentId: string, choiceId: string) => void;
  onDeselect: (componentId: string, choiceId: string) => void;
}) {
  const handlePress = useCallback(() => {
    triggerHaptic("tap");
    if (isSelected) {
      onDeselect(componentId, choice.id);
    } else {
      onSelect(componentId, choice.id);
    }
  }, [isSelected, componentId, choice.id, onSelect, onDeselect]);

  return (
    <TouchableOpacity
      testID={`combo-selector-choice-${componentId}-${choice.id}`}
      onPress={handlePress}
      style={[styles.choicePill, isSelected && styles.choicePillSelected]}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.choicePillText, isSelected && styles.choicePillTextSelected]}
        numberOfLines={1}
      >
        {choice.name}
      </Text>
      {choice.priceAdjustment !== 0 && (
        <Text
          style={[
            styles.priceAdjustment,
            isSelected && styles.priceAdjustmentSelected,
            {
              color: isSelected
                ? COLORS.text
                : choice.priceAdjustment > 0
                ? COLORS.amber
                : COLORS.green,
            },
          ]}
        >
          {choice.priceAdjustment > 0 ? "+" : ""}
          {formatCurrency(choice.priceAdjustment)}
        </Text>
      )}
      {isSelected && (
        <Ionicons
          name="checkmark-circle"
          size={16}
          color={COLORS.text}
          style={styles.checkIcon}
        />
      )}
    </TouchableOpacity>
  );
});

/**
 * Component step card — one per combo component (e.g., "Choose a Side").
 */
const ComponentStep = React.memo(function ComponentStep({
  selection,
  onSelect,
  onDeselect,
}: {
  selection: ComboSelection;
  onSelect: (componentId: string, choiceId: string) => void;
  onDeselect: (componentId: string, choiceId: string) => void;
}) {
  const selectionCount = selection.selectedChoiceIds.length;
  const isComplete = selection.required ? selectionCount > 0 : true;

  return (
    <View
      testID={`combo-selector-component-${selection.componentId}`}
      style={[styles.stepCard, isComplete && styles.stepCardComplete]}
    >
      {/* Category header */}
      <View style={styles.stepHeader}>
        <View style={styles.stepTitleRow}>
          <Ionicons
            name={isComplete ? "checkmark-circle" : "ellipse-outline"}
            size={20}
            color={isComplete ? COLORS.green : COLORS.textMuted}
          />
          <Text style={styles.stepTitle}>{selection.categoryName}</Text>
        </View>
        <View style={styles.badges}>
          {/* Required / Optional badge */}
          <View
            style={[
              styles.badge,
              {
                backgroundColor: selection.required
                  ? `${COLORS.red}20`
                  : `${COLORS.blue}20`,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color: selection.required ? COLORS.red : COLORS.blue,
                },
              ]}
            >
              {selection.required ? "Required" : "Optional"}
            </Text>
          </View>
        </View>
      </View>

      {/* Max selections hint */}
      <Text style={styles.maxSelectionsHint}>
        Choose up to {selection.maxSelections}
        {selectionCount > 0 && ` · ${selectionCount} selected`}
      </Text>

      {/* Choice pills */}
      <View style={styles.choicesGrid}>
        {selection.choices.map((choice) => (
          <ChoicePill
            key={choice.id}
            choice={choice}
            isSelected={selection.selectedChoiceIds.includes(choice.id)}
            componentId={selection.componentId}
            onSelect={onSelect}
            onDeselect={onDeselect}
          />
        ))}
      </View>
    </View>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function ComboSelector({
  comboName,
  comboPrice,
  selections,
  onSelectChoice,
  onDeselectChoice,
  onConfirm,
  onCancel,
  isValid,
}: ComboSelectorProps) {
  // ── Running total ────────────────────────────────────────────────────────
  // Base combo price + sum of all selected choice price adjustments
  const runningTotal = useMemo(() => {
    const adjustments = selections.reduce((sum, sel) => {
      return (
        sum +
        sel.choices
          .filter((c) => sel.selectedChoiceIds.includes(c.id))
          .reduce((acc, c) => acc + c.priceAdjustment, 0)
      );
    }, 0);
    return comboPrice + adjustments;
  }, [comboPrice, selections]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    triggerHaptic("success");
    onConfirm();
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View testID="combo-selector" style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.comboTitle}>{comboName}</Text>
          <Text style={styles.basePrice}>
            Base price: {formatCurrency(comboPrice)}
          </Text>
        </View>
        <TouchableOpacity
          testID="combo-selector-cancel"
          onPress={handleCancel}
          style={styles.cancelButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Component steps */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {selections.map((selection) => (
          <ComponentStep
            key={selection.componentId}
            selection={selection}
            onSelect={onSelectChoice}
            onDeselect={onDeselectChoice}
          />
        ))}
      </ScrollView>

      {/* Footer — running total + confirm */}
      <View style={styles.footer}>
        <View
          testID="combo-selector-total"
          style={styles.totalRow}
        >
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(runningTotal)}</Text>
        </View>

        <View style={styles.footerActions}>
          <TouchableOpacity
            testID="combo-selector-cancel"
            onPress={handleCancel}
            style={styles.footerCancelButton}
          >
            <Text style={styles.footerCancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="combo-selector-confirm"
            onPress={handleConfirm}
            style={[
              styles.confirmButton,
              !isValid && styles.confirmButtonDisabled,
            ]}
            disabled={!isValid}
          >
            <Ionicons name="checkmark" size={20} color={COLORS.text} />
            <Text style={styles.confirmText}>Confirm Combo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  comboTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  basePrice: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  cancelButton: {
    padding: 4,
  },

  // Scroll
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 8,
  },

  // Step card
  stepCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepCardComplete: {
    borderColor: `${COLORS.green}40`,
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  maxSelectionsHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 28,
  },

  // Choice pills
  choicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choicePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  choicePillSelected: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  choicePillText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },
  choicePillTextSelected: {
    color: COLORS.text,
    fontWeight: "600",
  },
  priceAdjustment: {
    fontSize: 12,
    fontWeight: "600",
  },
  priceAdjustmentSelected: {
    opacity: 0.9,
  },
  checkIcon: {
    marginLeft: 2,
  },

  // Footer
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  footerActions: {
    flexDirection: "row",
    gap: 10,
  },
  footerCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  footerCancelText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  confirmButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.green,
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.6,
  },
  confirmText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
});

export default React.memo(ComboSelector);
