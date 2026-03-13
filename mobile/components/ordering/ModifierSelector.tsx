/**
 * ModifierSelector — Customer-facing modifier selection during ordering.
 *
 * Presents modifier groups (e.g., "Choose your sauce", "Extra toppings") as
 * tappable pill lists. Each group shows its required/optional status, selection
 * limits, and per-option prices. A running total updates live as selections change.
 *
 * Why pills instead of checkboxes/radio buttons?
 * On a touch-first POS or kiosk, large tappable pills with clear selected state
 * (blue fill + checkmark) are faster to hit than small checkboxes. The pill
 * layout also scales better on tablets where horizontal space is abundant.
 *
 * @module ModifierSelector
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
  selectedIds: string[];
}

interface ModifierSelectorProps {
  productName: string;
  basePrice: number;
  modifierGroups: ModifierGroup[];
  onSelectModifier: (groupId: string, modifierId: string) => void;
  onDeselectModifier: (groupId: string, modifierId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isValid: boolean;
  totalPrice: number;
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
 * Single modifier option pill.
 * Selected state uses blue background + checkmark for instant visual feedback.
 */
const OptionPill = React.memo(function OptionPill({
  option,
  groupId,
  isSelected,
  onSelect,
  onDeselect,
}: {
  option: ModifierOption;
  groupId: string;
  isSelected: boolean;
  onSelect: (groupId: string, modifierId: string) => void;
  onDeselect: (groupId: string, modifierId: string) => void;
}) {
  const handlePress = useCallback(() => {
    triggerHaptic("selection");
    if (isSelected) {
      onDeselect(groupId, option.id);
    } else {
      onSelect(groupId, option.id);
    }
  }, [isSelected, groupId, option.id, onSelect, onDeselect]);

  return (
    <TouchableOpacity
      testID={`modifier-option-${groupId}-${option.id}`}
      onPress={handlePress}
      style={[styles.pill, isSelected && styles.pillSelected]}
      activeOpacity={0.7}
    >
      {isSelected && (
        <Ionicons name="checkmark-circle" size={18} color={COLORS.text} />
      )}
      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
        {option.name}
      </Text>
      {option.price > 0 && (
        <Text
          style={[
            styles.pillPrice,
            isSelected && styles.pillPriceSelected,
          ]}
        >
          +{formatCurrency(option.price)}
        </Text>
      )}
    </TouchableOpacity>
  );
});

/**
 * A single modifier group section — title, badge, selection range, and option pills.
 */
const GroupSection = React.memo(function GroupSection({
  group,
  onSelectModifier,
  onDeselectModifier,
}: {
  group: ModifierGroup;
  onSelectModifier: (groupId: string, modifierId: string) => void;
  onDeselectModifier: (groupId: string, modifierId: string) => void;
}) {
  const selectionCount = group.selectedIds.length;

  // Show selection limits only when meaningful
  const selectionHint = useMemo(() => {
    if (group.minSelections === group.maxSelections) {
      return `Choose ${group.minSelections}`;
    }
    return `Choose ${group.minSelections}–${group.maxSelections}`;
  }, [group.minSelections, group.maxSelections]);

  return (
    <View testID={`modifier-group-${group.id}`} style={styles.groupCard}>
      {/* Group header */}
      <View style={styles.groupHeader}>
        <View style={styles.groupTitleRow}>
          <Text style={styles.groupName}>{group.name}</Text>
          <View
            style={[
              styles.requiredBadge,
              group.isRequired
                ? styles.requiredBadgeRequired
                : styles.requiredBadgeOptional,
            ]}
          >
            <Text
              style={[
                styles.requiredBadgeText,
                group.isRequired
                  ? styles.requiredTextRequired
                  : styles.requiredTextOptional,
              ]}
            >
              {group.isRequired ? "Required" : "Optional"}
            </Text>
          </View>
        </View>

        <View style={styles.selectionInfo}>
          <Text style={styles.selectionHint}>{selectionHint}</Text>
          <Text
            style={[
              styles.selectionCount,
              selectionCount > 0 && styles.selectionCountActive,
            ]}
          >
            {selectionCount} selected
          </Text>
        </View>
      </View>

      {/* Option pills */}
      <View style={styles.pillsContainer}>
        {group.options.map((option) => (
          <OptionPill
            key={option.id}
            option={option}
            groupId={group.id}
            isSelected={group.selectedIds.includes(option.id)}
            onSelect={onSelectModifier}
            onDeselect={onDeselectModifier}
          />
        ))}
      </View>
    </View>
  );
});

// ─── Main component ──────────────────────────────────────────────────────────

function ModifierSelector({
  productName,
  basePrice,
  modifierGroups,
  onSelectModifier,
  onDeselectModifier,
  onConfirm,
  onCancel,
  isValid,
  totalPrice,
}: ModifierSelectorProps) {
  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    triggerHaptic("success");
    onConfirm();
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <View testID="modifier-selector" style={styles.container}>
      {/* Header — product name + base price */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {productName}
          </Text>
          <Text style={styles.basePrice}>
            {formatCurrency(basePrice)}
          </Text>
        </View>
        <TouchableOpacity
          testID="modifier-cancel"
          onPress={handleCancel}
          style={styles.closeButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Modifier groups — scrollable */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {modifierGroups.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            onSelectModifier={onSelectModifier}
            onDeselectModifier={onDeselectModifier}
          />
        ))}
      </ScrollView>

      {/* Bottom bar — running total + confirm */}
      <View style={styles.bottomBar}>
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text testID="modifier-total" style={styles.totalValue}>
            {formatCurrency(totalPrice)}
          </Text>
        </View>
        <TouchableOpacity
          testID="modifier-confirm"
          onPress={handleConfirm}
          style={[
            styles.confirmButton,
            !isValid && styles.confirmButtonDisabled,
          ]}
          disabled={!isValid}
        >
          <Ionicons name="checkmark" size={20} color={COLORS.text} />
          <Text style={styles.confirmText}>Add to Order</Text>
        </TouchableOpacity>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  basePrice: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.input,
    alignItems: "center",
    justifyContent: "center",
  },

  // Scroll area
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },

  // Group card
  groupCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupHeader: {
    marginBottom: 14,
  },
  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  groupName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  requiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requiredBadgeRequired: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  requiredBadgeOptional: {
    backgroundColor: "rgba(156, 163, 175, 0.15)",
  },
  requiredBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  requiredTextRequired: {
    color: COLORS.red,
  },
  requiredTextOptional: {
    color: COLORS.textMuted,
  },
  selectionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectionHint: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  selectionCount: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  selectionCountActive: {
    color: COLORS.blue,
    fontWeight: "600",
  },

  // Pills
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillSelected: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  pillText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },
  pillTextSelected: {
    fontWeight: "600",
  },
  pillPrice: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  pillPriceSelected: {
    color: "rgba(243, 244, 246, 0.8)",
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  totalValue: {
    color: COLORS.green,
    fontSize: 22,
    fontWeight: "800",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.green,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
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

export default React.memo(ModifierSelector);
