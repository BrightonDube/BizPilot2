/**
 * WasteEntryForm — Form for recording stock wastage.
 *
 * Why show total waste value prominently in red?
 * Waste is a direct hit to profitability. Making the financial impact
 * impossible to ignore encourages staff to double-check quantities
 * and managers to investigate recurring waste patterns.
 *
 * Why separate from AdjustmentForm?
 * Waste tracking feeds into loss reports and supplier quality metrics.
 * A dedicated form captures waste-specific metadata (cost, reason categories)
 * that a generic adjustment form wouldn't collect.
 *
 * @module WasteEntryForm
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
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";

// ─── Types ───────────────────────────────────────────────────────────────────

type WasteReason =
  | "expired"
  | "damaged"
  | "spillage"
  | "overproduction"
  | "quality_issue"
  | "other";

interface WasteEntryFormProps {
  productName: string;
  productSku: string;
  currentStock: number;
  quantity: string;
  onQuantityChange: (qty: string) => void;
  reason: WasteReason | "";
  onReasonChange: (reason: WasteReason) => void;
  costPerUnit: number;
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
  key: WasteReason;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const REASONS: ReasonMeta[] = [
  { key: "expired", label: "Expired", icon: "time-outline" },
  { key: "damaged", label: "Damaged", icon: "warning-outline" },
  { key: "spillage", label: "Spillage", icon: "water-outline" },
  { key: "overproduction", label: "Overproduction", icon: "layers-outline" },
  { key: "quality_issue", label: "Quality Issue", icon: "shield-outline" },
  { key: "other", label: "Other", icon: "ellipsis-horizontal" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Single waste reason pill with icon.
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
      testID={`waste-reason-${meta.key}`}
      onPress={onPress}
      style={[styles.reasonPill, isSelected && styles.reasonPillSelected]}
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

function WasteEntryForm({
  productName,
  productSku,
  currentStock,
  quantity,
  onQuantityChange,
  reason,
  onReasonChange,
  costPerUnit,
  notes,
  onNotesChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
  errors = {},
}: WasteEntryFormProps) {
  // ── Computed values ────────────────────────────────────────────────────────

  const parsedQty = useMemo(() => {
    const n = parseInt(quantity, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, n);
  }, [quantity]);

  /** Total financial cost of the waste — displayed prominently to convey impact. */
  const totalWasteCost = useMemo(
    () => parsedQty * costPerUnit,
    [parsedQty, costPerUnit]
  );

  const stockAfter = useMemo(
    () => currentStock - parsedQty,
    [currentStock, parsedQty]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleReasonPress = useCallback(
    (key: WasteReason) => {
      triggerHaptic("selection");
      onReasonChange(key);
    },
    [onReasonChange]
  );

  const handleSubmit = useCallback(() => {
    triggerHaptic("warning");
    onSubmit();
  }, [onSubmit]);

  const handleCancel = useCallback(() => {
    triggerHaptic("tap");
    onCancel();
  }, [onCancel]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      testID="waste-entry-form"
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <View style={styles.titleRow}>
        <Ionicons name="trash-outline" size={22} color={COLORS.red} />
        <Text style={styles.title}>Record Waste</Text>
      </View>

      {/* Product info card */}
      <View style={styles.productCard}>
        <View style={styles.productIcon}>
          <Ionicons name="cube-outline" size={24} color={COLORS.purple} />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {productName}
          </Text>
          <Text style={styles.productSku}>SKU: {productSku}</Text>
        </View>
        <View style={styles.stockBadge}>
          <Text style={styles.stockBadgeLabel}>In Stock</Text>
          <Text style={styles.stockBadgeValue}>{currentStock}</Text>
        </View>
      </View>

      {/* Quantity + cost preview */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>WASTE QUANTITY</Text>
        <View style={styles.qtyRow}>
          <TextInput
            testID="waste-quantity"
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
          <View style={styles.costPreview}>
            <Text style={styles.costPreviewLabel}>Cost per unit</Text>
            <Text style={styles.costPreviewValue}>
              {formatCurrency(costPerUnit)}
            </Text>
          </View>
        </View>
        {errors.quantity && (
          <Text style={styles.errorText}>{errors.quantity}</Text>
        )}

        {/* Stock after preview */}
        {parsedQty > 0 && (
          <View style={styles.afterPreview}>
            <Text style={styles.afterPreviewLabel}>Stock after waste:</Text>
            <Text
              style={[
                styles.afterPreviewValue,
                { color: stockAfter < 0 ? COLORS.red : COLORS.muted },
              ]}
            >
              {stockAfter}
            </Text>
          </View>
        )}
      </View>

      {/* Reason pills */}
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

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>NOTES</Text>
        <TextInput
          testID="waste-notes"
          style={styles.notesInput}
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Describe the wastage…"
          placeholderTextColor={COLORS.muted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!isSubmitting}
        />
        {errors.notes && <Text style={styles.errorText}>{errors.notes}</Text>}
      </View>

      {/* Total waste value — red and prominent so the financial impact is clear */}
      <View testID="waste-cost" style={styles.totalCard}>
        <Ionicons name="alert-circle" size={24} color={COLORS.red} />
        <View style={styles.totalInfo}>
          <Text style={styles.totalLabel}>TOTAL WASTE VALUE</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(totalWasteCost)}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          testID="waste-cancel"
          onPress={handleCancel}
          style={styles.cancelButton}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Ionicons name="close-outline" size={20} color={COLORS.text} />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="waste-submit"
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
              <Ionicons name="trash-outline" size={20} color={COLORS.text} />
              <Text style={styles.submitButtonText}>Record Waste</Text>
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

  // Title
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },

  // Product card
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${COLORS.purple}20`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  productSku: {
    fontSize: 12,
    color: COLORS.muted,
    fontFamily: "monospace",
  },
  stockBadge: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: `${COLORS.blue}15`,
  },
  stockBadgeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.muted,
    textTransform: "uppercase",
  },
  stockBadgeValue: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
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

  // Quantity row
  qtyRow: {
    flexDirection: "row",
    gap: 12,
  },
  quantityInput: {
    flex: 1,
    backgroundColor: COLORS.input,
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
  },
  inputError: {
    borderColor: COLORS.red,
  },
  costPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 8,
  },
  costPreviewLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  costPreviewValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },

  // After preview
  afterPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  afterPreviewLabel: {
    fontSize: 13,
    color: COLORS.muted,
  },
  afterPreviewValue: {
    fontSize: 15,
    fontWeight: "700",
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
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  reasonPillSelected: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
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

  // Total waste card
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: `${COLORS.red}15`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${COLORS.red}40`,
  },
  totalInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.red,
    letterSpacing: 1,
    marginBottom: 2,
  },
  totalValue: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.red,
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 12,
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
    backgroundColor: COLORS.red,
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

export default React.memo(WasteEntryForm);
