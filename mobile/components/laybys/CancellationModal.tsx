/**
 * CancellationModal — modal for cancelling a layby with fee breakdown.
 *
 * Calculates cancellation + restocking fees using LaybyService and
 * shows the customer's refund amount before confirming.
 *
 * Why require a reason?
 * Cancellation reasons feed into reporting so managers can identify
 * patterns (e.g. customers consistently failing on high-value items)
 * and adjust layby policies accordingly.
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/utils/formatters";
import { triggerHaptic } from "@/utils/haptics";
import {
  Layby,
  calculateCancellationFees,
} from "@/services/laybys/LaybyService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CancellationConfig {
  cancellationFeePercentage: number;
  minimumFee: number;
  restockingFeePerItem: number;
}

export interface CancellationModalProps {
  visible: boolean;
  layby: Layby;
  config: CancellationConfig;
  onConfirmCancellation: (data: { reason: string; refundMethod: string }) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Refund methods
// ---------------------------------------------------------------------------

interface RefundMethodOption {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  testID: string;
}

const REFUND_METHODS: RefundMethodOption[] = [
  { key: "cash", label: "Cash", icon: "cash-outline", testID: "cancel-refund-method-cash" },
  { key: "card", label: "Card", icon: "card-outline", testID: "cancel-refund-method-card" },
  { key: "credit", label: "Store Credit", icon: "wallet-outline", testID: "cancel-refund-method-credit" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CancellationModalInner({
  visible,
  layby,
  config,
  onConfirmCancellation,
  onClose,
  isSubmitting = false,
}: CancellationModalProps) {
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");

  const itemCount = useMemo(
    () => layby.items.reduce((sum, i) => sum + i.quantity, 0),
    [layby.items]
  );

  const fees = useMemo(
    () =>
      calculateCancellationFees(
        layby.amountPaid,
        layby.totalAmount,
        config.cancellationFeePercentage,
        config.minimumFee,
        config.restockingFeePerItem,
        itemCount
      ),
    [layby.amountPaid, layby.totalAmount, config, itemCount]
  );

  const totalDeductions = fees.cancellationFee + fees.restockingFee;
  const isReasonValid = reason.trim().length > 0;

  const handleConfirm = useCallback(() => {
    if (!isReasonValid || isSubmitting) return;
    triggerHaptic("heavy");
    onConfirmCancellation({
      reason: reason.trim(),
      refundMethod,
    });
  }, [isReasonValid, isSubmitting, reason, refundMethod, onConfirmCancellation]);

  const handleClose = useCallback(() => {
    triggerHaptic("tap");
    onClose();
  }, [onClose]);

  const handleRefundMethodSelect = useCallback((key: string) => {
    triggerHaptic("selection");
    setRefundMethod(key);
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.overlay} testID="cancel-modal">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.container}>
          {/* Header — warning colour to signal destructive action */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="warning-outline" size={22} color="#fbbf24" />
              <Text style={styles.headerTitle}>Cancel Layby</Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={12}
              testID="cancel-close-btn"
            >
              <Ionicons name="close" size={28} color="#f3f4f6" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Layby summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Reference</Text>
                <Text style={styles.summaryValue}>{layby.referenceNumber}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Customer</Text>
                <Text style={styles.summaryValue}>{layby.customerName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(layby.totalAmount)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount Paid</Text>
                <Text style={[styles.summaryValue, { color: "#22c55e" }]}>
                  {formatCurrency(layby.amountPaid)}
                </Text>
              </View>
            </View>

            {/* Fee breakdown */}
            <View style={styles.feeCard} testID="cancel-fee-breakdown">
              <Text style={styles.feeTitle}>Fee Breakdown</Text>

              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>
                  Cancellation fee ({config.cancellationFeePercentage}%)
                </Text>
                <Text style={styles.feeValue}>
                  {formatCurrency(fees.cancellationFee)}
                </Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>
                  Restocking fee ({itemCount} item{itemCount !== 1 ? "s" : ""})
                </Text>
                <Text style={styles.feeValue}>
                  {formatCurrency(fees.restockingFee)}
                </Text>
              </View>

              <View style={[styles.feeRow, styles.feeDivider]}>
                <Text style={styles.feeLabelBold}>Total Deductions</Text>
                <Text style={[styles.feeValueBold, { color: "#ef4444" }]}>
                  {formatCurrency(totalDeductions)}
                </Text>
              </View>

              <View style={[styles.feeRow, styles.refundRow]}>
                <Text style={styles.refundLabel}>Refund Amount</Text>
                <Text
                  style={[
                    styles.refundValue,
                    { color: fees.refundAmount > 0 ? "#22c55e" : "#ef4444" },
                  ]}
                  testID="cancel-refund-amount"
                >
                  {formatCurrency(fees.refundAmount)}
                </Text>
              </View>
            </View>

            {/* Reason */}
            <Text style={styles.fieldLabel}>Reason for Cancellation *</Text>
            <TextInput
              style={[styles.textInput, styles.reasonInput]}
              value={reason}
              onChangeText={setReason}
              placeholder="Why is this layby being cancelled?"
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={3}
              testID="cancel-reason-input"
            />

            {/* Refund method pills */}
            <Text style={styles.fieldLabel}>Refund Method</Text>
            <View style={styles.methodRow}>
              {REFUND_METHODS.map((method) => {
                const isSelected = refundMethod === method.key;
                return (
                  <TouchableOpacity
                    key={method.key}
                    style={[styles.methodPill, isSelected && styles.methodPillActive]}
                    onPress={() => handleRefundMethodSelect(method.key)}
                    testID={method.testID}
                  >
                    <Ionicons
                      name={method.icon}
                      size={18}
                      color={isSelected ? "#3b82f6" : "#6b7280"}
                    />
                    <Text
                      style={[
                        styles.methodPillText,
                        isSelected && styles.methodPillTextActive,
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Warning */}
            <View style={styles.warningBox} testID="cancel-warning">
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.warningText}>
                This action cannot be undone. All reserved items will be
                returned to stock.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <Text style={styles.closeButtonText}>Go Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!isReasonValid || isSubmitting) && styles.confirmDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!isReasonValid || isSubmitting}
              testID="cancel-confirm-btn"
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.confirmButtonText}>
                {isSubmitting ? "Cancelling…" : "Cancel Layby"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const CancellationModal = React.memo(CancellationModalInner);
export default CancellationModal;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardView: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  container: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    width: "90%",
    maxWidth: 520,
    maxHeight: "90%",
    overflow: "hidden",
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fbbf24" },

  /* Body */
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 12 },

  /* Layby summary */
  summaryCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { color: "#9ca3af", fontSize: 13 },
  summaryValue: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },

  /* Fee breakdown */
  feeCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  feeTitle: { color: "#f3f4f6", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feeLabel: { color: "#9ca3af", fontSize: 13 },
  feeValue: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  feeDivider: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 10,
    marginTop: 4,
  },
  feeLabelBold: { color: "#f3f4f6", fontSize: 14, fontWeight: "700" },
  feeValueBold: { fontSize: 16, fontWeight: "700" },
  refundRow: {
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  refundLabel: { color: "#f3f4f6", fontSize: 15, fontWeight: "700" },
  refundValue: { fontSize: 20, fontWeight: "700" },

  /* Fields */
  fieldLabel: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  textInput: {
    backgroundColor: "#111827",
    color: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#374151",
  },
  reasonInput: { minHeight: 80, textAlignVertical: "top" },

  /* Refund methods */
  methodRow: { flexDirection: "row", gap: 8 },
  methodPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#374151",
    minHeight: 48,
  },
  methodPillActive: { borderColor: "#3b82f6", backgroundColor: "#1e3a5f" },
  methodPillText: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  methodPillTextActive: { color: "#3b82f6" },

  /* Warning */
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#7f1d1d",
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  warningText: { color: "#fca5a5", fontSize: 13, flex: 1 },

  /* Footer */
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#1e293b",
  },
  closeButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    minHeight: 48,
    justifyContent: "center",
  },
  closeButtonText: { color: "#9ca3af", fontSize: 16, fontWeight: "600" },
  confirmButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    minHeight: 48,
  },
  confirmDisabled: { backgroundColor: "#374151", opacity: 0.6 },
  confirmButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
