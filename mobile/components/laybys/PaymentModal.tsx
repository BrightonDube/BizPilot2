/**
 * PaymentModal — modal for recording a payment against a layby.
 *
 * Pre-fills the amount with the next scheduled instalment and validates
 * that the payment is > 0 and does not exceed the balance due.
 *
 * Why a modal?
 * Recording a payment is a focused, transactional action. A modal
 * prevents navigation away from the layby detail context while the
 * cashier enters payment data.
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
import { Layby, getNextPayment } from "@/services/laybys/LaybyService";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PaymentModalProps {
  visible: boolean;
  layby: Layby;
  onSubmitPayment: (data: {
    amount: number;
    paymentMethod: string;
    reference?: string;
    notes?: string;
  }) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

interface PaymentMethodOption {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  testID: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { key: "cash", label: "Cash", icon: "cash-outline", testID: "payment-method-cash" },
  { key: "card", label: "Card", icon: "card-outline", testID: "payment-method-card" },
  { key: "eft", label: "EFT", icon: "swap-horizontal-outline", testID: "payment-method-eft" },
  { key: "other", label: "Other", icon: "ellipsis-horizontal-outline", testID: "payment-method-other" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PaymentModalInner({
  visible,
  layby,
  onSubmitPayment,
  onClose,
  isSubmitting = false,
}: PaymentModalProps) {
  const nextPayment = useMemo(() => getNextPayment(layby.schedule), [layby.schedule]);
  const suggestedAmount = nextPayment ? nextPayment.amount - nextPayment.paidAmount : layby.balanceDue;

  const [amountText, setAmountText] = useState(suggestedAmount.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const amount = useMemo(() => {
    const parsed = parseFloat(amountText);
    return isNaN(parsed) ? 0 : parsed;
  }, [amountText]);

  const validationError = useMemo(() => {
    if (amount <= 0) return "Amount must be greater than 0.";
    if (amount > layby.balanceDue) return "Amount exceeds balance due.";
    return null;
  }, [amount, layby.balanceDue]);

  const newBalance = useMemo(
    () => Math.max(layby.balanceDue - amount, 0),
    [layby.balanceDue, amount]
  );

  const handleSubmit = useCallback(() => {
    if (validationError || isSubmitting) return;
    triggerHaptic("success");
    onSubmitPayment({
      amount,
      paymentMethod,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }, [validationError, isSubmitting, amount, paymentMethod, reference, notes, onSubmitPayment]);

  const handleClose = useCallback(() => {
    triggerHaptic("tap");
    onClose();
  }, [onClose]);

  const handleMethodSelect = useCallback((key: string) => {
    triggerHaptic("selection");
    setPaymentMethod(key);
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.overlay} testID="payment-modal">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Record Payment</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={12}
              testID="payment-cancel-btn"
            >
              <Ionicons name="close" size={28} color="#f3f4f6" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Layby info */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reference</Text>
                <Text style={styles.infoValue}>{layby.referenceNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Customer</Text>
                <Text style={styles.infoValue}>{layby.customerName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Balance Due</Text>
                <Text style={[styles.infoValue, styles.balanceValue]} testID="payment-balance">
                  {formatCurrency(layby.balanceDue)}
                </Text>
              </View>
            </View>

            {/* Suggested amount hint */}
            {nextPayment && (
              <Text style={styles.suggestedHint}>
                Scheduled instalment: {formatCurrency(suggestedAmount)}
              </Text>
            )}

            {/* Amount input */}
            <Text style={styles.fieldLabel}>Payment Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencyPrefix}>R</Text>
              <TextInput
                style={styles.amountInput}
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
                selectTextOnFocus
                testID="payment-amount-input"
              />
            </View>
            {validationError && (
              <Text style={styles.errorText}>{validationError}</Text>
            )}

            {/* Payment method pills */}
            <Text style={styles.fieldLabel}>Payment Method</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((method) => {
                const isSelected = paymentMethod === method.key;
                return (
                  <TouchableOpacity
                    key={method.key}
                    style={[styles.methodPill, isSelected && styles.methodPillActive]}
                    onPress={() => handleMethodSelect(method.key)}
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

            {/* Reference */}
            <Text style={styles.fieldLabel}>Reference (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={reference}
              onChangeText={setReference}
              placeholder="e.g. EFT reference number"
              placeholderTextColor="#6b7280"
              testID="payment-reference-input"
            />

            {/* Notes */}
            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes…"
              placeholderTextColor="#6b7280"
              multiline
              numberOfLines={2}
            />

            {/* Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Current Balance</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(layby.balanceDue)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment</Text>
                <Text style={[styles.summaryValue, { color: "#22c55e" }]}>
                  − {formatCurrency(amount)}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryDivider]}>
                <Text style={styles.summaryLabelBold}>New Balance</Text>
                <Text style={styles.summaryValueBold}>
                  {formatCurrency(newBalance)}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!!validationError || isSubmitting) && styles.submitDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!!validationError || isSubmitting}
              testID="payment-submit-btn"
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Submitting…" : "Record Payment"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const PaymentModal = React.memo(PaymentModalInner);
export default PaymentModal;

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
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f3f4f6" },

  /* Body */
  body: { flex: 1 },
  bodyContent: { padding: 20, gap: 12 },

  /* Layby info */
  infoCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: { color: "#9ca3af", fontSize: 13 },
  infoValue: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  balanceValue: { color: "#fbbf24", fontSize: 16, fontWeight: "700" },

  suggestedHint: { color: "#6b7280", fontSize: 12, fontStyle: "italic" },

  /* Fields */
  fieldLabel: { color: "#9ca3af", fontSize: 13, marginTop: 4 },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 16,
  },
  currencyPrefix: { color: "#6b7280", fontSize: 20, fontWeight: "700", marginRight: 8 },
  amountInput: {
    flex: 1,
    color: "#f3f4f6",
    fontSize: 24,
    fontWeight: "700",
    paddingVertical: 14,
  },
  errorText: { color: "#ef4444", fontSize: 12 },

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
  notesInput: { minHeight: 56, textAlignVertical: "top" },

  /* Payment methods */
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

  /* Summary */
  summaryCard: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryDivider: {
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingTop: 8,
    marginTop: 4,
  },
  summaryLabel: { color: "#9ca3af", fontSize: 13 },
  summaryValue: { color: "#f3f4f6", fontSize: 14, fontWeight: "600" },
  summaryLabelBold: { color: "#f3f4f6", fontSize: 15, fontWeight: "700" },
  summaryValueBold: { color: "#f3f4f6", fontSize: 18, fontWeight: "700" },

  /* Footer */
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#1e293b",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    minHeight: 48,
    justifyContent: "center",
  },
  cancelButtonText: { color: "#9ca3af", fontSize: 16, fontWeight: "600" },
  submitButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#22c55e",
    minHeight: 48,
  },
  submitDisabled: { backgroundColor: "#374151", opacity: 0.6 },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
