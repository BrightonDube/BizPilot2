/**
 * SmartCollectionBuilder — Builder for creating smart/dynamic tag collections.
 *
 * Lets the user define a named collection with a set of rules (field +
 * operator + value). Items matching "all" or "any" of the rules are
 * automatically included in the collection.
 *
 * Why an explicit "match all / any" toggle instead of per-rule AND/OR?
 * Mixed boolean logic is notoriously confusing on mobile. A single toggle
 * covers the vast majority of use-cases while keeping the UI instantly
 * understandable — even for non-technical POS operators.
 *
 * Why inline operator pickers per rule instead of a modal?
 * Each rule only has three fields (field, operator, value). Inline selection
 * keeps the user in context, reduces tap count, and avoids disorienting
 * modal stacking when multiple rules are being edited at once.
 *
 * Why React.memo?  The parent tag-management screen may re-render when the
 * tag list updates; memo ensures the builder only repaints when its own
 * props change.
 */

import React, { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "in_range";

interface CollectionRule {
  id: string;
  field: string;
  operator: RuleOperator;
  value: string;
  secondValue?: string; // for range
}

interface SmartCollectionBuilderProps {
  collectionName: string;
  onCollectionNameChange: (name: string) => void;
  rules: CollectionRule[];
  onAddRule: () => void;
  onRemoveRule: (ruleId: string) => void;
  onUpdateRule: (ruleId: string, updates: Partial<CollectionRule>) => void;
  matchType: "all" | "any";
  onMatchTypeChange: (type: "all" | "any") => void;
  availableFields: Array<{ id: string; name: string; type: "string" | "number" | "date" }>;
  previewCount: number;
  onPreview: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

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
  grey: "#6b7280",
  border: "#374151",
} as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Human-readable labels for operators. */
const OPERATOR_LABELS: Record<RuleOperator, string> = {
  equals: "Equals",
  not_equals: "Not equals",
  contains: "Contains",
  greater_than: "Greater than",
  less_than: "Less than",
  in_range: "In range",
};

/** Ordered list of all operators for the picker. */
const ALL_OPERATORS: RuleOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "less_than",
  "in_range",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Dropdown-style selector that cycles through options on tap. */
const CycleSelector = memo(function CycleSelector({
  testID,
  options,
  selectedValue,
  labelMap,
  onSelect,
}: {
  testID: string;
  options: string[];
  selectedValue: string;
  labelMap: Record<string, string>;
  onSelect: (value: string) => void;
}) {
  /**
   * Cycle to the next option on tap. This avoids opening a modal picker for
   * a small set of choices while still being discoverable.
   */
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx = options.indexOf(selectedValue);
    const next = options[(idx + 1) % options.length];
    onSelect(next);
  }, [options, selectedValue, onSelect]);

  return (
    <TouchableOpacity
      testID={testID}
      style={styles.cycleSelector}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={styles.cycleSelectorText} numberOfLines={1}>
        {labelMap[selectedValue] ?? selectedValue}
      </Text>
      <Ionicons name="chevron-down" size={14} color={COLORS.grey} />
    </TouchableOpacity>
  );
});

/** Single rule row with field, operator, value, and remove button. */
const RuleRow = memo(function RuleRow({
  rule,
  availableFields,
  onUpdate,
  onRemove,
}: {
  rule: CollectionRule;
  availableFields: SmartCollectionBuilderProps["availableFields"];
  onUpdate: (id: string, updates: Partial<CollectionRule>) => void;
  onRemove: (id: string) => void;
}) {
  /** Build label maps for the cycle selectors. */
  const fieldLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    availableFields.forEach((f) => {
      map[f.id] = f.name;
    });
    return map;
  }, [availableFields]);

  const fieldIds = useMemo(() => availableFields.map((f) => f.id), [availableFields]);

  const handleFieldChange = useCallback(
    (val: string) => onUpdate(rule.id, { field: val }),
    [onUpdate, rule.id],
  );
  const handleOpChange = useCallback(
    (val: string) => onUpdate(rule.id, { operator: val as RuleOperator }),
    [onUpdate, rule.id],
  );
  const handleValueChange = useCallback(
    (text: string) => onUpdate(rule.id, { value: text }),
    [onUpdate, rule.id],
  );
  const handleSecondValueChange = useCallback(
    (text: string) => onUpdate(rule.id, { secondValue: text }),
    [onUpdate, rule.id],
  );
  const handleRemove = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove(rule.id);
  }, [onRemove, rule.id]);

  return (
    <View testID={`collection-rule-${rule.id}`} style={styles.ruleRow}>
      {/* Field + operator selectors */}
      <View style={styles.ruleSelectors}>
        <CycleSelector
          testID={`collection-rule-field-${rule.id}`}
          options={fieldIds}
          selectedValue={rule.field}
          labelMap={fieldLabelMap}
          onSelect={handleFieldChange}
        />
        <CycleSelector
          testID={`collection-rule-op-${rule.id}`}
          options={ALL_OPERATORS}
          selectedValue={rule.operator}
          labelMap={OPERATOR_LABELS}
          onSelect={handleOpChange}
        />
      </View>

      {/* Value input(s) */}
      <View style={styles.ruleValueRow}>
        <TextInput
          testID={`collection-rule-value-${rule.id}`}
          style={styles.ruleInput}
          value={rule.value}
          onChangeText={handleValueChange}
          placeholder="Value"
          placeholderTextColor={COLORS.grey}
          autoCorrect={false}
        />
        {/* Second value input shown only for range operator */}
        {rule.operator === "in_range" && (
          <>
            <Text style={styles.rangeDash}>–</Text>
            <TextInput
              testID={`collection-rule-value2-${rule.id}`}
              style={styles.ruleInput}
              value={rule.secondValue ?? ""}
              onChangeText={handleSecondValueChange}
              placeholder="End"
              placeholderTextColor={COLORS.grey}
              autoCorrect={false}
            />
          </>
        )}

        {/* Remove button */}
        <TouchableOpacity
          testID={`collection-rule-remove-${rule.id}`}
          style={styles.removeButton}
          onPress={handleRemove}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.red} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SmartCollectionBuilder: React.FC<SmartCollectionBuilderProps> = ({
  collectionName,
  onCollectionNameChange,
  rules,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
  matchType,
  onMatchTypeChange,
  availableFields,
  previewCount,
  onPreview,
  onSave,
  onCancel,
  isSaving = false,
}) => {
  // ------- handlers -------

  const handleMatchAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMatchTypeChange("all");
  }, [onMatchTypeChange]);

  const handleMatchAny = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMatchTypeChange("any");
  }, [onMatchTypeChange]);

  const handleAddRule = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddRule();
  }, [onAddRule]);

  const handlePreview = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPreview();
  }, [onPreview]);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave();
  }, [onSave]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  }, [onCancel]);

  // ------- render -------

  return (
    <ScrollView
      testID="smart-collection-builder"
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <Ionicons name="pricetags-outline" size={22} color={COLORS.purple} />
        <Text style={styles.headerTitle}>Smart Collection</Text>
      </View>

      {/* ---- Collection name ---- */}
      <Text style={styles.sectionLabel}>Collection Name</Text>
      <TextInput
        testID="collection-name"
        style={styles.textInput}
        value={collectionName}
        onChangeText={onCollectionNameChange}
        placeholder="e.g. High-value products"
        placeholderTextColor={COLORS.grey}
        autoCorrect={false}
      />

      {/* ---- Match type toggle ---- */}
      <Text style={styles.sectionLabel}>Match Type</Text>
      <View style={styles.matchRow}>
        <TouchableOpacity
          testID="collection-match-all"
          style={[styles.matchOption, matchType === "all" && styles.matchOptionActive]}
          onPress={handleMatchAll}
          activeOpacity={0.7}
        >
          <Ionicons
            name={matchType === "all" ? "radio-button-on" : "radio-button-off"}
            size={18}
            color={matchType === "all" ? COLORS.blue : COLORS.grey}
          />
          <Text style={[styles.matchText, matchType === "all" && styles.matchTextActive]}>
            Match ALL rules
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="collection-match-any"
          style={[styles.matchOption, matchType === "any" && styles.matchOptionActive]}
          onPress={handleMatchAny}
          activeOpacity={0.7}
        >
          <Ionicons
            name={matchType === "any" ? "radio-button-on" : "radio-button-off"}
            size={18}
            color={matchType === "any" ? COLORS.blue : COLORS.grey}
          />
          <Text style={[styles.matchText, matchType === "any" && styles.matchTextActive]}>
            Match ANY rule
          </Text>
        </TouchableOpacity>
      </View>

      {/* ---- Rules list ---- */}
      <Text style={styles.sectionLabel}>Rules</Text>

      {rules.length === 0 ? (
        <View style={styles.emptyRules}>
          <Ionicons name="filter-outline" size={32} color={COLORS.grey} />
          <Text style={styles.emptyRulesText}>No rules yet — add one below</Text>
        </View>
      ) : (
        rules.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            availableFields={availableFields}
            onUpdate={onUpdateRule}
            onRemove={onRemoveRule}
          />
        ))
      )}

      {/* ---- Add rule button ---- */}
      <TouchableOpacity
        testID="collection-add-rule"
        style={styles.addRuleButton}
        onPress={handleAddRule}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={20} color={COLORS.blue} />
        <Text style={styles.addRuleText}>Add Rule</Text>
      </TouchableOpacity>

      {/* ---- Preview section ---- */}
      <View style={styles.previewSection}>
        <View style={styles.previewInfo}>
          <Ionicons name="layers-outline" size={18} color={COLORS.amber} />
          <Text testID="collection-preview-count" style={styles.previewCountText}>
            {previewCount} {previewCount === 1 ? "item matches" : "items match"}
          </Text>
        </View>
        <TouchableOpacity
          testID="collection-preview"
          style={styles.previewButton}
          onPress={handlePreview}
          activeOpacity={0.7}
        >
          <Ionicons name="eye-outline" size={16} color={COLORS.blue} />
          <Text style={styles.previewButtonText}>Preview</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Action buttons ---- */}
      <View style={styles.actions}>
        <TouchableOpacity
          testID="collection-cancel"
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="collection-save"
          style={[styles.saveButton, isSaving && styles.disabledButton]}
          onPress={handleSave}
          activeOpacity={0.7}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.saveText}>Save Collection</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Section labels
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },

  // Text input
  textInput: {
    backgroundColor: COLORS.input,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },

  // Match type toggle
  matchRow: {
    flexDirection: "row",
    gap: 10,
  },
  matchOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  matchOptionActive: {
    backgroundColor: COLORS.blue + "11",
    borderColor: COLORS.blue,
  },
  matchText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  matchTextActive: {
    color: COLORS.blue,
  },

  // Rules
  ruleRow: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  ruleSelectors: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  cycleSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.input,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cycleSelectorText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
    flex: 1,
    marginRight: 4,
  },
  ruleValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ruleInput: {
    flex: 1,
    backgroundColor: COLORS.input,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
  },
  rangeDash: {
    fontSize: 16,
    color: COLORS.grey,
    fontWeight: "700",
  },
  removeButton: {
    padding: 6,
  },
  emptyRules: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyRulesText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Add rule
  addRuleButton: {
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
  addRuleText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.blue,
  },

  // Preview
  previewSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
  },
  previewInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewCountText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.amber,
  },
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.blue,
  },
  previewButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.blue,
  },

  // Action buttons
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.green,
  },
  saveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  disabledButton: {
    opacity: 0.6,
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default memo(SmartCollectionBuilder);
export type { SmartCollectionBuilderProps, CollectionRule, RuleOperator };
