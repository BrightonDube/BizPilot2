/**
 * SplitPaymentView — split-tender payment entry screen.
 *
 * Allows the cashier to divide an order total across multiple payment
 * methods (e.g. part cash + part card). Each split line shows the method
 * name, a type badge, an editable amount input, and a remove button.
 *
 * Why a separate view instead of extending PaymentMethodSelector?
 * Split payment has fundamentally different interaction: multiple
 * concurrent amounts that must sum to the order total, dynamic add/remove,
 * and a remaining-balance indicator. Keeping it in its own component
 * avoids bloating the simple single-method flow.
 *
 * Why show "remaining" instead of "overpaid"?
 * Cashiers think in terms of "how much is left to allocate". Showing
 * remaining in red when > 0 and green when exactly 0 gives immediate
 * visual confirmation that the split is balanced.
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single split-payment tender line. */
export interface SplitPayment {
  /** Unique id for this split entry */
  id: string;
  /** Human-readable method label (e.g. "Cash") */
  methodName: string;
  /** Short type key used for badge colouring */
  methodType: string;
  /** Amount allocated to this tender line */
  amount: number;
}

export interface SplitPaymentViewProps {
  /** Full order amount that must be covered */
  orderTotal: number;
  /** Current list of split tender lines */
  splits: SplitPayment[];
  /** Called when the cashier wants to add another tender line */
  onAddSplit: () => void;
  /** Called to remove a tender line */
  onRemoveSplit: (splitId: string) => void;
  /** Called when the cashier edits the amount for a tender line */
  onUpdateAmount: (splitId: string, amount: number) => void;
  /** Computed remaining amount (orderTotal − sum of splits) */
  remainingAmount: number;
  /** Called to finalise the split payment */
  onConfirm: () => void;
  /** Called to abort and return to the previous screen */
  onCancel: () => void;
  /** When true, shows a spinner on the confirm button */
  isProcessing?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map method types to badge background colours. */
const BADGE_COLOURS: Record<string, string> = {
  cash: "#22c55e",
  card: "#3b82f6",
  eft: "#8b5cf6",
  mobile: "#fbbf24",
  account: "#f97316",
};

function badgeColour(type: string): string {
  return BADGE_COLOURS[type] ?? "#6b7280";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SplitLineProps {
  split: SplitPayment;
  onUpdateAmount: (splitId: string, amount: number) => void;
  onRemove: (splitId: string) => void;
}

/**
 * Individual tender line inside the split list.
 * Memoised to avoid re-rendering all rows on every keystroke.
 */
const SplitLine = React.memo(function SplitLine({
  split,
  onUpdateAmount,
  onRemove,
}: SplitLineProps) {
  /**
   * Parse the text field on blur so intermediate typing isn't coerced.
   * Why onEndEditing instead of onChangeText?
   * Parsing on every keystroke causes the cursor to jump when the value
   * is formatted or clamped. Parsing once at blur is smoother.
   */
  const handleAmountEnd = useCallback(
    (e: { nativeEvent: { text: string } }) => {
      const parsed = parseFloat(e.nativeEvent.text);
      onUpdateAmount(split.id, Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
    },
    [split.id, onUpdateAmount],
  );

  const handleRemove = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove(split.id);
  }, [split.id, onRemove]);

  return (
    <View testID={`split-item-${split.id}`} style={styles.splitCard}>
      {/* Top row: method name + badge + remove */}
      <View style={styles.splitHeader}>
        <View style={styles.splitMeta}>
          <Text style={styles.splitName}>{split.methodName}</Text>
          <View
            style={[styles.badge, { backgroundColor: badgeColour(split.methodType) }]}
          >
            <Text style={styles.badgeText}>{split.methodType.toUpperCase()}</Text>
          </View>
        </View>

        <Pressable
          testID={`split-remove-${split.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${split.methodName}`}
          onPress={handleRemove}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={24} color="#ef4444" />
        </Pressable>
      </View>

      {/* Amount input */}
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Amount</Text>
        <TextInput
          testID={`split-amount-${split.id}`}
          accessibilityLabel={`Amount for ${split.methodName}`}
          style={styles.amountInput}
          keyboardType="decimal-pad"
          defaultValue={split.amount > 0 ? split.amount.toFixed(2) : ""}
          placeholder="0.00"
          placeholderTextColor="#6b7280"
          onEndEditing={handleAmountEnd}
          selectTextOnFocus
        />
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * SplitPaymentView orchestrates the full split-tender screen:
 * order total → split list → add button → remaining indicator → confirm/cancel.
 */
const SplitPaymentView: React.FC<SplitPaymentViewProps> = React.memo(
  function SplitPaymentView({
    orderTotal,
    splits,
    onAddSplit,
    onRemoveSplit,
    onUpdateAmount,
    remainingAmount,
    onConfirm,
    onCancel,
    isProcessing = false,
  }) {
    const isBalanced = remainingAmount === 0;
    const canConfirm = isBalanced && splits.length > 0 && !isProcessing;

    const handleConfirm = useCallback(() => {
      if (!canConfirm) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onConfirm();
    }, [canConfirm, onConfirm]);

    const handleAdd = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAddSplit();
    }, [onAddSplit]);

    const handleCancel = useCallback(() => {
      onCancel();
    }, [onCancel]);

    return (
      <ScrollView
        testID="split-payment-view"
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---- Order total ---- */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Order Total</Text>
          <Text testID="split-total" style={styles.totalAmount}>
            {formatCurrency(orderTotal)}
          </Text>
        </View>

        {/* ---- Split list ---- */}
        {splits.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={40} color="#4b5563" />
            <Text style={styles.emptyText}>
              No payment methods added yet.{"\n"}Tap below to add one.
            </Text>
          </View>
        )}

        {splits.map((split) => (
          <SplitLine
            key={split.id}
            split={split}
            onUpdateAmount={onUpdateAmount}
            onRemove={onRemoveSplit}
          />
        ))}

        {/* ---- Add method button ---- */}
        <Pressable
          testID="split-add"
          accessibilityRole="button"
          accessibilityLabel="Add payment method"
          onPress={handleAdd}
          style={styles.addButton}
        >
          <Ionicons name="add-circle-outline" size={22} color="#3b82f6" />
          <Text style={styles.addButtonText}>Add Payment Method</Text>
        </Pressable>

        {/* ---- Remaining amount ---- */}
        <View style={styles.remainingSection}>
          <Text style={styles.remainingLabel}>Remaining</Text>
          <Text
            testID="split-remaining"
            style={[
              styles.remainingAmount,
              { color: isBalanced ? "#22c55e" : "#ef4444" },
            ]}
          >
            {formatCurrency(remainingAmount)}
          </Text>
        </View>

        {/* ---- Action buttons ---- */}
        <View style={styles.actions}>
          <Pressable
            testID="split-confirm"
            accessibilityRole="button"
            accessibilityLabel="Confirm split payment"
            accessibilityState={{ disabled: !canConfirm }}
            onPress={handleConfirm}
            style={[styles.confirmButton, !canConfirm && styles.buttonDisabled]}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#fff"
                  style={styles.btnIcon}
                />
                <Text style={styles.confirmText}>Confirm Payment</Text>
              </>
            )}
          </Pressable>

          <Pressable
            testID="split-cancel"
            accessibilityRole="button"
            accessibilityLabel="Cancel split payment"
            onPress={handleCancel}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  },
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },

  // -- Total section --
  totalSection: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#f3f4f6",
  },

  // -- Empty state --
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  // -- Split card --
  splitCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  splitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  splitMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  splitName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  },

  // -- Badge --
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },

  // -- Amount input --
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  amountLabel: {
    fontSize: 13,
    color: "#9ca3af",
  },
  amountInput: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f4f6",
    minWidth: 120,
    textAlign: "right",
  },

  // -- Add button --
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#3b82f6",
    borderRadius: 12,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
    marginLeft: 8,
  },

  // -- Remaining --
  remainingSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  remainingLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f3f4f6",
  },
  remainingAmount: {
    fontSize: 22,
    fontWeight: "700",
  },

  // -- Actions --
  actions: {
    gap: 12,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    borderRadius: 12,
    paddingVertical: 16,
  },
  buttonDisabled: {
    backgroundColor: "#374151",
  },
  btnIcon: {
    marginRight: 8,
  },
  confirmText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#374151",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ca3af",
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default SplitPaymentView;
