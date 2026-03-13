/**
 * AdjustmentForm — Form for making stock quantity adjustments.
 *
 * Why a controlled form instead of uncontrolled?
 * The parent screen needs real-time access to every field for validation,
 * preview calculations, and API submission. Controlled inputs keep the
 * single source of truth in the parent's state.
 *
 * Why haptic feedback on type toggle and reason selection?
 * Stock adjustments are high-stakes operations — tactile confirmation
 * reassures the user that their tap registered, reducing double-taps
 * and accidental mis-selections on warehouse tablets.
 *
 * @module AdjustmentForm
 */

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

type AdjustmentReason =
  | "damaged"
  | "expired"
  | "theft"
  | "found"
  | "correction"
  | "other";

interface AdjustmentFormProps {
  productName: string;
  productSku: string;
  currentStock: number;
  adjustmentType: "increase" | "decrease";
  onTypeChange: (type: "increase" | "decrease") => void;
  quantity: string;
  onQuantityChange: (qty: string) => void;
  reason: AdjustmentReason | "";
  onReasonChange: (reason: AdjustmentReason) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  errors?: Record<string, string>;
}

// ─── Theme ───────────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#0f172a",
  card: "#1f2937",
  input: "#111827",
  text: "#f3f4f6",
  muted: "#9ca3af",
  border: "#374151",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#fbbf24",
  blue: "#3b82f6",
  purple: "#8b5cf6",
} as const;

// ─── Reason metadata ─────────────────────────────────────────────────────────

interface ReasonMeta {
  key: AdjustmentReason;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const REASONS: ReasonMeta[] = [
  { key: "damaged", label: "Damaged", icon: "warning-outline" },
  { key: "expired", label: "Expired", icon: "time-outline" },
  { key: "theft", label: "Theft", icon: "lock-closed-outline" },
  { key: "found", label: "Found", icon: "search-outline" },
  { key: "correction", label: "Correction", icon: "pencil-outline" },
  { key: "other", label: "Other", icon: "ellipsis-horizontal" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Toggle between Increase and Decrease adjustment types.
 * Green highlight for increase, red for decrease — matches
 * the universal colour associations for gain/loss.
 */
const TypeToggle = React.memo(function TypeToggle({
  activeType,
  onTypeChange,
}: {
  activeType: "increase" | "decrease";
  onTypeChange: (type: "increase" | "decrease") => void;
}) {
  const handleIncrease = useCallback(() => {
    triggerHaptic("tap");
    onTypeChange("increase");
  }, [onTypeChange]);

  const handleDecrease = useCallback(() => {
    triggerHaptic("tap");
    onTypeChange("decrease");
  }, [onTypeChange]);

  return (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        testID="adjustment-type-increase"
        onPress={handleIncrease}
        style={[
          styles.toggleButton,
          activeType === "increase" && styles.toggleActive,
          activeType === "increase" && { backgroundColor: `${COLORS.green}20` },
        ]}
        activeOpacity={0.7}
      >
        <Ionicons
          name="add-circle-outline"
          size={20}
          color={activeType === "increase" ? COLORS.green : COLORS.muted}
        />
        <Text
          style={[
            styles.toggleText,
            activeType === "increase" && { color: COLORS.green },
          ]}
        >
          Increase
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="adjustment-type-decrease"
        onPress={handleDecrease}
        style={[
          styles.toggleButton,
          activeType === "decrease" && styles.toggleActive,
          activeType === "decrease" && { backgroundColor: `${COLORS.red}20` },
        ]}
        activeOpacity={0.7}
      >
        <Ionicons
          name="remove-circle-outline"
          size={20}
          color={activeType === "decrease" ? COLORS.red : COLORS.muted}
        />
        <Text
          style={[
            styles.toggleText,
            activeType === "decrease" && { color: COLORS.red },
          ]}
        >
          Decrease
        </Text>
      </TouchableOpacity>
    </View>
  );
});

/**
 * Single reason pill — selectable chip with icon.
 */
const ReasonPill = React.memo(function ReasonPill({
  meta,
  isSelected,
  onPress,
}: {
  meta: ReasonMeta;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID={`adjustment-reason-${meta.key}`}
      onPress={onPress}
      style={[
        styles.reasonPill,
        isSelected && styles.reasonPillSelected,
      ]}
      activeOpacity={0.7}
    >
      <Ionicons
        name={meta.icon}
        size={16}
        color={isSelected ? COLORS.text : COLORS.muted}
      />
      <Text
        style={[
          styles.reasonPillText,
          isSelected && styles.reasonPillTextSelected,
        ]}
      >
        {meta.label}
      </Text>
    </TouchableOpacity>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function AdjustmentForm({
  productName,
  productSku,
  currentStock,
  adjustmentType,
  onTypeChange,
  quantity,
  onQuantityChange,
  reason,
  onReasonChange,
  notes,
  onNotesChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errors = {},
}: AdjustmentFormProps) {
  // ── Computed values ────────────────────────────────────────────────────────

  const parsedQty = useMemo(() => {
    const n = parseInt(quantity, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  }, [quantity]);

  /** Preview of stock level after the adjustment is applied. */
  const newStock = useMemo(() => {
    return adjustmentType === "increase"
      ? currentStock + parsedQty
      : currentStock - parsedQty;
  }, [adjustmentType, currentStock, parsedQty]);

  const previewColor = useMemo(() => {
    if (newStock < 0) return COLORS.red;
    if (newStock === 0) return COLORS.amber;
    return COLORS.green;
  }, [newStock]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleReasonPress = useCallback(
    (key: AdjustmentReason) => {
      triggerHaptic("selection");
      onReasonChange(key);
    },
    [onReasonChange]
  );

  const handleSubmit = useCallback(() => {
    triggerHaptic("success");
    onSubmit();
  }, [onSubmit]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      testID="adjustment-form"
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Product header */}
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Ionicons name="cube-outline" size={24} color={COLORS.purple} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {productName}
          </Text>
          <Text style={styles.productSku}>SKU: {productSku}</Text>
        </View>
      </View>

      {/* Current stock */}
      <View style={styles.currentStockCard}>
        <Text style={styles.sectionLabel}>CURRENT STOCK</Text>
        <Text style={styles.currentStockValue}>{currentStock}</Text>
        <Text style={styles.currentStockUnit}>units</Text>
      </View>

      {/* Adjustment type toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ADJUSTMENT TYPE</Text>
        <TypeToggle activeType={adjustmentType} onTypeChange={onTypeChange} />
        {errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
      </View>

      {/* Quantity input */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>QUANTITY</Text>
        <TextInput
          testID="adjustment-quantity"
          style={[
            styles.quantityInput,
            errors.quantity ? styles.inputError : null,
          ]}
          value={quantity}
          onChangeText={onQuantityChange}
          placeholder="0"
          placeholderTextColor={COLORS.muted}
          keyboardType="number-pad"
          returnKeyType="done"
          editable={!isSubmitting}
        />
        {errors.quantity && (
          <Text style={styles.errorText}>{errors.quantity}</Text>
        )}
      </View>

      {/* New stock preview */}
      <View testID="adjustment-preview" style={styles.previewCard}>
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Current</Text>
          <Ionicons
            name={
              adjustmentType === "increase"
                ? "arrow-forward"
                : "arrow-forward"
            }
            size={16}
            color={COLORS.muted}
          />
          <Text style={styles.previewLabel}>New Stock</Text>
        </View>
        <View style={styles.previewRow}>
          <Text style={styles.previewValue}>{currentStock}</Text>
          <Text
            style={[
              styles.previewOperator,
              {
                color:
                  adjustmentType === "increase" ? COLORS.green : COLORS.red,
              },
            ]}
          >
            {adjustmentType === "increase" ? "+" : "−"} {parsedQty}
          </Text>
          <Text style={[styles.previewResult, { color: previewColor }]}>
            {newStock}
          </Text>
        </View>
      </View>

      {/* Reason selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>REASON (REQUIRED)</Text>
        <View style={styles.reasonGrid}>
          {REASONS.map((meta) => (
            <ReasonPill
              key={meta.key}
              meta={meta}
              isSelected={reason === meta.key}
              onPress={() => handleReasonPress(meta.key)}
            />
          ))}
        </View>
        {errors.reason && (
          <Text style={styles.errorText}>{errors.reason}</Text>
        )}
      </View>

      {/* Notes textarea */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NOTES</Text>
        <TextInput
          testID="adjustment-notes"
          style={styles.notesInput}
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Additional details…"
          placeholderTextColor={COLORS.muted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!isSubmitting}
        />
        {errors.notes && <Text style={styles.errorText}>{errors.notes}</Text>}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          testID="adjustment-cancel"
          onPress={handleCancel}
          style={styles.cancelButton}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Ionicons name="close-outline" size={20} color={COLORS.text} />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="adjustment-submit"
          onPress={handleSubmit}
          style={[
            styles.submitButton,
            isSubmitting && styles.submitButtonDisabled,
          ]}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={COLORS.text}
              />
              <Text style={styles.submitButtonText}>Submit Adjustment</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },

  // Header
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${COLORS.purple}20`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  headerInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  productSku: {
    fontSize: 13,
    color: COLORS.muted,
    fontFamily: "monospace",
  },

  // Current stock
  currentStockCard: {
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currentStockValue: {
    fontSize: 40,
    fontWeight: "800",
    color: COLORS.text,
    marginVertical: 4,
  },
  currentStockUnit: {
    fontSize: 13,
    color: COLORS.muted,
  },

  // Sections
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },

  // Type toggle
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    // 48px minimum touch target for tablet use
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  toggleActive: {
    borderWidth: 2,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.muted,
  },

  // Quantity input
  quantityInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
  },
  inputError: {
    borderColor: COLORS.red,
  },

  // Preview
  previewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  previewLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  previewValue: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
    textAlign: "center",
  },
  previewOperator: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  previewResult: {
    fontSize: 28,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },

  // Reason pills
  reasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    // 48px touch target
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  reasonPillSelected: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  reasonPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.muted,
  },
  reasonPillTextSelected: {
    color: COLORS.text,
  },

  // Notes
  notesInput: {
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 15,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 100,
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  submitButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: COLORS.blue,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Error
  errorText: {
    fontSize: 12,
    color: COLORS.red,
    marginTop: 4,
  },
});

export default React.memo(AdjustmentForm);
